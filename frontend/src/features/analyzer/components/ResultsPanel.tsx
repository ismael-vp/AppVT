"use client";

import React, { useState } from 'react';
import { useThreatStore } from '@/store/useThreatStore';
import { useToastStore } from '@/store/useToast';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import SummaryTab from './ResultsComponents/tabs/SummaryTab';
import TechnicalTab from './ResultsComponents/tabs/TechnicalTab';
import CommunityTab from './tabs/CommunityTab';
import { ScanResult } from '@/types';
import ScriptModal from './ResultsComponents/ui/ScriptModal';
import { useAiChat } from '@/hooks/useAiChat';
import { useScriptAnalyzer } from '@/hooks/useScriptAnalyzer';
import ImagePhishingPanel from './ResultsComponents/tabs/ImagePhishingPanel';

import { ErrorBoundary } from '@/components/ui/ErrorBoundary';

function ResultsPanelInner({ isReadOnly }: { isReadOnly?: boolean }) {
  const { scanResult, error, resetState } = useThreatStore();
  const [activeTab, setActiveTab] = useState<'ai' | 'technical' | 'community'>('ai');

  // Bug #3 fix: useAiChat siempre se llama (regla de hooks), pero nunca con null —
  // si scanResult es null pasamos un objeto vacío para que scan_context llegue como {}
  const aiChat = useAiChat((scanResult ?? {}) as ScanResult);
  const scriptAnalyzer = useScriptAnalyzer();

  if (error) {
    return (
      <div className="w-full max-w-2xl mx-auto mt-6 bg-[#0d0d0d] border border-red-900/30 p-4 rounded-xl flex items-start gap-3">
        <AlertTriangle className="text-red-500/70 mt-0.5 shrink-0" size={16} />
        <div className="text-sm text-red-400/80">
          {typeof error === 'string' ? error : JSON.stringify(error)}
        </div>
      </div>
    );
  }

  if (!scanResult) return null;

  // --- Image analysis: renders its own dedicated panel ---
  if (scanResult.type === 'image') {
    return (
      <div className="w-full">
        <div className="flex justify-end mb-2 w-full max-w-5xl mx-auto">
          <button
            onClick={() => {
              if (isReadOnly) {
                window.location.href = '/';
              } else {
                resetState();
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }
            }}
            className="flex items-center space-x-2 bg-[#050505] text-[#888] border border-[#333] hover:text-white hover:bg-[#111] transition-colors text-xs font-medium py-1.5 px-3 rounded-md"
          >
            <RotateCcw size={14} />
            <span>Nuevo Análisis</span>
          </button>
        </div>
        {scanResult.image_analysis ? (
          <ImagePhishingPanel
            analysis={scanResult.image_analysis}
            imageName={scanResult.resourceName || 'Imagen Analizada'}
          />
        ) : (
          <div className="text-sm text-[#888] text-center mt-8">No se pudo obtener el análisis de la imagen.</div>
        )}
      </div>
    );
  }

  const stats = scanResult.stats;
  const maliciousCount = (stats?.malicious || 0) + (stats?.suspicious || 0);
  const isMalicious = maliciousCount > 0;

  return (
    <div className="w-full max-w-5xl mx-auto mt-8 animate-in fade-in slide-in-from-bottom-4 duration-700 relative">

      <div className="flex justify-end mb-3 gap-2">
        {!isReadOnly && (
          <button
            onClick={async () => {
              try {
                const id = await useThreatStore.getState().shareCurrentReport();
                if (id) {
                  const url = `${window.location.origin}/report/${id}`;
                  await navigator.clipboard.writeText(url);
                  useToastStore.getState().showToast('Enlace copiado al portapapeles', 'success');
                }
              } catch (err: unknown) {
                useToastStore.getState().showToast(err instanceof Error ? err.message : 'Error al compartir enlace', 'error');
              }
            }}
            className="flex items-center gap-2 text-zinc-500 hover:text-zinc-200 border border-zinc-800/60 hover:border-zinc-700 bg-[#0d0d0d] transition-colors text-xs font-medium py-1.5 px-3 rounded-lg"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
            Compartir
          </button>
        )}
        <button
          onClick={() => {
            if (isReadOnly) {
              window.location.href = '/';
            } else {
              resetState();
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }
          }}
          className="flex items-center gap-2 text-zinc-500 hover:text-zinc-200 border border-zinc-800/60 hover:border-zinc-700 bg-[#0d0d0d] transition-colors text-xs font-medium py-1.5 px-3 rounded-lg"
        >
          <RotateCcw size={13} />
          Nuevo análisis
        </button>
      </div>

      <div className="bg-[#0d0d0d] border border-zinc-800/50 rounded-xl overflow-hidden w-full">
        <div className="flex overflow-x-auto overflow-y-hidden whitespace-nowrap border-b border-zinc-800/50 px-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {(['ai', 'technical', 'community'] as const).map((tab) => {
            const labels = { ai: 'Resumen', technical: 'Datos Técnicos', community: 'Comunidad' };
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-3.5 px-5 text-sm font-medium flex items-center transition-all relative whitespace-nowrap ${
                  activeTab === tab ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {labels[tab]}
                {activeTab === tab && (
                  <span className="absolute bottom-0 left-0 w-full h-[2px] bg-white rounded-t-full" />
                )}
              </button>
            );
          })}
        </div>

        <div className="p-5 sm:p-8">
          {activeTab === 'ai' ? (
            <SummaryTab
              key={scanResult.resourceName}
              scanResult={scanResult}
              chatMessages={aiChat.chatMessages}
              chatInput={aiChat.chatInput}
              setChatInput={aiChat.setChatInput}
              isChatLoading={aiChat.isChatLoading}
              handleSendMessage={aiChat.handleSendMessage}
              handleClearChat={aiChat.handleClearChat}
              handleEditMessage={aiChat.handleEditMessage}
            />
          ) : activeTab === 'technical' ? (
            <TechnicalTab
              scanResult={scanResult}
              isMalicious={isMalicious}
              onExplainScript={scriptAnalyzer.handleExplainScript}
            />
          ) : (
            <CommunityTab targetResource={scanResult.resourceName || ''} />
          )}
        </div>
      </div>

      <ScriptModal
        selectedScript={scriptAnalyzer.selectedScript}
        scriptExplanation={scriptAnalyzer.scriptExplanation}
        isExplainingScript={scriptAnalyzer.isExplainingScript}
        onClose={scriptAnalyzer.closeScriptModal}
      />

    </div>
  );
}

export default function ResultsPanel({ isReadOnly }: { isReadOnly?: boolean }) {
  return (
    <div id="results-panel-wrapper">
      <ErrorBoundary>
        <ResultsPanelInner isReadOnly={isReadOnly} />
      </ErrorBoundary>
    </div>
  );
}
