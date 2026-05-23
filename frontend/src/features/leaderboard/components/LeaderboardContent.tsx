"use client";

import React, { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { RequireLoginPanel } from '@/components/auth/RequireLoginPanel';

interface LeaderEntry {
  user_id: string;
  display_name: string;
  total: number;
  threats: number;
}

function getBadge(total: number): { label: string } {
  if (total >= 250) return { label: 'Élite' };
  if (total >= 100) return { label: 'Experto' };
  if (total >= 50)  return { label: 'Cazador' };
  if (total >= 10)  return { label: 'Guardián' };
  return { label: 'Explorador' };
}

function getBadgeStyle(label: string) {
  switch(label) {
    case 'Élite': return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
    case 'Experto': return 'bg-purple-500/10 text-purple-400 border border-purple-500/20';
    case 'Cazador': return 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
    case 'Guardián': return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
    default: return 'bg-zinc-800/50 text-zinc-400 border border-zinc-700/50';
  }
}

export default function LeaderboardContent() {
  const [entries, setEntries] = useState<LeaderEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuthStore();

  useEffect(() => {
    fetch('/api/leaderboard')
      .then(r => r.json())
      .then(data => {
        if (data.error) throw new Error(data.error);
        setEntries(data.leaderboard || []);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] text-zinc-600 gap-3">
        <div className="w-5 h-5 border-2 border-zinc-800 border-t-zinc-500 rounded-full animate-spin" />
        <p className="text-xs uppercase tracking-widest">Calculando clasificación</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="border border-red-900/40 text-red-500/70 p-4 rounded-lg text-sm">
        Error: {error}
      </div>
    );
  }

  const BADGE_TIERS = [
    { label: 'Explorador', req: '1+ análisis' },
    { label: 'Guardián',   req: '10+ análisis' },
    { label: 'Cazador',    req: '50+ análisis' },
    { label: 'Experto',    req: '100+ análisis' },
    { label: 'Élite',      req: '250+ análisis' },
  ];

  const content = (
    <div className="w-full max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700 space-y-4">

      {/* Tabla */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
          <h2 className="text-xs font-medium text-zinc-400 uppercase tracking-widest">Clasificación Global</h2>
          <span className="text-xs text-zinc-500">{entries.length} usuarios</span>
        </div>

        <div className="divide-y divide-zinc-900/70">
          {entries.length === 0 && (
            <div className="py-16 text-center text-zinc-500 text-sm">
              Aún no hay datos suficientes para mostrar el ranking.
            </div>
          )}
          {entries.map((entry, i) => {
            const rank = i + 1;
            const badge = getBadge(entry.total);
            const threatRate = entry.total > 0 ? Math.round((entry.threats / entry.total) * 100) : 0;

            return (
              <div
                key={entry.user_id}
                className="flex items-center gap-5 px-6 py-4 hover:bg-zinc-900/30 transition-colors"
              >
                {/* Posición */}
                <span className={`text-xs font-mono w-5 text-center shrink-0 ${rank <= 3 ? 'text-zinc-300' : 'text-zinc-500'}`}>
                  {rank}
                </span>

                {/* Nombre + badge */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-zinc-200 truncate">{entry.display_name}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-medium ${getBadgeStyle(badge.label)}`}>
                      {badge.label}
                    </span>
                  </div>
                  {entry.threats > 0 && (
                    <p className="text-[11px] text-zinc-500 mt-0.5">
                      {entry.threats} amenazas detectadas · {threatRate}%
                    </p>
                  )}
                </div>

                {/* Análisis count */}
                <div className="text-right shrink-0">
                  <span className="text-sm font-mono text-zinc-400">{entry.total}</span>
                  <p className="text-[10px] text-zinc-500">análisis</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sistema de insignias */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-800">
          <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-widest">Sistema de Insignias</h3>
        </div>
        <div className="flex overflow-x-auto md:grid md:grid-cols-5 md:overflow-visible divide-x divide-zinc-900 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
          {BADGE_TIERS.map(b => (
            <div key={b.label} className="flex-none w-[120px] md:w-auto flex flex-col items-center justify-center gap-2 py-5 md:py-6 px-2 text-center">
              <span className={`text-[11px] px-2.5 py-0.5 rounded-full uppercase tracking-wider font-medium ${getBadgeStyle(b.label)}`}>
                {b.label}
              </span>
              <span className="text-[10px] text-zinc-500">{b.req}</span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );

  if (!user) {
    return (
      <RequireLoginPanel 
        title="Acceso Requerido" 
        message="Debes iniciar sesión para ver la clasificación global." 
      >
        {content}
      </RequireLoginPanel>
    );
  }

  return content;
}
