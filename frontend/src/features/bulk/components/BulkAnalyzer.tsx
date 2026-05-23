"use client";

import React, { useCallback, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useBulkStore, UrlResult } from '@/store/useBulkStore';
import { API_URL } from '@/lib/api';
import {
  Upload, Play, X, CheckCircle2, XCircle, AlertTriangle,
  Download, RotateCcw, Loader2, FileText, Clock
} from 'lucide-react';


const MAX_URLS = 50;
// VirusTotal free tier: 4 req/min → 1 request cada 16 s para no pasarse
const VT_DELAY_MS = 16000;

function getRiskFromScore(malicious: number): 'safe' | 'suspicious' | 'malicious' {
  if (malicious > 5) return 'malicious';
  if (malicious > 0) return 'suspicious';
  return 'safe';
}

function getRiskStyle(label?: string) {
  if (label === 'malicious') return { color: 'text-red-400', bg: 'bg-red-500/10', icon: <XCircle size={13} /> };
  if (label === 'suspicious') return { color: 'text-amber-400', bg: 'bg-amber-500/10', icon: <AlertTriangle size={13} /> };
  if (label === 'safe') return { color: 'text-emerald-400', bg: 'bg-emerald-500/10', icon: <CheckCircle2 size={13} /> };
  return { color: 'text-zinc-500', bg: 'bg-zinc-900', icon: <Loader2 size={13} className="animate-spin" /> };
}

function getRiskLabel(label?: string) {
  if (label === 'malicious') return 'Malicioso';
  if (label === 'suspicious') return 'Sospechoso';
  if (label === 'safe') return 'Seguro';
  return '—';
}

function sleep(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms));
}

export default function BulkAnalyzer() {
  const {
    rawText, setRawText,
    results, setResults,
    running, setRunning,
    started, setStarted,
    countdown, setCountdown,
    abortRef, countdownRef,
    reset
  } = useBulkStore();

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Ya no limpiamos el timer al desmontar para que siga corriendo en segundo plano
  // useEffect(() => () => { if (countdownRef.current) clearInterval(countdownRef.current); }, []);

  const parseUrls = (text: string): string[] =>
    text.split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0 && (l.startsWith('http') || l.startsWith('www.')))
      .map(l => l.startsWith('www.') ? `https://${l}` : l)
      .slice(0, MAX_URLS);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setRawText(ev.target?.result as string || '');
    reader.readAsText(file);
  };

  const scanUrl = async (url: string) => {
    try {
      const res = await fetch(`${API_URL}/api/analyze/url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
        signal: AbortSignal.timeout(90000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const malicious = (data.stats?.malicious || 0) + (data.stats?.suspicious || 0);
      const label = getRiskFromScore(malicious);
      const score = malicious > 5 ? 85 : malicious > 0 ? Math.min(50 + malicious * 7, 95) : 5;
      return { score, label };
    } catch {
      return null;
    }
  };

  const startCountdown = (seconds: number, index: number) => {
    setCountdown(seconds);
    // Marcar URL siguiente como "waiting" si existe
    setResults(prev => prev.map((r, i) =>
      i === index + 1 ? { ...r, status: 'waiting' } : r
    ));
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { clearInterval(countdownRef.current!); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const handleStart = useCallback(async () => {
    const urls = parseUrls(rawText);
    if (urls.length === 0) return;

    abortRef.current = false;
    setStarted(true);
    setRunning(true);
    setCountdown(0);
    setResults(urls.map(url => ({ url, status: 'pending' })));

    for (let i = 0; i < urls.length; i++) {
      if (abortRef.current) break;

      // Pausa entre peticiones respetando el rate limit de VT (excepto la primera)
      if (i > 0) {
        startCountdown(Math.ceil(VT_DELAY_MS / 1000), i - 1);
        await sleep(VT_DELAY_MS);
        if (abortRef.current) break;
        setCountdown(0);
      }

      // Marcar como escaneando
      setResults(prev => prev.map((r, idx) =>
        idx === i ? { ...r, status: 'scanning' } : r
      ));

      const result = await scanUrl(urls[i]);

      setResults(prev => prev.map((r, idx) => {
        if (idx !== i) return r;
        if (!result) return { ...r, status: 'error', errorMsg: 'Timeout o error de red' };
        return { ...r, status: 'done', score: result.score, label: result.label };
      }));
    }

    if (countdownRef.current) clearInterval(countdownRef.current);
    setCountdown(0);
    setRunning(false);
  }, [rawText]);

  const handleStop = () => {
    abortRef.current = true;
    if (countdownRef.current) clearInterval(countdownRef.current);
    setCountdown(0);
    setRunning(false);
  };

  const handleReset = () => {
    abortRef.current = true;
    if (countdownRef.current) clearInterval(countdownRef.current);
    reset();
  };

  const handleExportCSV = () => {
    const rows = [['URL', 'Estado', 'Puntuación']];
    results.forEach(r => rows.push([r.url, getRiskLabel(r.label), r.score?.toString() || r.errorMsg || '—']));
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'phishingscanner_bulk.csv';
    a.click();
  };

  const urlCount = parseUrls(rawText).length;
  const done = results.filter(r => r.status === 'done' || r.status === 'error').length;
  const threats = results.filter(r => r.label === 'malicious' || r.label === 'suspicious').length;
  const progress = results.length > 0 ? Math.round((done / results.length) * 100) : 0;
  const estimatedMinutes = urlCount > 1 ? Math.ceil(((urlCount - 1) * VT_DELAY_MS) / 60000) : 0;

  return (
    <div className="w-full max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
      {!started ? (
        <div className="space-y-4">
          <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
                URLs a analizar (una por línea, máx. {MAX_URLS})
              </label>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-white border border-zinc-800 rounded-md px-3 py-1.5 transition-colors"
              >
                <Upload size={12} /> Subir .txt
              </button>
              <input ref={fileInputRef} type="file" accept=".txt" className="hidden" onChange={handleFileUpload} />
            </div>
            <textarea
              value={rawText}
              onChange={e => setRawText(e.target.value)}
              placeholder={`https://ejemplo.com\nhttps://otro-sitio.net\nhttps://dominio-sospechoso.xyz\n...`}
              className="w-full h-52 bg-black border border-zinc-800 rounded-lg p-4 text-sm text-zinc-300 placeholder-zinc-700 focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-700 resize-none font-mono transition-all"
            />
            <div className="flex items-center justify-between mt-3 flex-wrap gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-xs text-zinc-600">
                  {urlCount > 0
                    ? `${urlCount} URL${urlCount !== 1 ? 's' : ''} detectada${urlCount !== 1 ? 's' : ''}`
                    : 'Introduce URLs para comenzar'}
                </span>
                {urlCount > 1 && (
                  <span className="text-[11px] text-zinc-700 flex items-center gap-1">
                    <Clock size={10} />
                    Tiempo estimado: ~{estimatedMinutes} min (límite VirusTotal: 4/min)
                  </span>
                )}
              </div>
              <button
                onClick={handleStart}
                disabled={urlCount === 0}
                className="flex items-center gap-2 bg-white text-black font-medium text-sm px-5 py-2.5 rounded-lg hover:bg-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
              >
                <Play size={14} /> Iniciar análisis
              </button>
            </div>
          </div>

          {/* Info cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { icon: <FileText size={14} />, title: `Hasta ${MAX_URLS} URLs`, desc: 'Una por línea o sube un archivo .txt' },
              { icon: <Clock size={14} />, title: '4 análisis/min', desc: 'Respetamos el límite de VirusTotal para garantizar resultados precisos' },
              { icon: <Download size={14} />, title: 'Exportar CSV', desc: 'Descarga el informe completo con todos los resultados' },
            ].map(item => (
              <div key={item.title} className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 flex gap-3">
                <div className="text-zinc-600 shrink-0 mt-0.5">{item.icon}</div>
                <div>
                  <p className="text-xs font-medium text-zinc-300">{item.title}</p>
                  <p className="text-[11px] text-zinc-600 mt-0.5">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Stats + controles */}
          <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-6">
                <div>
                  <p className="text-2xl font-bold text-white">{done}<span className="text-base text-zinc-600">/{results.length}</span></p>
                  <p className="text-[11px] text-zinc-500 uppercase tracking-wider mt-0.5">Completadas</p>
                </div>
                {threats > 0 && (
                  <div>
                    <p className="text-2xl font-bold text-red-400">{threats}</p>
                    <p className="text-[11px] text-zinc-500 uppercase tracking-wider mt-0.5">Amenazas</p>
                  </div>
                )}
                {/* Countdown visible */}
                {running && countdown > 0 && (
                  <div className="flex items-center gap-2 text-zinc-500">
                    <Clock size={14} />
                    <div>
                      <p className="text-lg font-mono text-zinc-300">{countdown}s</p>
                      <p className="text-[10px] text-zinc-600 uppercase tracking-wider">Límite VT</p>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                {!running && done === results.length && (
                  <button onClick={handleExportCSV} className="flex items-center gap-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 rounded-lg px-3 py-2 transition-colors">
                    <Download size={12} /> Exportar CSV
                  </button>
                )}
                {running && (
                  <button onClick={handleStop} className="flex items-center gap-1.5 text-xs text-red-400 border border-red-900/50 bg-red-500/10 rounded-lg px-3 py-2 transition-colors hover:bg-red-500/20">
                    <X size={12} /> Detener
                  </button>
                )}
                <button onClick={handleReset} className="flex items-center gap-1.5 text-xs text-zinc-500 border border-zinc-800 rounded-lg px-3 py-2 hover:text-white transition-colors">
                  <RotateCcw size={12} /> Nueva sesión
                </button>
              </div>
            </div>

            {/* Barra de progreso */}
            <div className="mt-4">
              <div className="flex justify-between text-[11px] text-zinc-600 mb-1.5">
                <span>
                  {running
                    ? countdown > 0 ? `Esperando límite de VirusTotal (${countdown}s)…` : 'Analizando…'
                    : done === results.length ? 'Análisis completado' : 'Detenido'}
                </span>
                <span>{progress}%</span>
              </div>
              <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-zinc-400 rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>

          {/* Tabla de resultados */}
          <div className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-900 text-[11px] text-zinc-500 uppercase tracking-wider">
                  <th className="text-left px-5 py-3 font-medium">URL</th>
                  <th className="text-left px-4 py-3 font-medium">Estado</th>
                  <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Score</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => {
                  const style = r.status === 'done' ? getRiskStyle(r.label) : getRiskStyle(undefined);
                  return (
                    <tr key={i} className="border-b border-zinc-900/50 hover:bg-zinc-900/30 transition-colors">
                      <td className="px-5 py-3 max-w-[180px] sm:max-w-xs">
                        <Link 
                          href={`/?url=${encodeURIComponent(r.url)}`}
                          className="text-blue-400 hover:text-blue-300 text-xs font-mono truncate block transition-colors" 
                          title={r.url}
                        >
                          {r.url.replace(/^https?:\/\//, '')}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        {r.status === 'pending' && <span className="text-[11px] text-zinc-700">En cola</span>}
                        {r.status === 'waiting' && (
                          <span className="text-[11px] text-zinc-600 flex items-center gap-1">
                            <Clock size={11} /> Esperando
                          </span>
                        )}
                        {r.status === 'scanning' && (
                          <span className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                            <Loader2 size={11} className="animate-spin" /> Escaneando
                          </span>
                        )}
                        {r.status === 'done' && (
                          <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full ${style.color} ${style.bg}`}>
                            {style.icon} {getRiskLabel(r.label)}
                          </span>
                        )}
                        {r.status === 'error' && (
                          <span className="text-[11px] text-red-500/60" title={r.errorMsg}>Error</span>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <span className="text-xs text-zinc-600 font-mono">
                          {r.status === 'done' && r.score !== undefined ? r.score : '—'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
