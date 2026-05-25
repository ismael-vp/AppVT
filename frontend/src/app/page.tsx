import React from 'react';
import AnalyzeForm from '@/features/analyzer/components/AnalyzeForm';
import ResultsPanel from '@/features/analyzer/components/ResultsPanel';
import HistoryPanel from '@/features/history/components/HistoryPanel';

export default function Home() {
  return (
    <div className="min-h-screen bg-[#080808] text-zinc-200 font-sans selection:bg-zinc-700 selection:text-white pb-24">
      <main className="flex w-full max-w-5xl mx-auto px-4 py-16 md:px-6 flex-col items-center">
        <div className="w-full space-y-5">
          <AnalyzeForm />
          <ResultsPanel />
          <HistoryPanel />
        </div>
      </main>
    </div>
  );
}
