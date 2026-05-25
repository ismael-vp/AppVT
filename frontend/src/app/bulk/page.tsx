import BulkAnalyzer from '@/features/bulk/components/BulkAnalyzer';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Análisis en Bloque | PhishingScanner',
  description: 'Analiza hasta 50 URLs simultáneamente con IA y OSINT nativo.',
};

export default function BulkPage() {
  return (
    <div className="min-h-screen bg-[#080808] text-zinc-200 font-sans selection:bg-zinc-700 selection:text-white pb-24">
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        <div className="mb-8">
          <h1 className="text-xl font-semibold text-white tracking-tight">Análisis en Bloque</h1>
          <p className="text-sm text-zinc-500 mt-1">Analiza hasta 50 URLs con IA y OSINT</p>
        </div>
        <BulkAnalyzer />
      </main>
    </div>
  );
}
