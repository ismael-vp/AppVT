import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ScanMode, ScanResult } from '@/types';
import { ScanResultSchema } from '@/lib/validations';
import { supabase } from '@/lib/supabase';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ThreatState {
  // Estado
  mode: ScanMode;
  isScanning: boolean;
  scanResult: ScanResult | null;
  error: string | null;
  history: ScanResult[];
  chats: Record<string, ChatMessage[]>;

  // Acciones
  setMode: (mode: ScanMode) => void;
  setIsScanning: (isScanning: boolean) => void;
  setScanResult: (result: ScanResult | null, resourceName?: string) => void;
  setError: (error: string | null) => void;
  resetState: () => void;
  clearHistory: () => void;
  saveChat: (id: string, messages: ChatMessage[]) => void;
  clearChat: (id: string) => void;
  syncFromCloud: () => Promise<void>;
  shareCurrentReport: () => Promise<string | null>;
  viewSharedReport: (result: ScanResult) => void;
}

// -----------------------------------------------------------------------------
// Zustand Store con Persistencia (Híbrido: LocalStorage + Supabase)
// -----------------------------------------------------------------------------

export const useThreatStore = create<ThreatState>()(
  persist(
    (set, get) => ({
      // Valores iniciales
      mode: 'url',
      isScanning: false,
      scanResult: null,
      error: null,
      history: [],
      chats: {},

      // Setters
      setMode: (mode) => set({ mode }),
      setIsScanning: (isScanning) => set({ isScanning }),
      setScanResult: async (result, resourceName) => {
        if (!result) {
          set({ scanResult: null, error: null });
          return;
        }

        const validation = ScanResultSchema.safeParse(result);
        if (!validation.success) {
          console.error("Error de validación en los datos de la API:", validation.error);
        }

        const validatedData = validation.success ? validation.data : result;

        const normalizedName = resourceName
          || validatedData.resourceName
          || (validatedData.type === 'url' ? 'URL Desconocida' : 'Archivo Analizado');

        const redirectChain = validatedData.osint_data?.redirect_chain;
        const finalUrl = (validatedData.type === 'url' && redirectChain && redirectChain.length > 0)
          ? redirectChain[redirectChain.length - 1]
          : normalizedName;

        const enrichedResult: ScanResult = {
          ...validatedData,
          resourceName: finalUrl,
          timestamp: new Date().toISOString()
        } as ScanResult;

        const state = get();
        const newHistory = [
          enrichedResult,
          ...state.history.filter(h => h.resourceName !== finalUrl)
        ].slice(0, 15);

        set({ 
          scanResult: enrichedResult, 
          error: null,
          history: newHistory
        });

        // Sincronización transparente con Supabase si está logueado
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          try {
            // Borrar registro anterior si existe para no duplicar historiales
            await supabase.from('scan_reports').delete().match({
              user_id: session.user.id,
              input_target: finalUrl
            });

            // Guardamos el escaneo en la base de datos
            await supabase.from('scan_reports').insert({
              user_id: session.user.id,
              input_target: finalUrl,
              scan_data: enrichedResult,
              is_public: false
            });
          } catch (e) {
            console.error("Error guardando historial en la nube", e);
          }
        }
      },
      setError: (error) => set({ error, scanResult: null, isScanning: false }),
      resetState: () => set({ isScanning: false, scanResult: null, error: null }),
      clearHistory: () => set({ history: [] }),
      saveChat: (id, messages) => set((state) => ({ chats: { ...state.chats, [id]: messages } })),
      clearChat: (id) => set((state) => {
        const newChats = { ...state.chats };
        delete newChats[id];
        return { chats: newChats };
      }),
      shareCurrentReport: async () => {
        const state = get();
        if (!state.scanResult) return null;
        
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          throw new Error('Debes iniciar sesión para poder compartir reportes.');
        }

        try {
          // Buscamos el reporte exacto en la base de datos
          const { data, error: findError } = await supabase
            .from('scan_reports')
            .select('id')
            .eq('user_id', session.user.id)
            .eq('input_target', state.scanResult.resourceName)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          if (findError) throw findError;

          // Lo hacemos público
          const { error: updateError } = await supabase
            .from('scan_reports')
            .update({ is_public: true })
            .eq('id', data.id);

          if (updateError) throw updateError;

          return data.id;
        } catch (e: unknown) {
          console.error("Error al compartir", e);
          throw new Error('No se pudo generar el enlace. Inténtalo de nuevo.');
        }
      },
      viewSharedReport: (result) => {
        // Establece el resultado en el store SIN guardarlo en el historial local ni en Supabase
        set({ scanResult: result, error: null, isScanning: false });
      },
      syncFromCloud: async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) return;

        try {
          const { data, error } = await supabase
            .from('scan_reports')
            .select('scan_data')
            .order('created_at', { ascending: false })
            .limit(15);
            
          if (error) throw error;

          if (data && data.length > 0) {
            const cloudHistory = data.map((row) => row.scan_data as ScanResult);
            // Combinar y deduplicar (priorizando la nube)
            const localHistory = get().history;
            const merged = [...cloudHistory, ...localHistory];
            const unique = Array.from(new Map(merged.map(item => [item.resourceName, item])).values()).slice(0, 15);
            
            set({ history: unique });
          }
        } catch (e) {
          console.error("Error sincronizando historial desde la nube", e);
        }
      }
    }),
    {
      name: 'threat-history-storage',
      partialize: (state) => ({ 
        history: state.history.map(item => ({
          ...item,
          osint_data: item.osint_data ? {
            ...item.osint_data,
            html_content: "",
            screenshot_desktop: "",
            screenshot_mobile: "",
          } : null
        })),
        chats: state.chats
      }), 
    }
  )
);
