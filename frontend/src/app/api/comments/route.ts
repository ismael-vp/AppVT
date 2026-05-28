import { NextRequest, NextResponse } from 'next/server';
import { SupabaseClient, User } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/utils/supabase/server';

// Usar variable privada de servidor (sin NEXT_PUBLIC_) para la URL interna del backend
const API_URL = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';

// Lista básica de palabras bloqueadas (Profanity Filter)
const BLOCKED_WORDS = [
  'puta', 'puto', 'mierda', 'cabron', 'cabròn', 'cabrón', 'joder', 'gilipollas',
  'subnormal', 'maricon', 'fuck', 'shit', 'bitch', 'asshole', 'cunt', 'dick',
  'pussy', 'whore', 'bastard'
];

// ---------------------------------------------------------------------------
// Fix 10: Helper compartido de autenticación — elimina duplicación en POST/PUT/DELETE
// ---------------------------------------------------------------------------
async function authenticateRequest(req: NextRequest): Promise<
  { user: User; supabase: SupabaseClient; error: null } |
  { user: null; supabase: null; error: string }
> {
  const supabase = await createServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { user: null, supabase: null, error: 'Sesión inválida' };

  return { user, supabase, error: null };
}

// ---------------------------------------------------------------------------
// Fix 14: Sanitizar nombre de usuario (protección contra XSS en metadata OAuth)
// ---------------------------------------------------------------------------
function sanitizeName(name: string): string {
  return name.replace(/[<>"'&]/g, '').trim().slice(0, 50);
}

// ---------------------------------------------------------------------------
// Filtros de contenido reutilizables
// ---------------------------------------------------------------------------
// NOTA: El flag /g hace que RegExp sea stateful (lastIndex persiste entre llamadas).
// Reseteamos lastIndex=0 antes de cada .test() para garantizar comportamiento correcto.
const URL_REGEX = /(http|https|ftp|www\.)[^\s]+/gi;

function validateContent(content: string): string | null {
  URL_REGEX.lastIndex = 0; // Reset necesario por el flag /g
  if (URL_REGEX.test(content)) return 'No se permiten enlaces en los comentarios por seguridad.';
  const lower = content.toLowerCase();
  if (BLOCKED_WORDS.some(w => lower.includes(w))) return 'Tu comentario contiene lenguaje no permitido.';
  return null;
}

async function moderateWithAI(content: string): Promise<{ blocked: boolean; reason?: string }> {
  try {
    const res = await fetch(`${API_URL}/api/moderate-comment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content })
    });
    if (!res.ok) return { blocked: false };
    const data = await res.json();
    if (data?.is_valuable === false) return { blocked: true, reason: data.reason };
  } catch {
    // Fail-open: si el servicio de IA no está disponible, no bloqueamos
  }
  return { blocked: false };
}

// ---------------------------------------------------------------------------
// POST /api/comments — Crear comentario
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  try {
    const { user, supabase, error } = await authenticateRequest(req);
    if (!user || !supabase) return NextResponse.json({ error }, { status: 401 });

    const body = await req.json();
    const { target_resource, content } = body;

    if (!target_resource || !content) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 });
    }

    const contentError = validateContent(content);
    if (contentError) return NextResponse.json({ error: contentError }, { status: 400 });

    // Anti-spam: máximo 3 comentarios por minuto por usuario
    const oneMinuteAgo = new Date(Date.now() - 60000).toISOString();
    const { count, error: countError } = await supabase
      .from('resource_comments')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', oneMinuteAgo);

    if (countError) console.error('Error checking spam:', countError);
    else if (count !== null && count >= 3) {
      return NextResponse.json({ error: 'Estás enviando mensajes demasiado rápido. Espera un minuto.' }, { status: 429 });
    }

    // Moderación por IA
    const aiCheck = await moderateWithAI(content);
    if (aiCheck.blocked) {
      return NextResponse.json({ error: `La IA ha rechazado este comentario: ${aiCheck.reason}` }, { status: 400 });
    }

    // Fix 14: author_name sanitizado
    const author_name = sanitizeName(
      user.user_metadata?.full_name || user.email?.split('@')[0] || 'Usuario'
    );
    const author_avatar = user.user_metadata?.avatar_url || null;

    const { data: insertedComment, error: insertError } = await supabase
      .from('resource_comments')
      .insert({ user_id: user.id, target_resource, content: content.trim(), author_name, author_avatar })
      .select('*')
      .single();

    if (insertError) throw insertError;
    return NextResponse.json({ success: true, comment: insertedComment });

  } catch (error: unknown) {
    console.error('Error in comments POST:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/comments?id=... — Borrar comentario propio
// ---------------------------------------------------------------------------
export async function DELETE(req: NextRequest) {
  try {
    const { user, supabase, error } = await authenticateRequest(req);
    if (!user || !supabase) return NextResponse.json({ error }, { status: 401 });

    const commentId = new URL(req.url).searchParams.get('id');
    if (!commentId) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });

    const { error: deleteError } = await supabase
      .from('resource_comments')
      .delete()
      .eq('id', commentId)
      .eq('user_id', user.id);

    if (deleteError) throw deleteError;
    return NextResponse.json({ success: true });

  } catch (err: unknown) {
    console.error('Error al borrar comentario:', err);
    return NextResponse.json({ error: 'Error al borrar' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PUT /api/comments — Editar comentario (solo primeros 5 minutos)
// ---------------------------------------------------------------------------
export async function PUT(req: NextRequest) {
  try {
    const { user, supabase, error } = await authenticateRequest(req);
    if (!user || !supabase) return NextResponse.json({ error }, { status: 401 });

    const body = await req.json();
    const { id, content } = body;
    if (!id || !content) return NextResponse.json({ error: 'Faltan campos' }, { status: 400 });

    // Verificar propietario y ventana de 5 minutos
    const { data: existing, error: fetchErr } = await supabase
      .from('resource_comments')
      .select('created_at')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (fetchErr || !existing) return NextResponse.json({ error: 'Comentario no encontrado o sin permisos' }, { status: 403 });

    if (Date.now() - new Date(existing.created_at).getTime() > 5 * 60 * 1000) {
      return NextResponse.json({ error: 'Solo puedes editar durante los primeros 5 minutos' }, { status: 400 });
    }

    const contentError = validateContent(content);
    if (contentError) return NextResponse.json({ error: contentError }, { status: 400 });

    const aiCheck = await moderateWithAI(content);
    if (aiCheck.blocked) {
      return NextResponse.json({ error: `La IA rechazó tu edición: ${aiCheck.reason}` }, { status: 400 });
    }

    const { data: updatedComment, error: updateErr } = await supabase
      .from('resource_comments')
      .update({ content: content.trim() })
      .eq('id', id)
      .select('*')
      .single();

    if (updateErr) throw updateErr;
    return NextResponse.json({ success: true, comment: updatedComment });

  } catch (err: unknown) {
    console.error('Error al editar comentario:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
