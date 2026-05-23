"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { ScanResult } from '@/types';
import {
  ShieldAlert, ShieldCheck, Activity, BarChart3, Loader2,
  Users, TrendingUp, Clock, ExternalLink, RefreshCw, Globe, Image
} from 'lucide-react';
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

export default function AdminDashboardContent() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authorized, setAuthorized] = useState(false);
  const [reports, setReports] = useState<RawReport[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'logs'>('overview');

  const ADMIN_EMAIL = '1sm4el@pm.me';

  const fetchData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user || session.user.email !== ADMIN_EMAIL) {
        setAuthorized(false);
        setLoading(false);
        return;
      }
      setAuthorized(true);

      const { data, error: fetchError } = await supabase
        .from('scan_reports')
        .select('id, user_id, input_target, created_at, scan_data')
        .order('created_at', { ascending: false })
        .limit(500);

      if (fetchError) throw fetchError;
      setReports((data as RawReport[]) || []);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error cargando datos del administrador.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // ── Cálculo de métricas ────────────────────────────────────────────────────
  const metrics = useMemo(() => {
    const uniqueUsers = new Set(reports.map(r => r.user_id)).size;
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
      uniqueUsers, avgScore, detectionRate,
      timelineArray, brandArray, countryArray,
    };
  }, [reports]);

  // ── Estados de UI ──────────────────────────────────────────────────────────
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

  const PIE_COLORS = ['#ef4444', '#22c55e'];

  return (
    <div className="w-full max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 border-b border-zinc-800 pb-4">
        <div className="flex items-center space-x-3">
          <BarChart3 className="text-indigo-400 shrink-0" size={20} />
          <h1 className="text-xl font-semibold text-zinc-100 tracking-tight">Panel de Control General</h1>
        </div>
        <div className="flex items-center gap-3">
          {/* Tabs */}
          <div className="flex bg-zinc-900 border border-zinc-800 rounded-lg p-0.5 text-xs">
            <button onClick={() => setActiveTab('overview')} className={`px-3 py-1.5 rounded-md transition-all font-medium ${activeTab === 'overview' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>Vista General</button>
            <button onClick={() => setActiveTab('logs')} className={`px-3 py-1.5 rounded-md transition-all font-medium ${activeTab === 'logs' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>Registro de Análisis</button>
          </div>
          <button onClick={() => fetchData(true)} disabled={refreshing} className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-white border border-zinc-800 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50">
            <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
            Actualizar
          </button>
        </div>
      </div>

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        {/* Total */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 flex flex-col justify-between">
          <p className="text-[11px] text-zinc-500 uppercase tracking-wider flex items-center gap-1.5 mb-2"><Activity size={12} />Análisis Totales</p>
          <p className="text-3xl font-bold text-zinc-100">{metrics.total}</p>
        </div>
        {/* Maliciosos */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 p-2 opacity-10"><ShieldAlert size={48} className="text-red-500" /></div>
          <p className="text-[11px] text-zinc-500 uppercase tracking-wider flex items-center gap-1.5 mb-2"><ShieldAlert size={12} className="text-red-500" />Amenazas</p>
          <p className="text-3xl font-bold text-red-400">{metrics.maliciousCount}</p>
          <p className="text-[10px] text-zinc-600 mt-1">Tasa detección: {metrics.detectionRate}%</p>
        </div>
        {/* Seguros */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 p-2 opacity-10"><ShieldCheck size={48} className="text-green-500" /></div>
          <p className="text-[11px] text-zinc-500 uppercase tracking-wider flex items-center gap-1.5 mb-2"><ShieldCheck size={12} className="text-green-500" />Seguros</p>
          <p className="text-3xl font-bold text-emerald-400">{metrics.harmlessCount}</p>
        </div>
        {/* Usuarios únicos */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 p-2 opacity-10"><Users size={48} className="text-indigo-500" /></div>
          <p className="text-[11px] text-zinc-500 uppercase tracking-wider flex items-center gap-1.5 mb-2"><Users size={12} className="text-indigo-400" />Usuarios Activos</p>
          <p className="text-3xl font-bold text-indigo-400">{metrics.uniqueUsers}</p>
        </div>
        {/* Score medio */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 p-2 opacity-10"><TrendingUp size={48} className="text-amber-500" /></div>
          <p className="text-[11px] text-zinc-500 uppercase tracking-wider flex items-center gap-1.5 mb-2"><TrendingUp size={12} className="text-amber-400" />Riesgo Medio</p>
          <p className="text-3xl font-bold text-amber-400">{metrics.avgScore}<span className="text-base text-zinc-600">/100</span></p>
        </div>
      </div>

      {activeTab === 'overview' && (
        <>
          {/* ── Fila de gráficos principales ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">

            {/* Actividad diaria */}
            <div className="lg:col-span-2 bg-zinc-950 border border-zinc-800 rounded-xl p-5">
              <h3 className="text-[11px] font-medium text-zinc-400 mb-4 uppercase tracking-wider">Actividad Diaria (últimas 2 semanas)</h3>
              <div className="w-full h-52">
                {metrics.timelineArray.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%" minHeight={208} minWidth={0}>
                    <AreaChart data={metrics.timelineArray} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
                      <XAxis dataKey="date" stroke="#52525b" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis stroke="#52525b" fontSize={11} tickLine={false} axisLine={false} />
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                      <RechartsTooltip contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '8px', fontSize: '12px' }} itemStyle={{ color: '#e4e4e7' }} />
                      <Area type="monotone" dataKey="scans" name="Totales" stroke="#818cf8" fillOpacity={1} fill="url(#colorScans)" strokeWidth={2} />
                      <Area type="monotone" dataKey="malicious" name="Amenazas" stroke="#f87171" fillOpacity={1} fill="url(#colorMalicious)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-zinc-600 text-sm">No hay suficientes datos temporales</div>
                )}
              </div>
            </div>

            {/* Distribución seguro/malicioso */}
            <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-5">
              <h3 className="text-[11px] font-medium text-zinc-400 mb-4 uppercase tracking-wider">Distribución de Riesgo</h3>
              <div className="w-full h-52">
                {metrics.total > 0 ? (
                  <ResponsiveContainer width="100%" height="100%" minHeight={208}>
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Amenazas', value: metrics.maliciousCount },
                          { name: 'Seguros', value: metrics.harmlessCount }
                        ]}
                        cx="50%" cy="50%"
                        innerRadius={55} outerRadius={80}
                        paddingAngle={3}
                        dataKey="value"
                        strokeWidth={0}
                      >
                        {PIE_COLORS.map((color, index) => (
                          <Cell key={`cell-${index}`} fill={color} />
                        ))}
                      </Pie>
                      <Legend iconType="circle" iconSize={8} formatter={(value) => <span style={{ color: '#a1a1aa', fontSize: '12px' }}>{value}</span>} />
                      <RechartsTooltip contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '8px', fontSize: '12px' }} />
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
            <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-5">
              <h3 className="text-[11px] font-medium text-zinc-400 mb-4 uppercase tracking-wider">Top Marcas Suplantadas</h3>
              <div className="w-full h-52">
                {metrics.brandArray.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%" minHeight={208} minWidth={0}>
                    <BarChart data={metrics.brandArray} layout="vertical" margin={{ top: 0, right: 10, left: 20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
                      <XAxis type="number" stroke="#52525b" fontSize={11} hide />
                      <YAxis dataKey="name" type="category" stroke="#a1a1aa" fontSize={12} tickLine={false} axisLine={false} width={75} />
                      <RechartsTooltip cursor={{ fill: '#27272a', opacity: 0.4 }} contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '8px', fontSize: '12px' }} />
                      <Bar dataKey="count" name="Casos" fill="#f59e0b" radius={[0, 4, 4, 0]} barSize={18} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-zinc-600 text-sm text-center">No se detectaron marcas objetivo.</div>
                )}
              </div>
            </div>

            {/* Top países */}
            <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-5">
              <h3 className="text-[11px] font-medium text-zinc-400 mb-4 uppercase tracking-wider">Top Países de Origen</h3>
              <div className="w-full h-52">
                {metrics.countryArray.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%" minHeight={208} minWidth={0}>
                    <BarChart data={metrics.countryArray} layout="vertical" margin={{ top: 0, right: 10, left: 20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
                      <XAxis type="number" stroke="#52525b" fontSize={11} hide />
                      <YAxis dataKey="name" type="category" stroke="#a1a1aa" fontSize={12} tickLine={false} axisLine={false} width={75} />
                      <RechartsTooltip cursor={{ fill: '#27272a', opacity: 0.4 }} contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '8px', fontSize: '12px' }} />
                      <Bar dataKey="value" name="Análisis" fill="#818cf8" radius={[0, 4, 4, 0]} barSize={18} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-zinc-600 text-sm text-center">Sin datos de geolocalización.</div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {activeTab === 'logs' && (
        <div className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
            <h3 className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider flex items-center gap-2">
              <Clock size={12} /> Registro de Análisis Recientes
            </h3>
            <span className="text-xs text-zinc-600">{reports.length} entradas</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-900 text-[11px] text-zinc-500 uppercase tracking-wider">
                  <th className="text-left px-5 py-3 font-medium">Objetivo</th>
                  <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Tipo</th>
                  <th className="text-left px-4 py-3 font-medium">Riesgo</th>
                  <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Score</th>
                  <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">País</th>
                  <th className="text-left px-4 py-3 font-medium">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {reports.slice(0, 100).map((row) => {
                  const scan = row.scan_data;
                  const risk = scan ? getRiskLevel(scan) : { label: '—', color: 'text-zinc-500', bg: 'bg-zinc-900', score: 0 };
                  const country = scan?.osint_data?.geolocation?.country || '—';
                  const isImage = scan?.type === 'image';
                  return (
                    <tr key={row.id} className="border-b border-zinc-900/50 hover:bg-zinc-900/40 transition-colors group">
                      <td className="px-5 py-3 max-w-[160px] sm:max-w-[220px]">
                        <div className="flex items-center gap-2">
                          {isImage
                            ? <Image size={13} className="text-zinc-500 shrink-0" />
                            : <Globe size={13} className="text-zinc-500 shrink-0" />
                          }
                          <span className="text-zinc-300 truncate text-xs" title={row.input_target}>
                            {truncateUrl(row.input_target)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <span className="text-xs text-zinc-500">{isImage ? 'Imagen' : 'URL'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full ${risk.color} ${risk.bg}`}>
                          {risk.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="text-xs text-zinc-400 font-mono">{risk.score}</span>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <span className="text-xs text-zinc-500">{country}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-zinc-600 whitespace-nowrap">{formatDate(row.created_at)}</span>
                          {!isImage && (
                            <a href={row.input_target} target="_blank" rel="noopener noreferrer" className="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-600 hover:text-zinc-300">
                              <ExternalLink size={11} />
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {reports.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-zinc-600 text-sm">
                      No hay análisis registrados todavía.
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
