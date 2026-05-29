"use client";

import React, { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useThreatStore } from '@/store/useThreatStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useToastStore } from '@/store/useToast';
import { Clock, ShieldAlert, ShieldCheck, Trash2, Database } from 'lucide-react';
import axios from 'axios';
import { API_URL } from '@/lib/api';

export default function HistoryPanel() {
  const { history, clearHistory, setScanResult, setMode } = useThreatStore(
    useShallow((state) => ({
      history: state.history,
      clearHistory: state.clearHistory,
      setScanResult: state.setScanResult,
      setMode: state.setMode,
    }))
  );
  const { session } = useAuthStore(useShallow((state) => ({ session: state.session })));
  const { showToast } = useToastStore(useShallow((state) => ({ showToast: state.showToast })));
  const [mounted, setMounted] = useState(false);
  const [isClearingCache, setIsClearingCache] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  if (!mounted || history.length === 0 || session) return null;

  return (
    <div className="w-full max-w-5xl mx-auto mt-10 pt-8 border-t border-zinc-800/50 animate-in fade-in duration-500">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-zinc-500">
          <Clock size={14} />
          <span className="text-xs font-medium uppercase tracking-wider">Recientes</span>
        </div>
        <div className="flex gap-4">
          <button
            onClick={async () => {
              const key = window.prompt('Introduce la clave de administración para limpiar la caché del servidor:');
              if (!key) return;
              
              setIsClearingCache(true);
              try {
                await axios.post(`${API_URL}/api/admin/clear-cache`, {}, {
                  headers: {
                    'X-Admin-Key': key
                  }
                });
                
                showToast('Caché limpiada correctamente', 'success');
              } catch (e: unknown) {
                if (axios.isAxiosError(e) && e.response?.status === 401) {
                  showToast('Clave incorrecta', 'error');
                } else {
                  showToast('Error de conexión con el servidor', 'error');
                }
              } finally {
                setIsClearingCache(false);
              }
            }}
            disabled={isClearingCache}
            className="text-zinc-600 hover:text-orange-400 transition-colors flex items-center gap-1.5 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Database size={12} />
            {isClearingCache ? 'Limpiando...' : 'Limpiar Caché'}
          </button>
          
          <button
            onClick={clearHistory}
            className="text-zinc-600 hover:text-red-400 transition-colors flex items-center gap-1.5 text-xs"
          >
            <Trash2 size={12} />
            Limpiar Historial
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {history.map((item, idx) => {
          const isMalicious = (item.stats?.malicious ?? 0) > 0 || (item.stats?.suspicious ?? 0) > 0;
          return (
            <div
              key={`${item.resourceName}-${idx}`}
              onClick={() => {
                setMode(item.type);
                setScanResult(item, item.resourceName);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="bg-[#050505] border border-zinc-800/50 hover:border-zinc-700/60 p-3.5 rounded-xl cursor-pointer transition-all group"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  {isMalicious ? (
                    <ShieldAlert size={13} className="text-red-500/80" />
                  ) : (
                    <ShieldCheck size={13} className="text-emerald-500/80" />
                  )}
                  <span className={`text-[10px] font-semibold uppercase tracking-wider ${isMalicious ? 'text-red-500/70' : 'text-emerald-500/70'}`}>
                    {isMalicious ? 'Amenaza' : 'Seguro'}
                  </span>
                </div>
                <span className="text-[10px] text-zinc-600">
                  {item.timestamp ? new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                </span>
              </div>
              <p className="text-xs text-zinc-300 font-medium truncate">
                {item.resourceName || 'Recurso desconocido'}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
