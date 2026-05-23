import React from 'react';
import Link from 'next/link';
import AnalyzeForm from '@/features/analyzer/components/AnalyzeForm';
import ResultsPanel from '@/features/analyzer/components/ResultsPanel';
import HistoryPanel from '@/features/history/components/HistoryPanel';
import { UserProfile } from '@/components/auth/UserProfile';

export default function Home() {
  return (
    <div className="min-h-screen bg-black text-[#ededed] font-sans selection:bg-[#333] selection:text-white pb-20">
      
      {/* Navbar Súper Minimalista */}
      <header className="border-b border-[#333] bg-black/80 backdrop-blur-md sticky top-0 z-50 print:hidden">
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-3 sm:py-0 sm:h-14 flex flex-wrap items-center">
          
          <Link href="/" className="text-sm font-medium tracking-wide text-white" translate="no">
            PhishingScanner
          </Link>

          <nav className="flex items-center gap-5 w-full sm:w-auto order-3 sm:order-2 sm:ml-6 mt-3 sm:mt-0">
            <Link href="/bulk" className="text-xs text-zinc-400 hover:text-white transition-colors whitespace-nowrap">Análisis Masivo</Link>
            <Link href="/leaderboard" className="text-xs text-zinc-400 hover:text-white transition-colors whitespace-nowrap">Clasificación</Link>
          </nav>

          <div className="ml-auto order-2 sm:order-3">
            <UserProfile />
          </div>
          
        </div>
      </header>

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
