import React from 'react';

import { ScanResult } from '@/types';
import UrlAnatomyCard from '@/features/analyzer/components/ResultsComponents/cards/UrlAnatomyCard';
import HeuristicRiskCard from '@/features/analyzer/components/ResultsComponents/cards/HeuristicRiskCard';

import SecurityVerdict from '@/features/analyzer/components/ResultsComponents/ui/SecurityVerdict';
import AiChatPanel from '@/features/analyzer/components/ResultsComponents/ui/AiChatPanel';
import SecureCaptureCard from '@/features/analyzer/components/ResultsComponents/cards/SecureCaptureCard';

import { ChatMessage } from '@/store/useThreatStore';

interface SummaryTabProps {
  scanResult: ScanResult;
  chatMessages: ChatMessage[];
  chatInput: string;
  setChatInput: (val: string) => void;
  isChatLoading: boolean;
  handleSendMessage: (e?: React.FormEvent) => void;
  handleClearChat?: () => void;
  handleEditMessage?: (index: number) => void;
}

export default function SummaryTab({
  scanResult,
  chatMessages,
  chatInput,
  setChatInput,
  isChatLoading,
  handleSendMessage,
  handleClearChat,
  handleEditMessage
}: SummaryTabProps) {
  const { ai_summary, osint_data, type } = scanResult;

  // Formateo de URL Obligatorio y seguro (preferimos https por defecto)
  const safeUrl = scanResult.resourceName 
    ? (scanResult.resourceName.startsWith('http') ? scanResult.resourceName : `https://${scanResult.resourceName}`)
    : '';

  return (
    <div className="space-y-10 animate-in fade-in duration-500">
      {/* Cabecera del Veredicto */}
      <div className="flex flex-col gap-4">
        <SecurityVerdict scanResult={scanResult} />
      </div>

      {/* Bloque de Evidencias Técnicas */}
      <div className="flex flex-col gap-6">
        {/* Componente Unificado de Alertas de Riesgo */}
        <HeuristicRiskCard 
          hasDangerousForm={osint_data?.has_dangerous_form}
          isTyposquatting={osint_data?.is_typosquatting}
          targetBrand={osint_data?.target_brand}
          hostname={scanResult.resourceName}
        />

        {/* Fallback para Análisis de Anatomía (Legacy) */}
        {type === 'url' && !osint_data?.heuristic_result && osint_data?.url_anatomy && (
          <UrlAnatomyCard 
            anatomy={osint_data.url_anatomy} 
            isTyposquatting={osint_data.is_typosquatting}
          />
        )}


        {/* Cadena de Redirecciones (Solo URLs con redirecciones) */}
        {type === 'url' && osint_data?.redirect_chain && (osint_data?.redirect_chain?.length ?? 0) > 1 && (
          <div className="animate-in fade-in duration-500">
            <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider mb-3">Cadena de redirecciones</p>
            <div className="bg-[#0d0d0d] border border-zinc-800/50 rounded-xl p-5">
              <div className="flex flex-col gap-4 relative">
                <div className="absolute top-2 bottom-2 left-[8px] w-px bg-zinc-800/60 z-0" />
                {osint_data?.redirect_chain?.map((link: string, idx: number, arr: string[]) => {
                  const isLast = idx === arr.length - 1;
                  return (
                    <div key={idx} className="flex items-center gap-3 relative z-10">
                      <div className={`shrink-0 w-4 h-4 rounded-full flex items-center justify-center ${isLast ? 'bg-white' : 'bg-[#0d0d0d] border border-zinc-700'}`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${isLast ? 'bg-black' : 'bg-zinc-600'}`} />
                      </div>
                      <span className={`text-xs font-mono truncate ${isLast ? 'text-zinc-200' : 'text-zinc-500'}`} title={link}>{link}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Captura Multi-Dispositivo (Cloaking) */}
        {type === 'url' && (
          <SecureCaptureCard osintData={osint_data} safeUrl={safeUrl} />
        )}
      </div>


      {/* Resumen IA */}
      <div className="border-l-2 border-zinc-800 pl-4 py-1">
        <p className="text-sm text-zinc-400 leading-relaxed whitespace-pre-wrap">
          {ai_summary 
            ? (typeof ai_summary === 'string' ? ai_summary : (ai_summary?.summary || 'Resumen no disponible.')) 
            : 'Resumen no disponible.'}
        </p>
      </div>

      {/* Acciones Recomendadas */}
      {ai_summary && typeof ai_summary !== 'string' && ai_summary?.action_steps && Array.isArray(ai_summary.action_steps) && ai_summary.action_steps.length > 0 && (
        <div className="border-t border-zinc-800/50 pt-5 animate-in fade-in duration-500">
          <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider mb-3">Acciones recomendadas</p>
          <ul className="space-y-2">
            {ai_summary.action_steps.map((step: string, idx: number) => (
              <li key={idx} className="flex items-start gap-2.5">
                <span className="text-zinc-700 mt-1 shrink-0 text-xs">—</span>
                <span className="text-sm text-zinc-400">{step}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Chat Contextual Integrado */}
      <div className="print:hidden">
        <AiChatPanel
          chatMessages={chatMessages}
          chatInput={chatInput}
          setChatInput={setChatInput}
          isChatLoading={isChatLoading}
          handleSendMessage={handleSendMessage}
          handleClearChat={handleClearChat}
          handleEditMessage={handleEditMessage}
          placeholder="Ej. ¿Qué significa que haya devuelto timeout?"
          emptyStateMessage="Puedes pedirle aclaraciones técnicas sobre el reporte."
        />
      </div>

    </div>
  );
}