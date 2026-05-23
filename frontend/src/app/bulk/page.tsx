import BulkAnalyzer from '@/features/bulk/components/BulkAnalyzer';
import Link from 'next/link';

export const metadata = {
  title: 'Análisis Masivo | PhishingScanner',
  description: 'Analiza hasta 50 URLs simultáneamente con IA y VirusTotal. Detecta phishing y amenazas en lote.',
};

export default function BulkPage() {
  return (
    <div className="min-h-screen bg-black text-[#ededed] font-sans selection:bg-[#333] selection:text-white pb-20">

      <header className="border-b border-[#333] bg-black/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <h1 className="text-sm font-medium tracking-wide text-white flex items-center gap-2" translate="no">
            <Link href="/" className="hover:text-zinc-300 transition-colors">PhishingScanner</Link> <span className="text-zinc-600">/</span> Análisis Masivo
          </h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-zinc-100 mb-1">Análisis Masivo</h2>
          <p className="text-sm text-zinc-600">Analiza URLs en lote usando IA y bases de datos</p>
        </div>
        <BulkAnalyzer />
      </main>
    </div>
  );
}
