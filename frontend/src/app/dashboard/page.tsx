import UserDashboard from '@/features/dashboard/components/UserDashboard';

export const metadata = {
  title: 'Estadísticas | PhishingScanner',
  description: 'Métricas de tus análisis en PhishingScanner.',
};

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-[#080808] text-zinc-200 font-sans selection:bg-zinc-700 selection:text-white pb-24">
      <main className="flex w-full max-w-6xl mx-auto px-4 sm:px-6 py-12 flex-col items-center">
        <UserDashboard />
      </main>
    </div>
  );
}
