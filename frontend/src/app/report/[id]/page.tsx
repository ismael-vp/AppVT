import { supabase } from '@/lib/supabase';
import ReportClientView from './ReportClientView';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Shield } from 'lucide-react';

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  const { data, error } = await supabase
    .from('scan_reports')
    .select('*')
    .eq('id', id)
    .eq('is_public', true)
    .single();

  if (error || !data) {
    console.error("Error fetching report:", error);
    return notFound();
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#ededed] font-sans selection:bg-[#333] selection:text-white pb-20">
      <header className="border-b border-zinc-800/80 bg-black/80 backdrop-blur-md sticky top-0 z-10 print:hidden">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-3 group">
            <div className="w-8 h-8 bg-zinc-900 border border-zinc-800 rounded-lg flex items-center justify-center group-hover:border-zinc-600 transition-colors">
              <Shield size={16} className="text-zinc-400 group-hover:text-white transition-colors" />
            </div>
            <span className="font-semibold text-sm tracking-wide text-zinc-100">
              PhishingScanner <span className="text-zinc-600 font-normal ml-2 tracking-normal">Reporte Público</span>
            </span>
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 pt-8">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-white mb-2">Reporte de Seguridad Compartido</h1>
          <p className="text-zinc-400 text-sm">
            Este análisis fue realizado el {new Date(data.created_at).toLocaleDateString()} a las {new Date(data.created_at).toLocaleTimeString()}.
          </p>
        </div>

        <ReportClientView scanData={data.scan_data} />
      </main>
    </div>
  );
}
