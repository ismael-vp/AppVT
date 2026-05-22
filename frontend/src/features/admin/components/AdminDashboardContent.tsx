"use client";

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { ScanResult } from '@/types';
import { ShieldAlert, ShieldCheck, Activity, BarChart3, Loader2 } from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';

export default function AdminDashboardContent() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authorized, setAuthorized] = useState(false);
  
  const [kpis, setKpis] = useState({ total: 0, malicious: 0, harmless: 0 });
  const [timelineData, setTimelineData] = useState<Record<string, unknown>[]>([]);
  const [topBrands, setTopBrands] = useState<Record<string, unknown>[]>([]);

  const ADMIN_EMAIL = '1sm4el@pm.me';

  useEffect(() => {
    async function loadDashboard() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user || session.user.email !== ADMIN_EMAIL) {
          setAuthorized(false);
          setLoading(false);
          return;
        }

        setAuthorized(true);

        // Fetch data
        const { data } = await supabase
          .from('scan_reports')
          .select('scan_data, created_at')
          .order('created_at', { ascending: false });

        const processStatsFn = (reports: Record<string, unknown>[]) => {
          let maliciousCount = 0;
          let harmlessCount = 0;
          
          const timelineMap: Record<string, { date: string; scans: number; malicious: number }> = {};
          const brandMap: Record<string, number> = {};

          reports.forEach((row) => {
            const scan = row.scan_data as ScanResult;
            if (!scan) return;

            const isMalicious = (scan.stats?.malicious || 0) > 0 || (scan.stats?.suspicious || 0) > 0;
            if (isMalicious) maliciousCount++;
            else harmlessCount++;

            // Timeline (agrupar por fecha local sin horas)
            const dateObj = new Date(row.created_at as string);
            const dateStr = `${dateObj.getDate()}/${dateObj.getMonth() + 1}`;
            
            if (!timelineMap[dateStr]) {
              timelineMap[dateStr] = { date: dateStr, scans: 0, malicious: 0 };
            }
            timelineMap[dateStr].scans++;
            if (isMalicious) timelineMap[dateStr].malicious++;

            // Brands
            const brand = scan.osint_data?.target_brand;
            if (brand && typeof brand === 'string' && brand !== 'None') {
              const cleanBrand = brand.charAt(0).toUpperCase() + brand.slice(1);
              brandMap[cleanBrand] = (brandMap[cleanBrand] || 0) + 1;
            }
          });

          // Formatear Timeline
          const timelineArray = Object.values(timelineMap).reverse();

          // Formatear Brands
          const brandArray = Object.entries(brandMap)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

          setKpis({ total: reports.length, malicious: maliciousCount, harmless: harmlessCount });
          setTimelineData(timelineArray);
          setTopBrands(brandArray);
        };

        processStatsFn(data || []);
      } catch (err: unknown) {
        console.error("Admin Dashboard Error:", err);
        setError(err instanceof Error ? err.message : 'Error cargando datos del administrador.');
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-zinc-500">
        <Loader2 className="animate-spin size-8 mb-4" />
        <p>Verificando credenciales de administrador...</p>
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
        <ShieldAlert className="text-red-500 size-16 mb-4" />
        <h2 className="text-xl font-bold text-zinc-200 mb-2">Acceso Denegado</h2>
        <p className="text-zinc-500">Esta área es exclusiva para la administración del sistema.</p>
        <p className="text-xs text-zinc-600 mt-4">Req: {ADMIN_EMAIL}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-900 text-red-500 p-4 rounded-md w-full max-w-4xl mx-auto mt-8">
        <strong>Error: </strong> {error}
        <p className="text-xs mt-2 text-red-400">¿Están las políticas RLS de Supabase configuradas para permitir SELECT a este usuario?</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-center space-x-3 mb-6 border-b border-zinc-800 pb-3">
        <BarChart3 className="text-indigo-400" size={20} />
        <h1 className="text-xl font-semibold text-zinc-100 tracking-tight">Panel de Control General</h1>
      </div>

      {/* Tarjetas KPI */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-5 flex flex-col justify-center">
          <p className="text-xs text-zinc-400 mb-1 flex items-center space-x-2">
            <Activity size={14} /> <span>Análisis Totales</span>
          </p>
          <p className="text-3xl font-bold text-zinc-100">{kpis.total}</p>
        </div>
        <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-5 flex flex-col justify-center relative overflow-hidden">
          <div className="absolute top-0 right-0 p-3 opacity-10"><ShieldAlert size={56} className="text-red-500" /></div>
          <p className="text-xs text-zinc-400 mb-1 flex items-center space-x-2">
            <ShieldAlert size={14} className="text-red-500" /> <span>Amenazas Detectadas</span>
          </p>
          <p className="text-3xl font-bold text-red-400">{kpis.malicious}</p>
        </div>
        <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-5 flex flex-col justify-center relative overflow-hidden">
          <div className="absolute top-0 right-0 p-3 opacity-10"><ShieldCheck size={56} className="text-green-500" /></div>
          <p className="text-xs text-zinc-400 mb-1 flex items-center space-x-2">
            <ShieldCheck size={14} className="text-green-500" /> <span>Sitios Seguros</span>
          </p>
          <p className="text-3xl font-bold text-green-400">{kpis.harmless}</p>
        </div>
      </div>

      {/* Gráficos principales */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        
        {/* Gráfico de Líneas (Uso a lo largo del tiempo) */}
        <div className="lg:col-span-2 bg-zinc-950 border border-zinc-800 rounded-xl p-5">
          <h3 className="text-xs font-medium text-zinc-300 mb-4 uppercase tracking-wider">Actividad Diaria</h3>
          <div className="w-full h-56">
            {timelineData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%" minHeight={224} minWidth={0}>
                <AreaChart data={timelineData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorScans" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#818cf8" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#818cf8" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorMalicious" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f87171" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#f87171" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" stroke="#52525b" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#52525b" fontSize={12} tickLine={false} axisLine={false} />
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '8px' }}
                    itemStyle={{ color: '#e4e4e7' }}
                  />
                  <Area type="monotone" dataKey="scans" name="Totales" stroke="#818cf8" fillOpacity={1} fill="url(#colorScans)" />
                  <Area type="monotone" dataKey="malicious" name="Maliciosos" stroke="#f87171" fillOpacity={1} fill="url(#colorMalicious)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-zinc-600 text-sm">No hay suficientes datos temporales</div>
            )}
          </div>
        </div>

        {/* Marcas más suplantadas */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-5">
          <h3 className="text-xs font-medium text-zinc-300 mb-4 uppercase tracking-wider">Marcas Suplantadas</h3>
          <div className="w-full h-56">
            {topBrands.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%" minHeight={224} minWidth={0}>
                <BarChart data={topBrands} layout="vertical" margin={{ top: 0, right: 0, left: 20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
                  <XAxis type="number" stroke="#52525b" fontSize={12} hide />
                  <YAxis dataKey="name" type="category" stroke="#a1a1aa" fontSize={12} tickLine={false} axisLine={false} width={80} />
                  <RechartsTooltip 
                    cursor={{fill: '#27272a', opacity: 0.4}}
                    contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '8px' }}
                  />
                  <Bar dataKey="count" name="Casos" fill="#f59e0b" radius={[0, 4, 4, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-zinc-600 text-sm text-center">
                No se detectaron marcas objetivo en el historial.
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
