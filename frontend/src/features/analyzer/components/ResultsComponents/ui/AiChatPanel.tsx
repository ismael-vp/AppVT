import React from 'react';
import { Send } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { RequireLoginPanel } from '@/components/auth/RequireLoginPanel';

import { ChatMessage } from '@/store/useThreatStore';

interface AiChatPanelProps {
  chatMessages: ChatMessage[];
  chatInput: string;
  setChatInput: (val: string) => void;
  isChatLoading: boolean;
  handleSendMessage: (e: React.FormEvent) => void;
  handleClearChat?: () => void;
  handleEditMessage?: (index: number) => void;
  placeholder?: string;
  emptyStateMessage?: string;
}

export default function AiChatPanel({
  chatMessages,
  chatInput,
  setChatInput,
  isChatLoading,
  handleSendMessage,
  handleClearChat,
  handleEditMessage,
  placeholder = "Pregunta algo a la IA...",
  emptyStateMessage = "Puedes hacer preguntas sobre los resultados del análisis."
}: AiChatPanelProps) {
  const { session } = useAuthStore();

  if (!session) {
    return (
      <RequireLoginPanel 
        title="Acceso Requerido" 
        message="Debes iniciar sesión para consultar al analista de IA." 
      >
        <div className="bg-black border border-[#333] rounded-lg p-6 h-[250px] flex flex-col">
          <div className="h-6 w-40 bg-[#222] rounded mb-6"></div>
          <div className="space-y-4 flex-1">
            <div className="space-y-2 flex flex-col items-end">
              <div className="h-3 w-10 bg-[#222] rounded"></div>
              <div className="h-8 w-1/3 bg-[#1a1a1a] rounded-lg"></div>
            </div>
            <div className="space-y-2">
              <div className="h-3 w-10 bg-[#222] rounded"></div>
              <div className="h-10 w-2/3 bg-[#1a1a1a] rounded-lg"></div>
            </div>
          </div>
          <div className="h-10 w-full bg-[#111] rounded-md border border-[#333] mt-auto"></div>
        </div>
      </RequireLoginPanel>
    );
  }

  return (
    <div className="bg-[#0d0d0d] border border-zinc-800/50 rounded-xl p-5">
      <div className="flex justify-between items-center mb-5">
        <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Consulta a la IA</p>
        {handleClearChat && chatMessages.length > 0 && (
          <button onClick={handleClearChat} className="text-xs text-zinc-600 hover:text-zinc-300 transition-colors">
            Limpiar
          </button>
        )}
      </div>

      <div className="space-y-5 mb-5 max-h-[350px] overflow-y-auto pr-1 custom-scrollbar">
        {chatMessages.map((msg, idx) => (
          <div key={idx} className="flex flex-col gap-1">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-medium text-zinc-600 uppercase tracking-wider">
                {msg.role === 'user' ? 'Tú' : 'IA'}
              </span>
              {msg.role === 'user' && handleEditMessage && (
                <button onClick={() => handleEditMessage(idx)} className="text-[10px] text-zinc-700 hover:text-zinc-400 transition-colors">
                  Editar
                </button>
              )}
            </div>
            <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">{msg.content}</p>
          </div>
        ))}

        {isChatLoading && (
          <div className="flex flex-col gap-1 animate-pulse">
            <span className="text-[10px] font-medium text-zinc-600 uppercase tracking-wider">IA</span>
            <p className="text-sm text-zinc-500">Analizando…</p>
          </div>
        )}

        {chatMessages.length === 0 && !isChatLoading && (
          <p className="text-xs text-zinc-600">{emptyStateMessage}</p>
        )}
      </div>

      <form onSubmit={handleSendMessage} className="relative flex items-center">
        <input
          type="text"
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-[#080808] border border-zinc-800/80 text-sm text-zinc-200 rounded-lg py-3 pl-4 pr-12 focus:outline-none focus:border-zinc-600 transition-colors placeholder:text-zinc-700"
          disabled={isChatLoading}
        />
        <button
          type="submit"
          disabled={!chatInput.trim() || isChatLoading}
          className="absolute right-3 p-1.5 text-zinc-500 disabled:text-zinc-700 hover:text-zinc-200 transition-colors cursor-pointer disabled:cursor-not-allowed"
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
