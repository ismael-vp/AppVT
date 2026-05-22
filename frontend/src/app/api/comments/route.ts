import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Inicializar cliente Supabase de servidor con claves de entorno
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';

// Lista básica de palabras bloqueadas (Profanity Filter)
const BLOCKED_WORDS = [
  'puta', 'puto', 'mierda', 'cabron', 'cabròn', 'cabrón', 'joder', 'gilipollas', 
  'subnormal', 'maricon', 'fuck', 'shit', 'bitch', 'asshole', 'cunt', 'dick', 
  'pussy', 'whore', 'bastard'
];

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Configurar cliente de Supabase para que use el token JWT del usuario
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    });
    
    // Verificar token y obtener el usuario real
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Sesión inválida' }, { status: 401 });
    }

    const body = await req.json();
    const { target_resource, content } = body;

    if (!target_resource || !content) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 });
    }

    // 1. FILTRO ANTI-ENLACES
    const urlRegex = /(http|https|ftp|www\.)[^\s]+/gi;
    if (urlRegex.test(content)) {
      return NextResponse.json({ error: 'No se permiten enlaces en los comentarios por seguridad.' }, { status: 400 });
    }

    // 2. FILTRO ANTI-PALABROTERÍAS
    const lowerContent = content.toLowerCase();
    const containsProfanity = BLOCKED_WORDS.some(word => lowerContent.includes(word));
    if (containsProfanity) {
      return NextResponse.json({ error: 'Tu comentario contiene lenguaje no permitido.' }, { status: 400 });
    }

    // 3. ANTI-SPAM (Rate Limiting en Supabase)
    // Contar cuántos comentarios ha hecho este usuario en el último minuto
    const oneMinuteAgo = new Date(Date.now() - 60000).toISOString();
    
    const { count, error: countError } = await supabase
      .from('resource_comments')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', oneMinuteAgo);

    if (countError) {
      console.error("Error checking spam:", countError);
    } else if (count !== null && count >= 3) {
      return NextResponse.json({ error: 'Estás enviando mensajes demasiado rápido. Espera un minuto.' }, { status: 429 });
    }

    // 4. MODERACIÓN POR IA (Llamada al backend de Python)
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    try {
      const aiResponse = await fetch(`${apiUrl}/api/moderate-comment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content })
      });
      
      if (aiResponse.ok) {
        const aiResult = await aiResponse.json();
        if (aiResult && aiResult.is_valuable === false) {
          return NextResponse.json({ 
            error: `La IA ha rechazado este comentario: ${aiResult.reason}` 
          }, { status: 400 });
        }
      } else {
        console.warn("AI moderation endpoint returned status:", aiResponse.status);
      }
    } catch (aiError) {
      console.error("Error contactando con el backend de IA:", aiError);
      // No bloqueamos si el microservicio de IA falla, simplemente registramos el error
    }

    // Extraer datos del usuario para el perfil
    const author_name = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Usuario';
    const author_avatar = user.user_metadata?.avatar_url || null;

    // 5. INSERTAR COMENTARIO
    const { data: insertedComment, error: insertError } = await supabase
      .from('resource_comments')
      .insert({
        user_id: user.id,
        target_resource: target_resource,
        content: content.trim(),
        author_name: author_name,
        author_avatar: author_avatar
      })
      .select('*')
      .single();

    if (insertError) {
      throw insertError;
    }

    return NextResponse.json({ success: true, comment: insertedComment });

  } catch (error: unknown) {
    console.error('Error in comments API:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Sesión inválida' }, { status: 401 });

    const url = new URL(req.url);
    const commentId = url.searchParams.get('id');
    
    if (!commentId) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });

    const { error } = await supabase
      .from('resource_comments')
      .delete()
      .eq('id', commentId)
      .eq('user_id', user.id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Error al borrar', err);
    return NextResponse.json({ error: 'Error al borrar' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Sesión inválida' }, { status: 401 });

    const body = await req.json();
    const { id, content } = body;

    if (!id || !content) return NextResponse.json({ error: 'Faltan campos' }, { status: 400 });

    // 1. Obtener comentario original para validar el tiempo de 5 minutos y el propietario
    const { data: existing, error: fetchErr } = await supabase
      .from('resource_comments')
      .select('created_at')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (fetchErr || !existing) return NextResponse.json({ error: 'Comentario no encontrado o sin permisos' }, { status: 403 });

    const createdTime = new Date(existing.created_at).getTime();
    if (Date.now() - createdTime > 5 * 60 * 1000) {
      return NextResponse.json({ error: 'Solo puedes editar durante los primeros 5 minutos' }, { status: 400 });
    }

    // 2. Filtros de Seguridad (Enlaces y Malsonantes)
    if (/(http|https|ftp|www\.)[^\s]+/gi.test(content)) {
      return NextResponse.json({ error: 'No enlaces' }, { status: 400 });
    }
    if (BLOCKED_WORDS.some(word => content.toLowerCase().includes(word))) {
      return NextResponse.json({ error: 'Lenguaje no permitido' }, { status: 400 });
    }

    // 3. IA Moderación
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    try {
      const aiResponse = await fetch(`${apiUrl}/api/moderate-comment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content })
      });
      if (aiResponse.ok) {
        const aiResult = await aiResponse.json();
        if (aiResult && aiResult.is_valuable === false) {
          return NextResponse.json({ error: `La IA rechazó tu edición: ${aiResult.reason}` }, { status: 400 });
        }
      }
    } catch (aiError) {
      console.error(aiError);
    }

    // 4. Actualizar
    const { data: updatedComment, error: updateErr } = await supabase
      .from('resource_comments')
      .update({ content: content.trim() })
      .eq('id', id)
      .select('*')
      .single();

    if (updateErr) throw updateErr;

    return NextResponse.json({ success: true, comment: updatedComment });

  } catch (err: unknown) {
    console.error(err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
