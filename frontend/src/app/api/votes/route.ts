import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';

// POST: emitir o cambiar voto
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Sesión inválida' }, { status: 401 });

    const body = await req.json();
    const { target_resource, vote } = body;

    if (!target_resource || !['safe', 'phishing'].includes(vote)) {
      return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 });
    }

    // Comprobar si ya existe un voto
    const { data: existingVotes, error: selectError } = await supabase
      .from('url_votes')
      .select('id')
      .eq('user_id', user.id)
      .eq('target_resource', target_resource);

    if (selectError) {
      if (selectError.code === '42P01') {
        return NextResponse.json({ error: 'La tabla de votos aún no está configurada en Supabase.' }, { status: 503 });
      }
      throw selectError;
    }

    if (existingVotes && existingVotes.length > 0) {
      // Actualizar voto existente
      const { error: updateError } = await supabase
        .from('url_votes')
        .update({ vote })
        .eq('id', existingVotes[0].id);
      
      if (updateError) throw updateError;
    } else {
      // Insertar nuevo voto
      const { error: insertError } = await supabase
        .from('url_votes')
        .insert({
          user_id: user.id,
          target_resource,
          vote
        });
        
      if (insertError) throw insertError;
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Error en votes API:', err);
    return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 });
  }
}

// GET: obtener conteo de votos para un recurso
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const target_resource = url.searchParams.get('resource');
    if (!target_resource) return NextResponse.json({ error: 'Falta el recurso' }, { status: 400 });

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const { data, error } = await supabase
      .from('url_votes')
      .select('vote, user_id')
      .eq('target_resource', target_resource);

    if (error) {
      if (error.code === '42P01') {
        return NextResponse.json({ safe: 0, phishing: 0, userVote: null, tableReady: false });
      }
      throw error;
    }

    // Extraer user_id del token si viene autenticado (opcional)
    const authHeader = req.headers.get('Authorization');
    let currentUserId: string | null = null;
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const authSupabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: `Bearer ${token}` } }
      });
      const { data: { user } } = await authSupabase.auth.getUser();
      currentUserId = user?.id || null;
    }

    const safeCount = data.filter(v => v.vote === 'safe').length;
    const phishingCount = data.filter(v => v.vote === 'phishing').length;
    const userVote = currentUserId ? (data.find(v => v.user_id === currentUserId)?.vote || null) : null;

    return NextResponse.json({ safe: safeCount, phishing: phishingCount, userVote, tableReady: true });
  } catch (err: unknown) {
    console.error('Error en votes GET:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
