import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { useThreatStore, ChatMessage } from '@/store/useThreatStore';
import { ScanResult } from '@/types';
import { API_URL } from '@/lib/api';

export function useAiChat(scanResult: ScanResult) {
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const isSubmittingRef = useRef(false);

  const { chats, saveChat, clearChat } = useThreatStore();
  const chatId = scanResult?.resourceName || 'default';
  const chatMessages = chats[chatId] || [];

  const abortControllerRef = useRef<AbortController | null>(null);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!chatInput.trim() || isChatLoading || isSubmittingRef.current) return;

    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();

    isSubmittingRef.current = true;

    const newMessage: ChatMessage = { role: 'user', content: chatInput.trim() };
    const updatedMessages = [...chatMessages, newMessage];

    saveChat(chatId, updatedMessages);
    setChatInput('');
    setIsChatLoading(true);

    const MAX_MESSAGES_TO_SEND = 18;
    const messagesToSend = updatedMessages.slice(-MAX_MESSAGES_TO_SEND);

    try {
      const response = await axios.post(`${API_URL}/api/chat`, {
        messages: messagesToSend,
        scan_context: scanResult
      }, { signal: abortControllerRef.current.signal });

      // Fix 9: leer estado fresco del store en el callback, no el closure de updatedMessages
      const freshMessages = useThreatStore.getState().chats[chatId] || [];
      if (response.data.reply) {
        saveChat(chatId, [...freshMessages, { role: 'assistant', content: response.data.reply }]);
      } else {
        saveChat(chatId, [...freshMessages, { role: 'assistant', content: 'Lo siento, ocurrió un error procesando tu solicitud.' }]);
      }
    } catch (error) {
      if (axios.isCancel(error)) return;
      const freshMessages = useThreatStore.getState().chats[chatId] || [];
      saveChat(chatId, [...freshMessages, { role: 'assistant', content: 'Error de conexión con el servidor IA.' }]);
    } finally {
      setIsChatLoading(false);
      isSubmittingRef.current = false;
    }
  };

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);

  const handleClearChat = () => {
    clearChat(chatId);
    setChatInput('');
  };

  const handleEditMessage = (index: number) => {
    const msg = chatMessages[index];
    if (msg && msg.role === 'user') {
      setChatInput(msg.content);
      const updatedMessages = chatMessages.slice(0, index);
      saveChat(chatId, updatedMessages);
    }
  };

  return {
    chatInput,
    setChatInput,
    chatMessages,
    isChatLoading,
    handleSendMessage,
    handleClearChat,
    handleEditMessage
  };
}
