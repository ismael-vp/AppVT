import React from 'react';
import { OSINTData } from '@/types';
import { useToastStore } from '@/store/useToast';

const getFlagEmoji = (countryCode?: string) => {
  if (!countryCode) return '';
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
};

interface UrlMetadataCardProps {
  resourceName?: string;
  isMalicious: boolean;
  osintData?: OSINTData | null;
}

export default function UrlMetadataCard({ resourceName, isMalicious, osintData }: UrlMetadataCardProps) {
  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 p-6 border border-zinc-800/50 rounded-xl bg-[#0d0d0d] mb-6">
        
        {/* Recurso */}
        <div className="flex flex-col gap-1.5 col-span-1 md:col-span-2">
          <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Recurso</span>
          <div className="flex items-center gap-3">
            <span className="text-sm text-zinc-200 font-medium font-mono truncate max-w-[260px] md:max-w-md">
              {resourceName || '—'}
            </span>
            <button
              onClick={() => {
                if (resourceName) {
                  const defanged = resourceName.replace(/http/gi, 'hxxp').replace(/\./g, '[.]');
                  navigator.clipboard.writeText(defanged);
                  useToastStore.getState().showToast('URL segura copiada', 'success');
                }
              }}
              className="text-[10px] uppercase font-bold px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 rounded-md transition-colors border border-zinc-800/60"
            >
              Defang
            </button>
          </div>
        </div>

        {/* Categoría */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Categoría</span>
          <span className="text-sm text-zinc-200 font-medium">{isMalicious ? 'Phishing / Malware' : 'Benigno'}</span>
        </div>

        {/* IP */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] text-zinc-500 uppercase tracking-wider">IP</span>
          {osintData?.geolocation ? (
            <div className="flex flex-col gap-0.5">
              <span className="text-sm text-zinc-200 font-medium font-mono">{osintData.geolocation.ip}</span>
              <span className="text-[10px] text-zinc-500 truncate" title={`${osintData.geolocation.country} - ${osintData.geolocation.isp}`}>
                {getFlagEmoji(osintData.geolocation.countryCode)} {osintData.geolocation.isp}
              </span>
            </div>
          ) : (
            <span className="text-sm text-zinc-500">Desconocida</span>
          )}
        </div>

        {/* Reputación */}
        {osintData?.abuseConfidenceScore !== undefined && osintData.abuseConfidenceScore !== null && (
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Reputación IP</span>
            <div className="flex items-center gap-2">
              {osintData.abuseConfidenceScore === 0 ? (
                <span className="text-sm text-zinc-200 font-medium">0% (Limpia)</span>
              ) : osintData.abuseConfidenceScore > 50 ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-red-400 font-medium">{osintData.abuseConfidenceScore}%</span>
                  <span className="bg-red-900/40 text-red-400 text-[10px] uppercase font-bold px-1.5 py-0.5 rounded border border-red-800/50">Maliciosa</span>
                </div>
              ) : (
                <span className="text-sm text-amber-400 font-medium">{osintData.abuseConfidenceScore}%</span>
              )}
              <span className="text-[10px] text-zinc-600">({osintData.totalReports || 0} rep.)</span>
            </div>
          </div>
        )}

        {/* WHOIS */}
        {osintData?.whois && (
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Registrador</span>
            <span className="text-sm text-zinc-200 font-medium truncate" title={osintData.whois.registrar || 'Privado'}>
              {osintData.whois.registrar || 'Privado'}
            </span>
          </div>
        )}

        {/* SSL */}
        {osintData?.ssl && (
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider">SSL</span>
            <span className="text-sm text-zinc-200 font-medium truncate" title={osintData.ssl.issuer || 'Desconocido'}>
              {osintData.ssl.issuer || 'Desconocido'}
            </span>
          </div>
        )}

      </div>
    </div>
  );
}
