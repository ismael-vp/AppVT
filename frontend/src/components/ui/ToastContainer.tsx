"use client";

import React, { useEffect, useState } from 'react';

import { createPortal } from 'react-dom';
import { useToastStore, ConfirmDialog } from '@/store/useToast';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export default function ToastContainer() {
  const { toasts, removeToast, confirmDialog, clearConfirm } = useToastStore();
  const [mounted, setMounted] = useState(false);
  const [dialogState, setDialogState] = useState<{ data: ConfirmDialog | null; status: 'closed' | 'mounting' | 'open' | 'closing' }>({ data: null, status: 'closed' });

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  useEffect(() => {
    if (confirmDialog) {
      setDialogState({ data: confirmDialog, status: 'mounting' });
      const timer = setTimeout(() => {
        setDialogState({ data: confirmDialog, status: 'open' });
      }, 50);
      return () => clearTimeout(timer);
    } else {
      setDialogState(prev => ({ ...prev, status: 'closing' }));
      const timer = setTimeout(() => {
        setDialogState({ data: null, status: 'closed' });
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [confirmDialog]);

  if (!mounted) return null;

  return createPortal(
    <>
      {/* Toast Notifications */}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 w-full max-w-sm pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="pointer-events-auto flex items-start gap-3 p-4 rounded-lg shadow-xl bg-zinc-900 border border-zinc-800 animate-in slide-in-from-right-8 fade-in duration-300"
          >
            {toast.type === 'success' && <CheckCircle2 className="text-green-500 shrink-0 mt-0.5" size={18} />}
            {toast.type === 'error' && <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={18} />}
            {toast.type === 'info' && <Info className="text-blue-500 shrink-0 mt-0.5" size={18} />}
            
            <div className="flex-1 text-sm text-zinc-200">
              {toast.message}
            </div>
            
            <button
              onClick={() => removeToast(toast.id)}
              className="text-zinc-500 hover:text-zinc-300 transition-colors shrink-0"
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>

      {/* Confirm Dialog Modal */}
      {dialogState.data && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 perspective-1000">
          <div 
            className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-200 ease-out ${dialogState.status === 'open' ? 'opacity-100' : 'opacity-0'}`}
            onClick={() => {
              if (dialogState.data?.onCancel) dialogState.data.onCancel();
              clearConfirm();
            }}
          />
          <div className={`relative bg-[#0d0d0d] border border-zinc-800/60 rounded-xl shadow-2xl p-6 max-w-sm w-full transition-all duration-200 ease-out transform ${dialogState.status === 'open' ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 scale-95 translate-y-4'}`}>
            <div className="flex items-start gap-4">
              <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-2 rounded-xl shrink-0 mt-0.5">
                <AlertCircle size={20} />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-semibold text-white mb-1.5">Confirmar acción</h3>
                <p className="text-zinc-400 text-sm mb-6 leading-relaxed">
                  {dialogState.data.message}
                </p>
                <div className="flex justify-end gap-2.5">
                  <button
                    onClick={() => {
                      if (dialogState.data?.onCancel) dialogState.data.onCancel();
                      clearConfirm();
                    }}
                    className="px-4 py-2 text-xs font-medium text-zinc-400 hover:text-white transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => {
                      dialogState.data?.onConfirm();
                      clearConfirm();
                    }}
                    className="px-4 py-2 text-xs font-medium bg-zinc-100 hover:bg-white text-black active:scale-[0.98] rounded-lg transition-all"
                  >
                    Confirmar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>,
    document.body
  );
}
