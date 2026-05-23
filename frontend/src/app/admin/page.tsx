import AdminDashboard from '@/features/admin/components/AdminDashboard';
import { ShieldAlert, Monitor } from 'lucide-react';
import Link from 'next/link';



export default function AdminPage() {
  return (
    <div className="min-h-screen bg-black text-[#ededed] font-sans selection:bg-[#333] selection:text-white">
      
      {/* Navbar Súper Minimalista */}
      <header className="border-b border-[#333] bg-black/80 backdrop-blur-md sticky top-0 z-50 print:hidden">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <h1 className="text-sm font-medium tracking-wide text-white flex items-center gap-2" translate="no">
              <Link href="/" className="hover:text-zinc-300 transition-colors">PhishingScanner</Link> <span className="text-zinc-600">/</span> Admin
            </h1>
          </div>
        </div>
      </header>

      {/* Contenido Principal */}
      <main className="flex w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 flex-col items-center">
        <AdminDashboard />
      </main>

    </div>
  );
}
