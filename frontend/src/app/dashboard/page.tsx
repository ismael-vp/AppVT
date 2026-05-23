import UserDashboard from '@/features/dashboard/components/UserDashboard';

export const metadata = {
  title: 'Estadísticas | PhishingScanner',
  description: 'Métricas e historial de tus análisis en PhishingScanner.',
};

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-black text-[#ededed] font-sans selection:bg-[#333] selection:text-white">
      <main className="flex w-full max-w-6xl mx-auto px-4 sm:px-6 py-8 flex-col items-center">
        <UserDashboard />
      </main>
    </div>
  );
}
