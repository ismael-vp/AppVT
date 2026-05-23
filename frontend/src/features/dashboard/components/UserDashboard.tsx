"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { ScanResult } from '@/types';
import { RefreshCw, ExternalLink, Loader2 } from 'lucide-react';
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
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

interface RawReport {
  id: string;
  user_id: string;
  input_target: string;
  created_at: string;
  scan_data: ScanResult;
}

function getRiskLevel(scan: ScanResult): { label: string; color: string; bg: string; score: number } {
  const malicious = (scan.stats?.malicious || 0) + (scan.stats?.suspicious || 0);
  const score = scan.image_analysis
    ? scan.image_analysis.is_phishing ? 85 : 10
    : malicious > 0 ? Math.min(50 + malicious * 5, 100) : 5;

  if (malicious > 5 || score >= 70) return { label: 'Malicioso', color: 'text-red-400', bg: 'bg-red-500/10', score };
  if (malicious > 0 || score >= 40) return { label: 'Sospechoso', color: 'text-amber-400', bg: 'bg-amber-500/10', score };
  return { label: 'Seguro', color: 'text-emerald-400', bg: 'bg-emerald-500/10', score };
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function truncateUrl(url: string, max = 40): string {
  if (url.length <= max) return url;
  return url.slice(0, max) + '…';
}

export default function UserDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [reports, setReports] = useState<RawReport[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'logs'>('overview');

  const fetchData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setIsAuthenticated(false);
        setLoading(false);
        return;
      }
      setIsAuthenticated(true);

      const { data, error: fetchError } = await supabase
        .from('scan_reports')
        .select('id, user_id, input_target, created_at, scan_data')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(200);

      if (fetchError) throw fetchError;
      setReports((data as RawReport[]) || []);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error cargando historial.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { 
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData(); 
  }, []);

  // ── Cálculo de métricas ────────────────────────────────────────────────────
  const metrics = useMemo(() => {
    let maliciousCount = 0;
    let harmlessCount = 0;
    let totalScore = 0;

    const timelineMap: Record<string, { date: string; scans: number; malicious: number }> = {};
    const brandMap: Record<string, number> = {};
    const countryMap: Record<string, number> = {};

    reports.forEach((row) => {
      const scan = row.scan_data;
      if (!scan) return;

      const risk = getRiskLevel(scan);
      totalScore += risk.score;

      const isMalicious = risk.label !== 'Seguro';
      if (isMalicious) maliciousCount++;
      else harmlessCount++;

      // Timeline
      const dateObj = new Date(row.created_at);
      const dateStr = `${dateObj.getDate()}/${dateObj.getMonth() + 1}`;
      if (!timelineMap[dateStr]) timelineMap[dateStr] = { date: dateStr, scans: 0, malicious: 0 };
      timelineMap[dateStr].scans++;
      if (isMalicious) timelineMap[dateStr].malicious++;

      // Brands
      const brand = scan.osint_data?.target_brand;
      if (brand && typeof brand === 'string' && brand !== 'None') {
        const cleanBrand = brand.charAt(0).toUpperCase() + brand.slice(1);
        brandMap[cleanBrand] = (brandMap[cleanBrand] || 0) + 1;
      }

      // Countries
      const country = scan.osint_data?.geolocation?.country;
      if (country) countryMap[country] = (countryMap[country] || 0) + 1;
    });

    const avgScore = reports.length > 0 ? Math.round(totalScore / reports.length) : 0;
    const timelineArray = Object.values(timelineMap).reverse().slice(-14);
    const brandArray = Object.entries(brandMap).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 6);
    const countryArray = Object.entries(countryMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 5);

    const detectionRate = reports.length > 0 ? Math.round((maliciousCount / reports.length) * 100) : 0;

    return {
      total: reports.length, maliciousCount, harmlessCount,
      avgScore, detectionRate,
      timelineArray, brandArray, countryArray,
    };
  }, [reports]);

  // ── Estados de UI ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-zinc-500">
        <Loader2 className="animate-spin size-8 mb-4" />
        <p className="text-sm">Cargando estadísticas...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center w-full max-w-md mx-auto">
        <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-8 w-full">
          <h2 className="text-lg font-medium text-zinc-200 mb-2">Acceso Requerido</h2>
          <p className="text-sm text-zinc-500">Debes iniciar sesión para ver tus estadísticas y el historial de análisis.</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-[#1a0f0f] border border-red-900/50 text-red-400 p-4 rounded-xl w-full max-w-4xl mx-auto mt-8 text-sm">
        <strong>Error: </strong> {error}
      </div>
    );
  }

  const PIE_COLORS = ['#ef4444', '#10b981']; // Red, Emerald

  return (
    <div className="w-full max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-xl font-medium text-zinc-100 tracking-tight flex items-center gap-2">
            Historial y Estadísticas
          </h1>
          <p className="text-sm text-zinc-500 mt-1">Métricas de tus análisis recientes</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-[#0a0a0a] border border-zinc-800 rounded-lg p-0.5 text-xs">
            <button onClick={() => setActiveTab('overview')} className={`px-4 py-2 rounded-md transition-all font-medium ${activeTab === 'overview' ? 'bg-[#222] text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}>Estadísticas</button>
            <button onClick={() => setActiveTab('logs')} className={`px-4 py-2 rounded-md transition-all font-medium ${activeTab === 'logs' ? 'bg-[#222] text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}>Historial</button>
          </div>
          <button onClick={() => fetchData(true)} disabled={refreshing} className="flex items-center gap-2 text-xs text-zinc-400 hover:text-white bg-[#0a0a0a] hover:bg-[#111] border border-zinc-800 rounded-lg px-3 py-2 transition-colors disabled:opacity-50">
            <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
            Actualizar
          </button>
        </div>
      </div>

      {activeTab === 'overview' && (
        <>
          {/* ── KPIs ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-[#050505] border border-zinc-800/80 rounded-xl p-5 flex flex-col justify-between">
              <p className="text-[11px] text-zinc-500 uppercase tracking-wider mb-2">Análisis Totales</p>
              <p className="text-3xl font-medium text-zinc-200">{metrics.total}</p>
            </div>
            <div className="bg-[#050505] border border-zinc-800/80 rounded-xl p-5 flex flex-col justify-between">
              <p className="text-[11px] text-zinc-500 uppercase tracking-wider mb-2">Amenazas Detectadas</p>
              <div className="flex items-baseline gap-2">
                <p className="text-3xl font-medium text-red-400">{metrics.maliciousCount}</p>
                {metrics.total > 0 && <p className="text-xs text-zinc-500">({metrics.detectionRate}%)</p>}
              </div>
            </div>
            <div className="bg-[#050505] border border-zinc-800/80 rounded-xl p-5 flex flex-col justify-between">
              <p className="text-[11px] text-zinc-500 uppercase tracking-wider mb-2">Seguros</p>
              <p className="text-3xl font-medium text-emerald-400">{metrics.harmlessCount}</p>
            </div>
            <div className="bg-[#050505] border border-zinc-800/80 rounded-xl p-5 flex flex-col justify-between">
              <p className="text-[11px] text-zinc-500 uppercase tracking-wider mb-2">Riesgo Medio</p>
              <p className="text-3xl font-medium text-amber-400">{metrics.avgScore}<span className="text-sm text-zinc-600 font-normal ml-1">/100</span></p>
            </div>
          </div>

          {/* ── Fila de gráficos principales ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
            {/* Actividad diaria */}
            <div className="lg:col-span-2 bg-[#050505] border border-zinc-800/80 rounded-xl p-6">
              <h3 className="text-xs font-medium text-zinc-400 mb-6 uppercase tracking-wider">Actividad Diaria</h3>
              <div className="w-full h-60">
                {metrics.timelineArray.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%" minHeight={240} minWidth={0}>
                    <AreaChart data={metrics.timelineArray} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorScans" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#52525b" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#52525b" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorMalicious" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="date" stroke="#52525b" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis stroke="#52525b" fontSize={11} tickLine={false} axisLine={false} />
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                      <RechartsTooltip contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '8px', fontSize: '12px' }} itemStyle={{ color: '#e4e4e7' }} />
                      <Area type="monotone" dataKey="scans" name="Totales" stroke="#71717a" fillOpacity={1} fill="url(#colorScans)" strokeWidth={2} />
                      <Area type="monotone" dataKey="malicious" name="Amenazas" stroke="#ef4444" fillOpacity={1} fill="url(#colorMalicious)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-zinc-600 text-sm">No hay suficientes datos.</div>
                )}
              </div>
            </div>

            {/* Distribución seguro/malicioso */}
            <div className="bg-[#050505] border border-zinc-800/80 rounded-xl p-6">
              <h3 className="text-xs font-medium text-zinc-400 mb-6 uppercase tracking-wider">Distribución</h3>
              <div className="w-full h-60">
                {metrics.total > 0 ? (
                  <ResponsiveContainer width="100%" height="100%" minHeight={240}>
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Amenazas', value: metrics.maliciousCount },
                          { name: 'Seguros', value: metrics.harmlessCount }
                        ]}
                        cx="50%" cy="50%"
                        innerRadius={65} outerRadius={85}
                        paddingAngle={2}
                        dataKey="value"
                        strokeWidth={0}
                      >
                        {PIE_COLORS.map((color, index) => (
                          <Cell key={`cell-${index}`} fill={color} />
                        ))}
                      </Pie>
                      <Legend iconType="circle" iconSize={8} formatter={(value) => <span style={{ color: '#a1a1aa', fontSize: '12px' }}>{value}</span>} />
                      <RechartsTooltip contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '8px', fontSize: '12px', border: 'none' }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-zinc-600 text-sm">Sin datos</div>
                )}
              </div>
            </div>
          </div>

          {/* ── Fila inferior ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Marcas suplantadas */}
            <div className="bg-[#050505] border border-zinc-800/80 rounded-xl p-6">
              <h3 className="text-xs font-medium text-zinc-400 mb-6 uppercase tracking-wider">Top Marcas Analizadas</h3>
              <div className="w-full h-48">
                {metrics.brandArray.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%" minHeight={192} minWidth={0}>
                    <BarChart data={metrics.brandArray} layout="vertical" margin={{ top: 0, right: 10, left: 20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
                      <XAxis type="number" stroke="#52525b" fontSize={11} hide />
                      <YAxis dataKey="name" type="category" stroke="#a1a1aa" fontSize={12} tickLine={false} axisLine={false} width={85} />
                      <RechartsTooltip cursor={{ fill: '#27272a', opacity: 0.2 }} contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '8px', fontSize: '12px' }} />
                      <Bar dataKey="count" name="Casos" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={16} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-zinc-600 text-sm">No se detectaron marcas objetivo.</div>
                )}
              </div>
            </div>

            {/* Top países */}
            <div className="bg-[#050505] border border-zinc-800/80 rounded-xl p-6">
              <h3 className="text-xs font-medium text-zinc-400 mb-6 uppercase tracking-wider">Top Países Destino</h3>
              <div className="w-full h-48">
                {metrics.countryArray.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%" minHeight={192} minWidth={0}>
                    <BarChart data={metrics.countryArray} layout="vertical" margin={{ top: 0, right: 10, left: 20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
                      <XAxis type="number" stroke="#52525b" fontSize={11} hide />
                      <YAxis dataKey="name" type="category" stroke="#a1a1aa" fontSize={12} tickLine={false} axisLine={false} width={85} />
                      <RechartsTooltip cursor={{ fill: '#27272a', opacity: 0.2 }} contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '8px', fontSize: '12px' }} />
                      <Bar dataKey="value" name="Análisis" fill="#52525b" radius={[0, 4, 4, 0]} barSize={16} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-zinc-600 text-sm">Sin datos de geolocalización.</div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {activeTab === 'logs' && (
        <div className="bg-[#050505] border border-zinc-800/80 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800/60 text-[11px] text-zinc-500 uppercase tracking-wider bg-[#0a0a0a]">
                  <th className="text-left px-6 py-4 font-medium">Objetivo</th>
                  <th className="text-left px-6 py-4 font-medium">Riesgo</th>
                  <th className="text-left px-6 py-4 font-medium hidden sm:table-cell">Score</th>
                  <th className="text-left px-6 py-4 font-medium hidden md:table-cell">País</th>
                  <th className="text-left px-6 py-4 font-medium">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((row) => {
                  const scan = row.scan_data;
                  const risk = scan ? getRiskLevel(scan) : { label: '—', color: 'text-zinc-500', bg: 'bg-zinc-900', score: 0 };
                  const country = scan?.osint_data?.geolocation?.country || '—';
                  const isImage = scan?.type === 'image';
                  return (
                    <tr key={row.id} className="border-b border-zinc-900/50 hover:bg-[#0a0a0a] transition-colors group">
                      <td className="px-6 py-4 max-w-[200px] sm:max-w-[300px]">
                        <div className="flex items-center gap-2">
                          <span className="text-zinc-300 truncate text-xs font-mono" title={row.input_target}>
                            {truncateUrl(row.input_target)}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-sm ${risk.color} ${risk.bg}`}>
                          {risk.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 hidden sm:table-cell">
                        <span className="text-xs text-zinc-400 font-mono">{risk.score}</span>
                      </td>
                      <td className="px-6 py-4 hidden md:table-cell">
                        <span className="text-xs text-zinc-500">{country}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-zinc-500 whitespace-nowrap">{formatDate(row.created_at)}</span>
                          {!isImage && (
                            <a href={row.input_target} target="_blank" rel="noopener noreferrer" className="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-600 hover:text-zinc-300" title="Abrir enlace original">
                              <ExternalLink size={12} />
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {reports.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-16 text-center text-zinc-500 text-sm">
                      Aún no has realizado ningún análisis.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
