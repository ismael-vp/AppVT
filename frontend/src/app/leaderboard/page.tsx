import LeaderboardContent from '@/features/leaderboard/components/LeaderboardContent';

export const metadata = {
  title: 'Clasificación | PhishingScanner',
  description: 'Ranking de los usuarios más activos detectando amenazas en PhishingScanner.',
};

export default function LeaderboardPage() {
  return (
    <div className="min-h-screen bg-black text-[#ededed] font-sans selection:bg-[#333] selection:text-white pb-20">

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
