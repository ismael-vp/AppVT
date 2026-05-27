import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';

function getBadge(total: number): string {
  if (total >= 250) return 'Élite';
  if (total >= 100) return 'Experto';
  if (total >= 50)  return 'Cazador';
  if (total >= 10)  return 'Guardián';
  return 'Explorador';
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const usersParam = url.searchParams.get('users');
    if (!usersParam) {
      return NextResponse.json({ badges: {} });
    }

    const userIds = usersParam.split(',').filter(Boolean);
    if (userIds.length === 0) {
      return NextResponse.json({ badges: {} });
    }

    // M-13: Validar que cada ID sea un UUID v4 válido y limitar el tamaño del batch
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const safeUserIds = userIds
      .filter(id => UUID_REGEX.test(id))
      .slice(0, 100); // máx 100 IDs por batch

    if (safeUserIds.length === 0) {
      return NextResponse.json({ badges: {} });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Obtener los conteos para estos usuarios usando service_role para saltar RLS
    const { data: reports, error } = await supabase
      .from('scan_reports')
      .select('user_id')
      .in('user_id', safeUserIds);

    if (error) throw error;

    const counts: Record<string, number> = {};
    for (const uid of safeUserIds) {
      counts[uid] = 0;
    }

    for (const row of reports || []) {
      const uid = row.user_id as string;
      if (counts[uid] !== undefined) {
        counts[uid]++;
      }
    }

    const badges: Record<string, string> = {};
    for (const uid of safeUserIds) {
      badges[uid] = getBadge(counts[uid]);
    }

    return NextResponse.json({ badges });
  } catch (err: unknown) {
    console.error('Badges API error:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
