import React from 'react';
import { ShieldAlert, AlertTriangle, Database } from 'lucide-react';
import { OSINTData } from '@/types';

interface ThreatIntelCardProps {
  osintData?: OSINTData | null;
}

export default function ThreatIntelCard({ osintData }: ThreatIntelCardProps) {
  if (!osintData) return null;

  const hasFeed = osintData.feed_detected === true;
  const spamhausListed = osintData.dns?.spamhaus_listed === true;
  const surblListed = osintData.dns?.surbl_listed === true;
  const hasDnsBlacklist = spamhausListed || surblListed;
  const blacklistDetails = osintData.dns?.blacklist_details || [];

  if (!hasFeed && !hasDnsBlacklist) return null;

  return (
    <div className="mb-6">
      <h3 className="text-xs text-zinc-500 font-medium uppercase tracking-wider mb-4 flex items-center gap-2">
        <Database size={14} />
        Inteligencia de Amenazas (Feeds & DNS)
      </h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* ── Feed local (OpenPhish) ─────────────────────── */}
        {hasFeed && (
          <div className="flex items-start gap-3 bg-[#0d0d0d] border border-zinc-800/50 rounded-xl p-5">
            <div className="shrink-0 mt-0.5 p-2 rounded-lg bg-zinc-900 border border-zinc-800">
              <AlertTriangle size={18} className="text-orange-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-2">
                <p className="text-sm font-semibold text-zinc-200">
                  Base de datos de Phishing
                </p>
                <span className="shrink-0 text-[10px] font-mono uppercase tracking-widest text-zinc-400 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
                  {osintData.feed_source ?? 'Feed local'}
                </span>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Esta URL coincide exactamente con una entrada reportada en{' '}
                <span className="font-medium text-zinc-300">{osintData.feed_source ?? 'una base de datos de phishing conocida'}</span>.
                {osintData.feed_source === 'OpenPhish' && ' OpenPhish actualiza su feed cada pocas horas con nuevas URLs activas de phishing.'}
              </p>
            </div>
          </div>
        )}

        {/* ── DNS Blacklists (Spamhaus / SURBL) ────────────────────── */}
        {hasDnsBlacklist && (
          <div className="flex items-start gap-3 bg-[#0d0d0d] border border-zinc-800/50 rounded-xl p-5">
            <div className="shrink-0 mt-0.5 p-2 rounded-lg bg-zinc-900 border border-zinc-800">
              <ShieldAlert size={18} className="text-yellow-500" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-2">
                <p className="text-sm font-semibold text-zinc-200">
                  Lista Negra DNS
                </p>
                <div className="flex gap-1 shrink-0">
                  {spamhausListed && (
                    <span className="text-[10px] font-mono text-zinc-400 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
                      Spamhaus
                    </span>
                  )}
                  {surblListed && (
                    <span className="text-[10px] font-mono text-zinc-400 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
                      SURBL
                    </span>
                  )}
                </div>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed mb-3">
                El dominio está listado en una blacklist DNS usada globalmente para filtrar spam, malware y phishing.
              </p>
              {blacklistDetails.length > 0 && (
                <div className="flex flex-col gap-1.5 p-2.5 bg-black/40 rounded-lg border border-white/5">
                  {blacklistDetails.map((detail, i) => (
                    <span key={i} className="text-[11px] text-zinc-500 font-mono break-all">
                      › {detail}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
