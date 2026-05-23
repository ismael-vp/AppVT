"use client";

import React, { useState } from 'react';
import { AuthModal } from './AuthModal';

interface RequireLoginPanelProps {
  title?: string;
  message?: string;
  children?: React.ReactNode;
}

export function RequireLoginPanel({ 
  title = "Acceso Requerido", 
  message = "Debes iniciar sesión para acceder a esta sección.",
  children
}: RequireLoginPanelProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <div className="relative w-full rounded-xl overflow-hidden min-h-[50vh]">
        
        {/* Background Blurred Content */}
        <div className="select-none pointer-events-none blur-[3px] opacity-60 h-full">
          {children}
        </div>

        {/* Floating Card Overlay */}
        <div className="absolute inset-0 flex items-center justify-center z-10 p-4 animate-in fade-in zoom-in-95 duration-500">
          <div className="bg-zinc-950/80 backdrop-blur-xl border border-zinc-800 rounded-xl p-8 w-full max-w-md shadow-2xl text-center pointer-events-auto">
            <h2 className="text-lg font-medium text-white mb-2">{title}</h2>
            <p className="text-sm text-zinc-400 mb-6">{message}</p>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="bg-white hover:bg-zinc-200 text-black px-6 py-2.5 rounded-lg text-sm font-medium transition-all active:scale-95 shadow-[0_0_15px_rgba(255,255,255,0.1)]"
            >
              Iniciar Sesión
            </button>
          </div>
        </div>
      </div>
      <AuthModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
}
