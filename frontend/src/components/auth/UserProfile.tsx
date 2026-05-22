"use client";

import React, { useState } from 'react';
import { LogOut, User as UserIcon, Clock } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { AuthModal } from './AuthModal';
import { HistoryModal } from './HistoryModal';

export const UserProfile: React.FC = () => {
  const { user, signOut } = useAuthStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  if (!user) {
    return (
      <>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-[#222] hover:bg-[#333] text-white px-4 py-2 rounded-lg text-sm font-medium transition-all active:scale-95 border border-[#444]"
        >
          <UserIcon size={16} />
          <span>Iniciar Sesión</span>
        </button>
        <AuthModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      </>
    );
  }

  // Get user display name (from Google or email)
  const displayName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Usuario';
  const avatarUrl = user.user_metadata?.avatar_url;

  return (
    <div className="flex items-center gap-4 animate-in fade-in duration-300">
      <div className="flex items-center gap-3">
        {avatarUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={avatarUrl} alt="Avatar" className="w-8 h-8 rounded-full border border-[#444]" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-xs">
            {displayName.charAt(0).toUpperCase()}
          </div>
        )}
        <span className="text-[#ededed] text-sm font-medium hidden sm:block">{displayName}</span>
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={() => setIsHistoryOpen(true)}
          className="text-[#888] hover:text-white p-2 rounded-lg hover:bg-zinc-800 transition-colors active:scale-90 flex items-center gap-2"
          title="Ver historial de escaneos"
        >
          <Clock size={18} />
          <span className="hidden sm:block text-xs font-medium">Historial</span>
        </button>

        <button
          onClick={signOut}
          className="text-[#888] hover:text-red-400 p-2 rounded-lg hover:bg-red-500/10 transition-colors active:scale-90"
          title="Cerrar sesión"
        >
          <LogOut size={18} />
        </button>
      </div>
      
      <HistoryModal isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} />
    </div>
  );
};
