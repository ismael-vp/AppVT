import React from 'react';
import AnalyzeForm from '@/features/analyzer/components/AnalyzeForm';
import ResultsPanel from '@/features/analyzer/components/ResultsPanel';
import HistoryPanel from '@/features/history/components/HistoryPanel';

export default function Home() {
  return (
    <div className="min-h-screen bg-black text-[#ededed] font-sans selection:bg-[#333] selection:text-white pb-20">
      
      {/* Contenido Principal */}
      <main className="flex w-full max-w-5xl mx-auto px-4 py-8 md:px-6 md:py-16 flex-col items-center">
        
        {/* Zona de Trabajo */}
        <div className="w-full space-y-6">
          <AnalyzeForm />
          <ResultsPanel />
          <HistoryPanel />
        </div>

      </main>

    </div>
  );
}
