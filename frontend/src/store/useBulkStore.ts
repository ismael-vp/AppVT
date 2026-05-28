import { create } from 'zustand';

export interface UrlResult {
  url: string;
  status: 'pending' | 'scanning' | 'waiting' | 'done' | 'error';
  label?: 'safe' | 'suspicious' | 'malicious';
  score?: number;
  errorMsg?: string;
}

export const bulkAbortRef = { current: false };
export const bulkCountdownRef = { current: null as ReturnType<typeof setInterval> | null };

interface BulkState {
  rawText: string;
  results: UrlResult[];
  running: boolean;
  started: boolean;
  countdown: number;

  setRawText: (text: string) => void;
  setResults: (results: UrlResult[] | ((prev: UrlResult[]) => UrlResult[])) => void;
  setRunning: (running: boolean) => void;
  setStarted: (started: boolean) => void;
  setCountdown: (countdown: number | ((prev: number) => number)) => void;
  reset: () => void;
}

export const useBulkStore = create<BulkState>((set) => ({
  rawText: '',
  results: [],
  running: false,
  started: false,
  countdown: 0,

  setRawText: (text) => set({ rawText: text }),
  setResults: (updater) => set((state) => ({
    results: typeof updater === 'function' ? updater(state.results) : updater
  })),
  setRunning: (running) => set({ running }),
  setStarted: (started) => set({ started }),
  setCountdown: (updater) => set((state) => ({
    countdown: typeof updater === 'function' ? updater(state.countdown) : updater
  })),
  reset: () => set({
    rawText: '',
    results: [],
    running: false,
    started: false,
    countdown: 0
  })
}));
