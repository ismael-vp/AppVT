import React from 'react';
import { EyeOff, Fingerprint, DatabaseBackup, Lock } from 'lucide-react';
import { OSINTData } from '@/types';

interface PrivacyCardProps {
  osintData?: OSINTData | null;
}

export default function PrivacyCard({ osintData }: PrivacyCardProps) {
  const privacy = osintData?.privacy_analysis;
  
  if (!privacy) {
    return (
      <div className="mb-6">
        <h3 className="text-xs text-zinc-500 font-medium uppercase tracking-wider mb-4 flex items-center gap-2">
          <EyeOff size={14} />
          Privacidad y Rastreo
        </h3>
        <div className="bg-[#0d0d0d] border border-zinc-800/50 rounded-xl p-5 text-sm text-zinc-500 shadow-sm flex items-center gap-3">
          <div className="w-1.5 h-1.5 rounded-full bg-zinc-600 shrink-0" />
          No se pudo extraer información de rastreadores. Es posible que el sitio haya bloqueado nuestro escáner o tenga errores de conexión SSL (muy común en phishing).
        </div>
      </div>
    );
  }

  const hasTrackers = privacy.trackers_count > 0;
  const hasDataLinked = privacy.data_linked && privacy.data_linked.length > 0;
  const hasDeviceAccess = privacy.device_access && privacy.device_access.length > 0;

  return (
    <div className="mb-6">
      <h3 className="text-xs text-zinc-500 font-medium uppercase tracking-wider mb-4 flex items-center gap-2">
        <EyeOff size={14} />
        Privacidad y Rastreo
      </h3>
      
      <div className="bg-[#0d0d0d] border border-zinc-800/50 rounded-xl p-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Rastreadores */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Fingerprint size={16} className="text-zinc-400" />
              <h4 className="text-sm font-semibold text-zinc-200">Trackers Inyectados</h4>
            </div>
            {hasTrackers ? (
              <div className="flex flex-col gap-2 mt-3">
                <span className="text-xs text-zinc-400">
                  Detectamos <strong className="text-zinc-200">{privacy.trackers_count}</strong> tecnologías de rastreo.
                </span>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {privacy.tracking_used.map((tracker, i) => (
                    <span key={i} className="text-[10px] font-mono text-zinc-400 bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 rounded">
                      {tracker}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-zinc-600 mt-2">No se detectaron scripts de rastreo de terceros.</p>
            )}
          </div>

          {/* Extracción de Datos */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <DatabaseBackup size={16} className="text-zinc-400" />
              <h4 className="text-sm font-semibold text-zinc-200">Datos Extraídos</h4>
            </div>
            {hasDataLinked ? (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {privacy.data_linked.map((data, i) => (
                  <span key={i} className="text-[10px] font-mono text-zinc-400 bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 rounded">
                    {data}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-zinc-600 mt-2">No parece extraer datos personales visibles.</p>
            )}
          </div>

          {/* Acceso a Dispositivos */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Lock size={16} className="text-zinc-400" />
              <h4 className="text-sm font-semibold text-zinc-200">Acceso a Hardware</h4>
            </div>
            {hasDeviceAccess ? (
              <div className="flex flex-col gap-2 mt-3">
                <span className="text-xs text-zinc-400 leading-relaxed">
                  El sitio solicita permisos para acceder al hardware del usuario:
                </span>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {privacy.device_access.map((acc, i) => (
                    <span key={i} className="text-[10px] font-mono text-red-400 bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 rounded">
                      {acc}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-zinc-600 mt-2">No solicita acceso a la cámara, micrófono ni sensores.</p>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
