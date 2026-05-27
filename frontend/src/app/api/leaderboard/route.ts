import { NextRequest, NextResponse } from 'next/server';

// Lectura segura de variables de entorno (solo disponibles en servidor)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
// Intentamos la service role key primero; si no, la publishable key (puede ser formato sb_...)
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAnonKey    = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';

function isJwt(key: string): boolean {
  return key.startsWith('eyJ');
}

export async function GET(_req: NextRequest) {
  // Verificar que tenemos las variables necesarias
  if (!supabaseUrl) {
    return NextResponse.json(
      { leaderboard: [], notice: 'Supabase no configurado.' },
      { status: 200 }
    );
  }

  // Seleccionar la key más adecuada disponible
  const activeKey = isJwt(supabaseServiceKey)
    ? supabaseServiceKey
    : isJwt(supabaseAnonKey)
    ? supabaseAnonKey
    : null;

  if (!activeKey) {
    // No hay JWT válido — devolver leaderboard vacío en lugar de explotar
    console.warn('[leaderboard] No se encontró una JWT key válida de Supabase. Devolviendo lista vacía.');
    return NextResponse.json({ leaderboard: [] }, { status: 200 });
  }

  try {
    // Import dinámico para evitar que un fallo en el módulo rompa el route en Turbopack
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, activeKey);

    // Leer scan_reports con límite para prevenir OOM en bases de datos grandes (H-6)
    const { data: reports, error } = await supabase
      .from('scan_reports')
      .select('user_id, scan_data')
      .limit(10000);

    if (error) {
      console.error('[leaderboard] Supabase error:', error.message);
      return NextResponse.json({ leaderboard: [], error: error.message }, { status: 200 });
    }

    // Agrupar por user_id
    const userMap: Record<string, { total: number; threats: number }> = {};
    for (const row of reports || []) {
      const uid = row.user_id as string;
      if (!uid) continue;
      if (!userMap[uid]) userMap[uid] = { total: 0, threats: 0 };
      userMap[uid].total++;
      const scan = row.scan_data;
      const malicious = (scan?.stats?.malicious || 0) + (scan?.stats?.suspicious || 0);
      if (malicious > 0) userMap[uid].threats++;
    }

    const userIds = Object.keys(userMap);
    const emailMap: Record<string, string> = {};

    // Solo intentar leer usuarios si tenemos service role key JWT
    if (isJwt(supabaseServiceKey)) {
      try {
        const { data: usersData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
        for (const u of usersData?.users || []) {
          if (userIds.includes(u.id)) {
            const emailPrefix = (u.email || '').split('@')[0] || u.id.slice(0, 8);
            emailMap[u.id] = emailPrefix;
          }
        }
      } catch {
        // Sin permisos de admin — usar fallback de user_XXXXXX
      }
    }

    // Construir leaderboard ordenado por total de análisis
    const leaderboard = userIds
      .map(uid => ({
        user_id: uid,
        display_name: emailMap[uid] || `user_${uid.slice(0, 6)}`,
        total: userMap[uid].total,
        threats: userMap[uid].threats,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 50);

    return NextResponse.json({ leaderboard });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error interno';
    console.error('[leaderboard] Error no controlado:', msg);
    // Nunca devolver HTML — siempre JSON aunque sea con leaderboard vacío
    return NextResponse.json({ leaderboard: [], error: msg }, { status: 200 });
  }
}
