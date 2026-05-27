import React from 'react';
import dynamic from 'next/dynamic';
import { ScanResult } from '@/types';
import TechStackCard from '@/features/analyzer/components/ResultsComponents/cards/TechStackCard';
import UrlMetadataCard from '@/features/analyzer/components/ResultsComponents/cards/UrlMetadataCard';
import ThreatIntelCard from '@/features/analyzer/components/ResultsComponents/cards/ThreatIntelCard';
import UrlAnatomyCard from '@/features/analyzer/components/ResultsComponents/cards/UrlAnatomyCard';
import PrivacyCard from '@/features/analyzer/components/ResultsComponents/cards/PrivacyCard';
import type { ThreatMapProps } from '@/features/threat-map/components/ThreatMap';

// Lazy-load ThreatMap: renderiza ~200 SVG paths síncronos que colapsan la CPU.
// Con dynamic + ssr:false lo movemos fuera del thread principal de render.
const ThreatMap = dynamic<ThreatMapProps>(() => import('@/features/threat-map/components/ThreatMap'), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full bg-[#050505] border border-[#333] rounded-md flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-[#333] border-t-[#ededed] rounded-full animate-spin" />
        <span className="text-xs text-[#555]">Cargando mapa...</span>
      </div>
    </div>
  ),
});

interface TechnicalTabProps {
  scanResult: ScanResult;
  isMalicious: boolean;
  onExplainScript: (url: string) => void;
}

export default function TechnicalTab({ scanResult, isMalicious, onExplainScript }: TechnicalTabProps) {
  const { type, osint_data, stats, resourceName } = scanResult;

  return (
    <div className="space-y-10 animate-in fade-in duration-500">

      {/* Sección: Metadatos (Solo URLs) */}
      {type === 'url' && (
        <UrlMetadataCard 
          resourceName={resourceName} 
          isMalicious={isMalicious} 
          osintData={osint_data} 
        />
      )}

      {/* Inteligencia de Amenazas y Estructura */}
      {type === 'url' && (
        <>
          <ThreatIntelCard osintData={osint_data} />
          <UrlAnatomyCard osintData={osint_data} />
        </>
      )}

      {/* Privacidad y Rastreo */}
      {type === 'url' && osint_data?.privacy_analysis && (
        <PrivacyCard osintData={osint_data} />
      )}

      {/* Mapa de Geolocalización (Solo URLs) — carga diferida para no bloquear el render */}
      {type === 'url' && osint_data?.geolocation?.lat && osint_data?.geolocation?.lon && (
        <div>
          <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider mb-4">Geolocalización</p>
          <div className="h-80 sm:h-[420px] w-full mb-6">
            <ThreatMap
              lat={osint_data.geolocation.lat}
              lon={osint_data.geolocation.lon}
              label={osint_data.geolocation.city || osint_data.geolocation.countryCode}
              isp={osint_data.geolocation.isp}
            />
          </div>
        </div>
      )}

      {/* Tech Stack y Scripts */}
      {type === 'url' && osint_data && (
        <TechStackCard 
          externalScripts={osint_data.external_scripts} 
          onExplainScript={onExplainScript} 
        />
      )}

      {/* Fin de los componentes */}

    </div>
  );
}
