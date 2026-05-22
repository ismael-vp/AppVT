import AdminDashboard from '@/features/admin/components/AdminDashboard';
import { ShieldAlert, Monitor } from 'lucide-react';
import Link from 'next/link';

function MobileBlockScreen() {
  return (
    <div className="fixed inset-0 z-[999] bg-black flex flex-col items-center justify-center px-8 text-center md:hidden print:hidden">
      <ShieldAlert size={48} className="text-zinc-600 mb-6" />
      <h2 className="text-lg font-semibold text-zinc-200 mb-3">Panel Admin Restringido</h2>
      <p className="text-sm text-zinc-500 leading-relaxed max-w-xs mb-6">
        El panel de administración requiere un monitor de escritorio para visualizar correctamente los gráficos y reportes.
      </p>
      <div className="flex items-center space-x-2 text-zinc-600 text-xs">
        <Monitor size={14} />
        <span>Se requiere una pantalla de al menos 768px</span>
      </div>
    </div>
  );
}

export default function AdminPage() {
  return (
    <div className="min-h-screen bg-black text-[#ededed] font-sans selection:bg-[#333] selection:text-white">
      
      {/* Panel de bloqueo en móvil */}
      <MobileBlockScreen />

      {/* Navbar Súper Minimalista */}
      <header className="border-b border-[#333] bg-black/80 backdrop-blur-md sticky top-0 z-50 print:hidden">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <h1 className="text-sm font-medium tracking-wide text-white" translate="no">
              PhishingScanner <span className="text-zinc-600">/</span> Admin
            </h1>
          </div>
          <Link href="/" className="text-xs text-zinc-500 hover:text-white transition-colors">
            Volver al Escáner
          </Link>
        </div>
      </header>

      {/* Contenido Principal */}
      <main className="flex w-full max-w-6xl mx-auto px-6 py-6 flex-col items-center">
        <AdminDashboard />
      </main>

    </div>
  );
}
