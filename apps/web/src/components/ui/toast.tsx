"use client";

import { createContext, useContext, useCallback, useState, useRef, type ReactNode } from "react";
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type ToastType = "success" | "error" | "warning" | "info";

interface Toast {
  id: number;
  message: string;
  type: ToastType;
  exiting?: boolean;
}

interface ConfirmState {
  message: string;
  description?: string;
  confirmLabel?: string;
  variant?: "destructive" | "default";
  resolve: (confirmed: boolean) => void;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
  confirm: (opts: { message: string; description?: string; confirmLabel?: string; variant?: "destructive" | "default" }) => Promise<boolean>;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

const ICON_MAP: Record<ToastType, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const STYLE_MAP: Record<ToastType, string> = {
  success: "bg-emerald-600 text-white",
  error: "bg-red-600 text-white",
  warning: "bg-amber-500 text-white",
  info: "bg-zinc-800 text-white",
};

const DURATION_MS = 3500;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, exiting: true } : t)));
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 200);
  }, []);

  const toast = useCallback(
    (message: string, type: ToastType = "info") => {
      const id = nextId.current++;
      setToasts((prev) => [...prev, { id, message, type }]);
      setTimeout(() => dismiss(id), DURATION_MS);
    },
    [dismiss],
  );

  const confirm = useCallback(
    (opts: { message: string; description?: string; confirmLabel?: string; variant?: "destructive" | "default" }): Promise<boolean> => {
      return new Promise((resolve) => {
        setConfirmState({ ...opts, resolve });
      });
    },
    [],
  );

  const handleConfirm = useCallback((confirmed: boolean) => {
    confirmState?.resolve(confirmed);
    setConfirmState(null);
  }, [confirmState]);

  return (
    <ToastContext.Provider value={{ toast, confirm }}>
      {children}

      {/* Toast pills */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] flex flex-col items-center gap-2 pointer-events-none">
        {toasts.map((t) => {
          const Icon = ICON_MAP[t.type];
          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-center gap-2 px-4 py-2.5 rounded-full shadow-lg text-sm font-medium transition-all duration-200 ${STYLE_MAP[t.type]} ${
                t.exiting ? "opacity-0 -translate-y-2" : "opacity-100 translate-y-0 animate-slide-down"
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{t.message}</span>
              <button
                onClick={() => dismiss(t.id)}
                className="ml-1 p-0.5 rounded-full hover:bg-white/20 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Confirm dialog */}
      {confirmState && (
        <div className="fixed inset-0 z-[9999] flex items-start justify-center pt-[20vh]">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => handleConfirm(false)} />
          <div className="relative bg-white rounded-xl shadow-2xl border border-gray-200 p-6 w-full max-w-sm animate-slide-down">
            <div className="flex items-start gap-3">
              <div className={`mt-0.5 p-2 rounded-full ${confirmState.variant === "destructive" ? "bg-red-100" : "bg-amber-100"}`}>
                <AlertTriangle className={`w-5 h-5 ${confirmState.variant === "destructive" ? "text-red-600" : "text-amber-600"}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900">{confirmState.message}</p>
                {confirmState.description && (
                  <p className="mt-1 text-sm text-gray-500">{confirmState.description}</p>
                )}
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 mt-5">
              <Button variant="outline" size="sm" onClick={() => handleConfirm(false)}>
                Cancel
              </Button>
              <Button
                variant={confirmState.variant === "destructive" ? "destructive" : "default"}
                size="sm"
                onClick={() => handleConfirm(true)}
              >
                {confirmState.confirmLabel || "Confirm"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
}
