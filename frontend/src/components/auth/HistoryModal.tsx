"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { X, Search, ShieldAlert, ShieldCheck, Clock, Trash2, Database } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { useThreatStore } from '../../store/useThreatStore';
import { useToastStore } from '@/store/useToast';
import { ScanResult } from '@/types';

function formatTimeAgo(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return 'Hace un momento';
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `Hace ${diffInMinutes} m`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `Hace ${diffInHours} h`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 30) return `Hace ${diffInDays} d`;
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ScanReport {
  id: string;
  input_target: string;
  scan_data: ScanResult;
  created_at: string;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({ isOpen, onClose }) => {
  const [mounted, setMounted] = useState(false);
  const [reports, setReports] = useState<ScanReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [isClearingCache, setIsClearingCache] = useState(false);
  const [showAdminPrompt, setShowAdminPrompt] = useState(false);
  const [adminKeyInput, setAdminKeyInput] = useState('');
  const { session } = useAuthStore();
  const { showToast, showConfirm } = useToastStore();
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('scan_reports')
        // H-11: Seleccionar solo columnas necesarias (sin user_id ni campos extra)
        // Nota: los JSON path operators (scan_data->stats) devuelven columnas planas,
        // rompiendo report.scan_data. Seleccionamos scan_data completo de forma segura.
        .select('id, input_target, created_at, scan_data')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setReports(data || []);
    } catch (err: unknown) {
      console.error(err);
      showToast('Error al cargar el historial', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  // Fetch history when modal opens
  useEffect(() => {
    if (isOpen && session) {
      fetchHistory();
    }
  }, [isOpen, session, fetchHistory]);

  // Cerrar al pulsar Escape
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  // Bloquear el scroll del fondo
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);



  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    showConfirm(
      '¿Estás seguro de que quieres eliminar este reporte del historial?',
      async () => {
        try {
          const { error } = await supabase
            .from('scan_reports')
            .delete()
            .eq('id', id);

          if (error) throw error;
          
          setReports(current => current.filter(r => r.id !== id));
          showToast('Reporte eliminado', 'success');
        } catch (err: unknown) {
          console.error(err);
          showToast('Error al eliminar', 'error');
        }
      }
    );
  };

  const handleClearAll = async () => {
    if (reports.length === 0) return;
    
    showConfirm(
      '¿Estás seguro de que quieres borrar TODO tu historial? Esta acción no se puede deshacer.',
      async () => {
        try {
          // Si no pasamos ningún filtro, RLS solo borraría los que nos pertenecen
          // Pero supabase js requiere al menos un filtro
          const { error } = await supabase
            .from('scan_reports')
            .delete()
            .eq('user_id', session?.user.id);

          if (error) throw error;
          
          setReports([]);
          showToast('Historial completo eliminado', 'success');
        } catch (err: unknown) {
          console.error(err);
          showToast('Error al borrar el historial', 'error');
        }
      }
    );
  };

  const handleClearCache = async () => {
    if (!adminKeyInput) return;
    setIsClearingCache(true);
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const res = await fetch(`${API_URL}/api/admin/clear-cache`, {
        method: 'POST',
        headers: { 'X-Admin-Key': adminKeyInput }
      });
      if (res.ok) {
        showToast('Caché limpiada correctamente', 'success');
        setShowAdminPrompt(false);
        setAdminKeyInput('');
      } else {
        showToast('Error o clave incorrecta', 'error');
      }
    } catch (e) {
      showToast('Error de conexión con el servidor', 'error');
    } finally {
      setIsClearingCache(false);
    }
  };

  if (!mounted) return null;

  return createPortal(
    <>
      {/* Overlay oscuro para difuminar el fondo */}
      <div 
        className={`fixed inset-0 z-50 bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Panel lateral */}
      <div
        className={`fixed inset-y-0 right-0 z-50 w-full max-w-md bg-[#0a0a0a] border-l border-zinc-800/60 shadow-2xl transition-transform duration-300 ease-in-out flex flex-col ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Cabecera */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800/50">
          <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Recientes</span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                setAdminKeyInput('');
                setShowAdminPrompt(true);
              }}
              className={`text-zinc-600 hover:text-orange-400 transition-colors p-1.5 rounded-md hover:bg-orange-500/5 ${isClearingCache ? 'opacity-50 cursor-not-allowed' : ''}`}
              title="Limpiar caché del servidor"
              disabled={isClearingCache}
              tabIndex={isOpen ? 0 : -1}
            >
              <Database size={14} />
            </button>
            {reports.length > 0 && (
              <button
                onClick={handleClearAll}
                className="text-zinc-600 hover:text-red-400 transition-colors p-1.5 rounded-md hover:bg-red-500/5"
                title="Limpiar historial"
                tabIndex={isOpen ? 0 : -1}
              >
                <Trash2 size={14} />
              </button>
            )}
            <button
              onClick={onClose}
              className="text-zinc-600 hover:text-zinc-300 transition-colors rounded-md p-1.5 hover:bg-zinc-800/50"
              tabIndex={isOpen ? 0 : -1}
              aria-label="Cerrar historial"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Contenido */}
        <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 relative">
          {showAdminPrompt ? (
            <div className="absolute inset-0 z-10 bg-[#0a0a0a] flex flex-col items-center justify-center p-6">
              <Database size={32} className="text-zinc-500 mb-4" />
              <h3 className="text-sm font-medium text-white mb-2">Limpiar Caché</h3>
              <p className="text-xs text-zinc-400 text-center mb-6">
                Introduce la clave de administración para borrar la caché del servidor.
              </p>
              <input
                type="password"
                value={adminKeyInput}
                onChange={(e) => setAdminKeyInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleClearCache();
                  if (e.key === 'Escape') setShowAdminPrompt(false);
                }}
                className="w-full bg-[#141414] border border-zinc-800 text-sm text-white px-3 py-2 rounded-md focus:outline-none focus:border-zinc-500 mb-4"
                placeholder="Clave de administración"
                autoFocus
              />
              <div className="flex w-full gap-2">
                <button
                  onClick={() => setShowAdminPrompt(false)}
                  className="flex-1 py-2 text-xs font-medium text-zinc-400 bg-zinc-900 rounded-md hover:bg-zinc-800 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleClearCache}
                  disabled={isClearingCache || !adminKeyInput}
                  className="flex-1 py-2 text-xs font-medium text-white bg-orange-600/80 rounded-md hover:bg-orange-600 disabled:opacity-50 transition-colors"
                >
                  {isClearingCache ? 'Limpiando...' : 'Confirmar'}
                </button>
              </div>
            </div>
          ) : !session ? (
            <div className="text-center text-zinc-500 mt-10">
              Debes iniciar sesión para ver tu historial.
            </div>
          ) : loading ? (
            <div className="flex justify-center items-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-500 border-t-transparent"></div>
            </div>
          ) : reports.length === 0 ? (
            <div className="text-center mt-10">
              <div className="bg-zinc-900 inline-flex p-4 rounded-full mb-4">
                <Search size={32} className="text-zinc-500" />
              </div>
              <p className="text-zinc-300 font-medium">No hay escaneos recientes</p>
              <p className="text-zinc-500 text-sm mt-2">Tus análisis futuros aparecerán aquí.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {reports.map((report) => {
                const scanData = report.scan_data;
                const isMalicious =
                  (scanData?.stats?.malicious ?? 0) > 0 ||
                  (scanData?.image_analysis?.is_phishing ?? false) ||
                  ((scanData?.osint_data?.heuristic_result?.risk_score ?? 0) >= 70);

                const Icon = isMalicious ? ShieldAlert : ShieldCheck;
                const iconColor = isMalicious ? 'text-red-500/80' : 'text-emerald-500/80';
                const bgColor = isMalicious ? 'bg-red-500/8' : 'bg-emerald-500/8';

                return (
                  <div
                    key={report.id}
                    onClick={() => {
                      const { setMode, setScanResult } = useThreatStore.getState();
                      setMode(report.scan_data?.type || 'url');
                      setScanResult(report.scan_data || {}, report.input_target);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                      onClose();
                      router.push('/');
                    }}
                    className="group flex items-center gap-3 p-3.5 rounded-xl border border-zinc-800/40 bg-[#0f0f0f] hover:bg-[#141414] hover:border-zinc-700/50 transition-all cursor-pointer relative"
                  >
                    <div className={`p-2 rounded-lg shrink-0 ${bgColor}`}>
                      <Icon size={14} className={iconColor} />
                    </div>
                    <div className="truncate flex-1 min-w-0">
                      <p className="text-xs font-medium text-zinc-200 truncate" title={report.input_target}>
                        {report.input_target}
                      </p>
                      <p className="text-[10px] text-zinc-600 mt-0.5">
                        {formatTimeAgo(report.created_at)}
                      </p>
                    </div>
                    <button
                      onClick={(e) => handleDelete(report.id, e)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 text-zinc-600 hover:text-red-400 hover:bg-red-400/10 rounded-md transition-all shrink-0"
                      aria-label="Eliminar reporte"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>,
    document.body
  );
};
