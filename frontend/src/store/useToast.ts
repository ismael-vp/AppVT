import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'info';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

export interface ConfirmDialog {
  message: string;
  onConfirm: () => void;
  onCancel?: () => void;
}

interface ToastState {
  toasts: Toast[];
  confirmDialog: ConfirmDialog | null;
  showToast: (message: string, type?: ToastType) => void;
  removeToast: (id: string) => void;
  showConfirm: (message: string, onConfirm: () => void, onCancel?: () => void) => void;
  clearConfirm: () => void;
}

let toastCounter = 0;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  confirmDialog: null,
  
  showToast: (message, type = 'info') => {
    const id = `toast-${++toastCounter}`;
    set((state) => {
      // Prevent identical consecutive toasts
      if (state.toasts.length > 0 && state.toasts[state.toasts.length - 1].message === message) {
        return state;
      }

      const newToasts = [...state.toasts, { id, message, type }];
      // Keep only the last 3 toasts to avoid filling the screen
      if (newToasts.length > 3) {
        newToasts.shift();
      }

      return { toasts: newToasts };
    });
    
    // Auto-dismiss
    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id)
      }));
    }, 4000);
  },
  
  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id)
    }));
  },
  
  showConfirm: (message, onConfirm, onCancel) => {
    set({ confirmDialog: { message, onConfirm, onCancel } });
  },
  
  clearConfirm: () => {
    set({ confirmDialog: null });
  }
}));
