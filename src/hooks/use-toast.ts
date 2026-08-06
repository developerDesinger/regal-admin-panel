import * as React from 'react';

export type ToastTone = 'success' | 'danger' | 'warning' | 'info';

export interface ToastItem {
  id: number;
  title: string;
  description?: string;
  tone: ToastTone;
}

export interface ToastContextValue {
  toast: (t: Omit<ToastItem, 'id' | 'tone'> & { tone?: ToastTone }) => void;
}

export const ToastContext = React.createContext<ToastContextValue>({ toast: () => {} });

/** Live regions announce async results — export ready, action saved, error (§21). */
export function useToast() {
  return React.useContext(ToastContext);
}
