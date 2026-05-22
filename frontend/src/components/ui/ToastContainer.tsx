"use client";

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useToastStore } from '@/store/useToast';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export default function ToastContainer() {
  const { toasts, removeToast, confirmDialog, clearConfirm } = useToastStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

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
      {confirmDialog && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => {
              if (confirmDialog.onCancel) confirmDialog.onCancel();
              clearConfirm();
            }}
          />
          <div className="relative bg-[#0a0a0a] border border-zinc-800 rounded-xl shadow-2xl p-6 max-w-sm w-full animate-in zoom-in-95 fade-in duration-200">
            <div className="flex items-start gap-4">
              <div className="bg-yellow-500/10 text-yellow-500 p-2.5 rounded-full shrink-0">
                <AlertCircle size={24} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Confirmar acción</h3>
                <p className="text-zinc-400 text-sm mb-6 leading-relaxed">
                  {confirmDialog.message}
                </p>
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => {
                      if (confirmDialog.onCancel) confirmDialog.onCancel();
                      clearConfirm();
                    }}
                    className="px-4 py-2 text-sm font-medium text-zinc-300 hover:text-white transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => {
                      confirmDialog.onConfirm();
                      clearConfirm();
                    }}
                    className="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
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
