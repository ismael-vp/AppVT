import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
// Usamos service role para leer auth.users (nunca exponer en cliente)
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';

export async function GET(_req: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Obtener todos los scan_reports agrupados por user_id con conteo
    const { data: reports, error } = await supabase
      .from('scan_reports')
      .select('user_id, scan_data');

    if (error) throw error;

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

    // Intentar obtener emails con service role (si está disponible)
    const userIds = Object.keys(userMap);
    const emailMap: Record<string, string> = {};

    if (supabaseServiceKey !== (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '')) {
      // Tenemos service role, podemos leer auth.users
      try {
        const { data: usersData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
        for (const u of usersData?.users || []) {
          if (userIds.includes(u.id)) {
            const emailPrefix = (u.email || '').split('@')[0] || u.id.slice(0, 8);
            emailMap[u.id] = emailPrefix;
          }
        }
      } catch {
        // Sin service role, usar fallback
      }
    }

    // Construir leaderboard
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
    console.error('Leaderboard error:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
