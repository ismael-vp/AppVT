import React from 'react';
import AnalyzeForm from '@/features/analyzer/components/AnalyzeForm';
import ResultsPanel from '@/features/analyzer/components/ResultsPanel';
import HistoryPanel from '@/features/history/components/HistoryPanel';
import { ShieldAlert, Monitor } from 'lucide-react';
import { UserProfile } from '@/components/auth/UserProfile';

function MobileBlockScreen() {
  return (
    <div className="fixed inset-0 z-[999] bg-black flex flex-col items-center justify-center px-8 text-center md:hidden print:hidden">
      <ShieldAlert size={48} className="text-zinc-600 mb-6" />
      <h2 className="text-lg font-semibold text-zinc-200 mb-3">Acceso Restringido</h2>
      <p className="text-sm text-zinc-500 leading-relaxed max-w-xs mb-6">
        PhishingScanner está diseñado para su uso en ordenadores de escritorio.
        Para una experiencia completa, accede desde un PC o portátil.
      </p>
      <div className="flex items-center space-x-2 text-zinc-600 text-xs">
        <Monitor size={14} />
        <span>Se requiere una pantalla de al menos 768px</span>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen bg-black text-[#ededed] font-sans selection:bg-[#333] selection:text-white pb-20">
      
      {/* Panel de bloqueo en móvil */}
      <MobileBlockScreen />

      {/* Navbar Súper Minimalista */}
      <header className="border-b border-[#333] bg-black/80 backdrop-blur-md sticky top-0 z-50 print:hidden">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <h1 className="text-sm font-medium tracking-wide text-white" translate="no">
              PhishingScanner
            </h1>
          </div>
          <UserProfile />
        </div>
      </header>

      {/* Contenido Principal */}
      <main className="flex w-full max-w-5xl mx-auto px-6 py-16 flex-col items-center">
        
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
