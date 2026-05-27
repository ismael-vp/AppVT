import React from 'react';
import { ShieldAlert, AlertTriangle } from 'lucide-react';

interface ThreatDetectionBannerProps {
  safeBrowsingThreat?: boolean;
  safeBrowsingTypes?: string[];
  safeBrowsingChecked?: boolean;
  feedDetected?: boolean;
  feedSource?: string | null;
  spamhausListed?: boolean;
  surblListed?: boolean;
  blacklistDetails?: string[];
}

const THREAT_TYPE_LABELS: Record<string, string> = {
  MALWARE: 'Malware',
  SOCIAL_ENGINEERING: 'Phishing / Ingeniería Social',
  UNWANTED_SOFTWARE: 'Software no deseado',
  POTENTIALLY_HARMFUL_APPLICATION: 'Aplicación potencialmente dañina',
};

function translateThreatType(type: string): string {
  return THREAT_TYPE_LABELS[type] ?? type;
}

export default function ThreatDetectionBanner({
  safeBrowsingThreat,
  safeBrowsingTypes = [],
  safeBrowsingChecked,
  feedDetected,
  feedSource,
  spamhausListed,
  surblListed,
  blacklistDetails = [],
}: ThreatDetectionBannerProps) {
  const hasSafeBrowsing = safeBrowsingThreat === true;

  if (!hasSafeBrowsing && !safeBrowsingChecked) return null;

  return (
    <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-top-2 duration-500">

      {/* ── Google Safe Browsing ─────────────────────────────────── */}
      {hasSafeBrowsing && (
        <div className="flex items-start gap-3 bg-red-950/30 border border-red-500/30 rounded-xl p-4">
          <div className="shrink-0 mt-0.5 p-1.5 rounded-lg bg-red-500/10 border border-red-500/20">
            <ShieldAlert size={16} className="text-red-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1">
              <p className="text-sm font-semibold text-red-300">
                Bloqueado por Google Safe Browsing
              </p>
              <span className="shrink-0 text-[10px] font-mono uppercase tracking-widest text-red-400/80 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20">
                Confirmado
              </span>
            </div>
            <p className="text-xs text-red-400/70 leading-relaxed mb-2">
              Esta URL está en la base de datos de amenazas de Google, usada por Chrome, Firefox y Safari para proteger a más de 5.000 millones de usuarios.
            </p>
            {safeBrowsingTypes.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {safeBrowsingTypes.map((type) => (
                  <span
                    key={type}
                    className="text-[10px] bg-red-500/10 border border-red-500/20 text-red-300 px-2 py-0.5 rounded-md font-mono"
                  >
                    {translateThreatType(type)}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Nota si GSB fue consultada y dio limpio ─────────────── */}
      {safeBrowsingChecked && !hasSafeBrowsing && (
        <div className="flex items-center gap-2 text-[11px] text-zinc-600 px-1">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-600/50 shrink-0" />
          Verificado por Google Safe Browsing · Sin amenazas conocidas
        </div>
      )}
    </div>
  );
}
