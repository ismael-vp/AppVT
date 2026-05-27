import React from 'react';
import { Network, Link2, AlertTriangle, AlertCircle, ShieldAlert } from 'lucide-react';
import { OSINTData } from '@/types';

interface UrlAnatomyCardProps {
  osintData?: OSINTData | null;
}

export default function UrlAnatomyCard({ osintData }: UrlAnatomyCardProps) {
  const flags = osintData?.heuristic_result?.flags || [];
  
  const is_ip = flags.some(f => f.includes('IS_IP'));
  const suspicious_tld = flags.some(f => f.includes('SUSPICIOUS_TLD'));
  const excessive_subdomains = flags.some(f => f.includes('EXCESSIVE_SUBDOMAINS'));
  const excessive_hyphens = flags.some(f => f.includes('MULTIPLE_HYPHENS'));
  const length_warning = flags.some(f => f.includes('URL_TOO_LONG'));
  
  const keywords = flags
    .filter(f => f.startsWith('SUSPICIOUS_KEYWORD'))
    .map(f => f.replace('SUSPICIOUS_KEYWORD (', '').replace(')', ''));
    
  const freeHostingFlag = flags.find(f => f.startsWith('ABUSED_FREE_HOSTING'));

  const features = [
    { label: 'Dominio es una IP', value: is_ip, icon: <Network size={14} />, alert: is_ip },
    { label: 'TLD Sospechoso', value: suspicious_tld, icon: <AlertTriangle size={14} />, alert: suspicious_tld },
    { label: 'Exceso de subdominios', value: excessive_subdomains, icon: <Link2 size={14} />, alert: excessive_subdomains },
    { label: 'Múltiples guiones', value: excessive_hyphens, icon: <AlertCircle size={14} />, alert: excessive_hyphens },
    { label: 'URL muy larga', value: length_warning, icon: <AlertCircle size={14} />, alert: length_warning }
  ];

  const hasKeywords = keywords.length > 0;
  const hasAlerts = features.some(f => f.alert) || hasKeywords || freeHostingFlag;

  if (!hasAlerts && !osintData?.is_typosquatting) {
    return null;
  }

  return (
    <div className="mb-6">
      <h3 className="text-xs text-zinc-500 font-medium uppercase tracking-wider mb-4 flex items-center gap-2">
        <Link2 size={14} />
        Anatomía de la URL
      </h3>
      
      <div className="bg-[#0d0d0d] border border-zinc-800/50 rounded-xl p-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Indicadores Estructurales */}
          <div>
            <h4 className="text-[11px] text-zinc-500 uppercase font-semibold mb-3 tracking-wider">Métricas Estructurales</h4>
            <div className="flex flex-col gap-2">
              {features.map((feat, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 rounded bg-black/40 border border-white/5">
                  <div className="flex items-center gap-2 text-zinc-300 text-xs">
                    <span className={feat.alert ? 'text-red-400' : 'text-zinc-600'}>
                      {feat.icon}
                    </span>
                    {feat.label}
                  </div>
                  <span className={`text-[10px] uppercase font-mono font-bold px-1.5 py-0.5 rounded ${
                    feat.alert
                      ? 'bg-zinc-900 text-red-400 border border-zinc-800'
                      : 'bg-zinc-900 text-zinc-500 border border-zinc-800'
                  }`}>
                    {feat.value ? 'Sí' : 'No'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Hallazgos Heurísticos */}
          <div>
            <h4 className="text-[11px] text-zinc-500 uppercase font-semibold mb-3 tracking-wider">Heurística &amp; Typosquatting</h4>
            <div className="flex flex-col gap-3">
              
              {hasKeywords && (
                <div className="flex items-start gap-2 p-3 bg-black/40 border border-zinc-800/60 rounded-lg">
                  <AlertTriangle size={14} className="text-orange-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-zinc-300 mb-1">Palabras clave de engaño detectadas:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {keywords.map((kw, i) => (
                        <span key={i} className="text-[10px] font-mono text-zinc-400 bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 rounded">
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {freeHostingFlag && (
                <div className="flex items-start gap-2 p-3 bg-black/40 border border-zinc-800/60 rounded-lg">
                  <ShieldAlert size={14} className="text-yellow-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-zinc-300 font-semibold mb-0.5">Alerta de Hosting Gratuito</p>
                    <p className="text-[11px] text-zinc-500 leading-relaxed">
                      La URL se aloja en un proveedor gratuito: <span className="font-mono text-zinc-400">{freeHostingFlag.replace('ABUSED_FREE_HOSTING (', '').replace(')', '')}</span>. Esto es frecuente en ataques de phishing.
                    </p>
                  </div>
                </div>
              )}

              {osintData?.is_typosquatting && osintData?.target_brand && (
                <div className="flex items-start gap-2 p-3 bg-black/40 border border-zinc-800/60 rounded-lg">
                  <AlertTriangle size={14} className="text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-zinc-300 font-semibold mb-0.5">Typosquatting Detectado</p>
                    <p className="text-[11px] text-zinc-500 leading-relaxed">
                      Este dominio intenta suplantar a la marca protegida <span className="font-mono text-zinc-300 bg-zinc-900 border border-zinc-800 px-1 rounded">{osintData.target_brand}</span>.
                    </p>
                  </div>
                </div>
              )}

              {!hasKeywords && !freeHostingFlag && !osintData?.is_typosquatting && (
                <div className="text-xs text-zinc-600 italic px-2">
                  No se detectó typosquatting ni keywords peligrosas.
                </div>
              )}

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
