import LeaderboardContent from '@/features/leaderboard/components/LeaderboardContent';

export const metadata = {
  title: 'Clasificación | PhishingScanner',
  description: 'Ranking de los usuarios más activos en PhishingScanner.',
};

export default function LeaderboardPage() {
  return (
    <div className="min-h-screen bg-[#080808] text-zinc-200 font-sans selection:bg-zinc-700 selection:text-white pb-24">
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <div className="mb-8">
          <h1 className="text-xl font-semibold text-white tracking-tight">Clasificación</h1>
          <p className="text-sm text-zinc-500 mt-1">Usuarios más activos de la plataforma</p>
        </div>
        <LeaderboardContent />
      </main>
    </div>
  );
}
