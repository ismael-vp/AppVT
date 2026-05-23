import React from 'react';
import { ShieldAlert, ShieldCheck, Shield, Activity } from 'lucide-react';
import { ScanResult } from '@/types';

interface SecurityVerdictProps {
  scanResult: ScanResult;
}

export default function SecurityVerdict({ scanResult }: SecurityVerdictProps) {
  const osint = scanResult.osint_data;
  const stats = scanResult.stats;

  const heuristicResult = osint?.heuristic_result;
  const flags = heuristicResult?.flags || [];
  
  // Depender de la longitud del array de indicadores para evitar desincronizaciones
  const maliciousCount = flags.length > 0 ? flags.length : ((stats?.malicious || 0) + (stats?.suspicious || 0));
  const hasAlerts = maliciousCount > 0;
  
  const riskScore = heuristicResult?.risk_score ?? 0;
  const level = heuristicResult?.level || 'LOW';

  const getLevelColor = (lvl: string) => {
    switch (lvl.toUpperCase()) {
      case 'CRITICAL': return 'text-red-500 border-red-500/20 bg-red-500/5';
      case 'MEDIUM': return 'text-orange-500 border-orange-500/20 bg-orange-500/5';
      case 'LOW': return 'text-green-500 border-green-500/20 bg-green-500/5';
      default: return 'text-zinc-500 border-zinc-500/20 bg-zinc-500/5';
    }
  };

  const getLevelIcon = (lvl: string) => {
    switch (lvl.toUpperCase()) {
      case 'CRITICAL': return <ShieldAlert size={18} className="text-red-500" />;
      case 'MEDIUM': return <Shield size={18} className="text-orange-500" />;
      case 'LOW': return <ShieldCheck size={18} className="text-green-500" />;
      default: return <Activity size={18} className="text-zinc-500" />;
    }
  };

  const getLevelLabel = (lvl: string) => {
    switch (lvl.toUpperCase()) {
      case 'CRITICAL': return 'CRÍTICO';
      case 'MEDIUM': return 'MEDIO';
      case 'LOW': return 'BAJO';
      default: return lvl;
    }
  };

  // Un sitio es CRÍTICO (Rojo) si hay más de 2 motores O hay un hallazgo grave (Formulario/Cloaking/Typosquatting)
  const isCritical =
    riskScore >= 70 ||
    level === 'CRITICAL' ||
    maliciousCount >= 3 ||
    osint?.has_dangerous_form ||
    osint?.cloaking_detected ||
    osint?.is_typosquatting;

  // Un sitio es SOSPECHOSO (Naranja) si tiene alguna alerta menor
  const isDangerous =
    isCritical ||
    riskScore >= 25 ||
    hasAlerts ||
    (osint?.abuseConfidenceScore && osint.abuseConfidenceScore >= 25) ||
    osint?.url_anatomy?.hosting_brand_alert;

  let verdictDescription = 'No hemos encontrado problemas de seguridad en este enlace.';

  if (isDangerous) {
    if (osint?.has_dangerous_form) {
      verdictDescription = 'Este sitio contiene un formulario que solicita datos sensibles de forma sospechosa. Es una señal clara de intento de robo de identidad.';
    } else if (osint?.is_typosquatting) {
      verdictDescription = 'Este dominio suplanta la identidad de una marca conocida. Es un sitio falso diseñado para engañarte.';
    } else if (osint?.cloaking_detected) {
      verdictDescription = 'Hemos detectado técnicas de "Cloaking": el sitio intenta ocultar su verdadero contenido. Señal de fraude.';
    } else if (hasAlerts) {
      verdictDescription = maliciousCount === 1
        ? 'Un indicador de seguridad ha detectado problemas en este sitio. Procede con precaución.'
        : `Un total de ${maliciousCount} indicadores de seguridad han detectado amenazas en este sitio. Evita visitarlo.`;
    } else {
      verdictDescription = 'Hemos encontrado señales de comportamiento atípico que sugieren que este sitio podría no ser seguro.';
    }
  }

  return (
    <div className="animate-in slide-in-from-top-4 duration-700">
      <div className="flex items-center space-x-4 mb-3">
        <div className={`p-2 rounded-xl border ${isCritical ? 'bg-red-500/5 border-red-500/20' :
            isDangerous ? 'bg-orange-500/5 border-orange-500/20' :
              'bg-green-500/5 border-green-500/20'
          }`}>
          {isCritical ? (
            <ShieldAlert size={32} className="text-red-500" />
          ) : isDangerous ? (
            <ShieldAlert size={32} className="text-orange-500" />
          ) : (
            <ShieldCheck size={32} className="text-green-500" />
          )}
        </div>
        <div className="flex flex-col">
          <div className="flex items-center space-x-3">
            <h2 className="text-2xl font-bold text-white tracking-tight">
              {isCritical ? 'Sitio Inseguro' : isDangerous ? 'Riesgo Detectado' : 'Sitio Seguro'}
            </h2>
            <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold uppercase tracking-widest ${isCritical ? 'text-red-500 border-red-500/20 bg-red-500/10' :
                isDangerous ? 'text-orange-500 border-orange-500/20 bg-orange-500/10' :
                  'text-green-500 border-green-500/20 bg-green-500/10'
              }`}>
              {isCritical ? 'Riesgo Alto' : isDangerous ? 'Riesgo Medio' : 'Seguro'}
            </span>
          </div>
          <p className="text-zinc-500 text-sm mt-1">
            Resultado de Seguridad
          </p>
        </div>
      </div>

      <div className="pl-[60px]">
        <p className="text-zinc-400 text-base leading-relaxed">
          {verdictDescription}
        </p>

        {heuristicResult && (
          <div className="mt-6 border-t border-zinc-800/50 pt-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="relative flex items-center justify-center">
                  <svg className="size-16 transform -rotate-90">
                    <circle
                      cx="32"
                      cy="32"
                      r="28"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="transparent"
                      className="text-zinc-800/50"
                    />
                    <circle
                      cx="32"
                      cy="32"
                      r="28"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="transparent"
                      strokeDasharray={175.92}
                      strokeDashoffset={175.92 - (175.92 * riskScore) / 100}
                      className={`${riskScore >= 70 ? 'text-red-500' : riskScore >= 40 ? 'text-orange-500' : 'text-green-500'} transition-all duration-1000 ease-out`}
                    />
                  </svg>
                  <span className="absolute text-sm font-bold text-white">{riskScore}</span>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    {getLevelIcon(level)}
                    <span className={`text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded border ${getLevelColor(level)}`}>
                      Nivel {getLevelLabel(level)}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400">Puntuación de riesgo heurístico</p>
                </div>
              </div>

              <div className="hidden md:block h-12 w-[1px] bg-zinc-800"></div>

              <div className="flex-1">
                <p className="text-xs text-zinc-400 mb-2 font-medium uppercase tracking-tight">
                  Indicadores Detectados ({flags.length})
                </p>
                <div className="flex flex-wrap gap-2">
                  {flags.length > 0 ? (
                    flags.map((flag) => (
                      <span key={flag} className="text-[10px] bg-zinc-900 border border-zinc-800 text-zinc-300 px-2 py-1 rounded">
                        {flag}
                      </span>
                    ))
                  ) : (
                    <span className="text-[10px] text-zinc-500 italic">No se detectaron anomalías heurísticas significativas.</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
