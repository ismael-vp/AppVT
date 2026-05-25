"use client";

import React, { useState } from 'react';
import { LogOut, User as UserIcon, Clock } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { useToastStore } from '@/store/useToast';
import { AuthModal } from './AuthModal';
import { HistoryModal } from './HistoryModal';

export const UserProfile: React.FC = () => {
  const { user, signOut } = useAuthStore();
  const { showConfirm } = useToastStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  if (!user) {
    return (
      <>
        <button
          onClick={() => setIsModalOpen(true)}
          className="text-[13px] text-zinc-400 hover:text-white transition-colors px-3 py-1.5 border border-zinc-800 hover:border-zinc-700 rounded-lg font-medium flex items-center gap-2"
        >
          <UserIcon size={14} />
          Iniciar Sesión
        </button>
        <AuthModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      </>
    );
  }

  const displayName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Usuario';
  const avatarUrl = user.user_metadata?.avatar_url;

  return (
    <div className="flex items-center gap-2 animate-in fade-in duration-300">
      {/* Avatar + name */}
      <div className="flex items-center gap-2">
        {avatarUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={avatarUrl} alt="Avatar" className="w-6 h-6 rounded-full border border-zinc-700" />
        ) : (
          <div className="w-6 h-6 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-white font-semibold text-[10px] shrink-0">
            {displayName.charAt(0).toUpperCase()}
          </div>
        )}
        <span className="text-[13px] text-zinc-300 font-medium hidden sm:block">{displayName}</span>
      </div>

      <div className="h-3.5 w-px bg-zinc-800 hidden sm:block" />

      <button
        onClick={() => setIsHistoryOpen(true)}
        className="text-zinc-500 hover:text-zinc-200 p-1.5 rounded-md transition-colors"
        title="Historial"
      >
        <Clock size={15} />
      </button>

      <button
        onClick={() =>
          showConfirm('¿Cerrar sesión?', () => signOut())
        }
        className="text-zinc-500 hover:text-red-400 p-1.5 rounded-md transition-colors"
        title="Cerrar sesión"
      >
        <LogOut size={15} />
      </button>

      <HistoryModal isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} />
    </div>
  );
};
