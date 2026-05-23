import BulkAnalyzer from '@/features/bulk/components/BulkAnalyzer';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Análisis en Bloque | PhishingScanner',
  description: 'Analiza hasta 50 URLs simultáneamente con IA y OSINT nativo. Detecta phishing y amenazas en lote.',
};

export default function BulkPage() {
  return (
    <div className="min-h-screen bg-black text-[#ededed] font-sans selection:bg-[#333] selection:text-white pb-20">
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-zinc-100 mb-1">Análisis en Bloque</h2>
          <p className="text-sm text-zinc-600">Analiza URLs en lote usando IA y bases de datos</p>
        </div>
        <BulkAnalyzer />
      </main>
    </div>
  );
}
