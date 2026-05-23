import LeaderboardContent from '@/features/leaderboard/components/LeaderboardContent';
import Link from 'next/link';

export const metadata = {
  title: 'Clasificación | PhishingScanner',
  description: 'Ranking de los usuarios más activos detectando amenazas en PhishingScanner.',
};

export default function LeaderboardPage() {
  return (
    <div className="min-h-screen bg-black text-[#ededed] font-sans selection:bg-[#333] selection:text-white pb-20">

      <header className="border-b border-[#333] bg-black/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <h1 className="text-sm font-medium tracking-wide text-white flex items-center gap-2" translate="no">
            <Link href="/" className="hover:text-zinc-300 transition-colors">PhishingScanner</Link> <span className="text-zinc-600">/</span> Clasificación
          </h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-zinc-100 mb-1">Clasificación</h2>
          <p className="text-sm text-zinc-600">Usuarios más activos de la plataforma</p>
        </div>
        <LeaderboardContent />
      </main>
    </div>
  );
}
