"use client";

import React, { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useThreatStore } from '@/store/useThreatStore';
import { useToastStore } from '@/store/useToast';
import { AlertTriangle, RotateCcw, Share2 } from 'lucide-react';
import SummaryTab from './ResultsComponents/tabs/SummaryTab';
import TechnicalTab from './ResultsComponents/tabs/TechnicalTab';
import CommunityTab from './tabs/CommunityTab';
import { ScanResult } from '@/types';
import ScriptModal from './ResultsComponents/ui/ScriptModal';
import { useAiChat } from '@/hooks/useAiChat';
import { useScriptAnalyzer } from '@/hooks/useScriptAnalyzer';
import ImagePhishingPanel from './ResultsComponents/tabs/ImagePhishingPanel';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { ErrorBoundary } from '@/components/ui/ErrorBoundary';

function ResultsPanelInner({ isReadOnly }: { isReadOnly?: boolean }) {
  const { scanResult, error, resetState } = useThreatStore(
    useShallow((state) => ({
      scanResult: state.scanResult,
      error: state.error,
      resetState: state.resetState,
    }))
  );
  const [activeTab, setActiveTab] = useState<'ai' | 'technical' | 'community'>('ai');

  const aiChat = useAiChat(scanResult);
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
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (isReadOnly) {
                window.location.href = '/';
              } else {
                resetState();
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }
            }}
          >
            <RotateCcw size={14} />
            <span>Nuevo Análisis</span>
          </Button>
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
          <Button
            variant="outline"
            size="sm"
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
          >
            <Share2 size={13} />
            Compartir
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            if (isReadOnly) {
              window.location.href = '/';
            } else {
              resetState();
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }
          }}
        >
          <RotateCcw size={13} />
          Nuevo análisis
        </Button>
      </div>

      <div className="bg-[#0d0d0d] border border-zinc-800/50 rounded-xl overflow-hidden w-full">
        <div className="flex overflow-x-auto overflow-y-hidden whitespace-nowrap border-b border-zinc-800/50 px-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {(['ai', 'technical', 'community'] as const).map((tab) => {
            const labels = { ai: 'Resumen', technical: 'Datos Técnicos', community: 'Comunidad' };
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "py-3.5 px-5 text-sm font-medium flex items-center transition-all relative whitespace-nowrap",
                  activeTab === tab ? "text-white" : "text-zinc-500 hover:text-zinc-300"
                )}
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
              aiChat={aiChat}
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
