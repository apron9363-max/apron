"use client";

import * as React from "react";
import { X, CheckCircle2, AlertCircle, Info, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";

type ToastVariant = "default" | "success" | "error" | "warning" | "info";

interface ToastOptions {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  variant?: ToastVariant;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastContextValue {
  toasts: ToastOptions[];
  toast: (options: Omit<ToastOptions, "id">) => string;
  dismiss: (id: string) => void;
  dismissAll: () => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

function useToastId() {
  const [idCounter, setIdCounter] = React.useState(0);
  return React.useCallback(() => {
    setIdCounter((c) => c + 1);
    return `toast-${Date.now()}-${idCounter}`;
  }, [idCounter]);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastOptions[]>([]);
  const nextId = useToastId();

  const dismiss = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const dismissAll = React.useCallback(() => {
    setToasts([]);
  }, []);

  const toast = React.useCallback(
    (options: Omit<ToastOptions, "id">) => {
      const id = nextId();
      const duration = options.duration ?? 5000;
      setToasts((prev) => [...prev, { ...options, id }]);
      if (duration > 0) {
        setTimeout(() => dismiss(id), duration);
      }
      return id;
    },
    [nextId, dismiss],
  );

  const value = React.useMemo<ToastContextValue>(
    () => ({ toasts, toast, dismiss, dismissAll }),
    [toasts, toast, dismiss, dismissAll],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
}

function variantIcon(variant: ToastVariant) {
  switch (variant) {
    case "success":
      return <CheckCircle2 size={18} className="text-emerald-400" />;
    case "error":
      return <AlertCircle size={18} className="text-red-400" />;
    case "warning":
      return <AlertTriangle size={18} className="text-amber-400" />;
    case "info":
      return <Info size={18} className="text-sky-400" />;
    default:
      return null;
  }
}

function variantStyles(variant: ToastVariant): string {
  switch (variant) {
    case "success":
      return "border-l-4 border-l-emerald-400";
    case "error":
      return "border-l-4 border-l-red-400";
    case "warning":
      return "border-l-4 border-l-amber-400";
    case "info":
      return "border-l-4 border-l-sky-400";
    default:
      return "";
  }
}

function ToastItem({ toast, onDismiss }: { toast: ToastOptions; onDismiss: (id: string) => void }) {
  const variant = toast.variant ?? "default";
  return (
    <div
      role="status"
      className={cn(
        "glass pointer-events-auto relative w-full max-w-sm animate-fade-in",
        "p-4 pr-10 shadow-xl",
        variantStyles(variant),
      )}
      data-toast-id={toast.id}
    >
      <div className="flex items-start gap-3">
        {variantIcon(variant)}
        <div className="flex-1 min-w-0">
        {toast.title ? (
          <div className="text-sm font-semibold text-white">{toast.title}</div>
        ) : null}
        {toast.description ? (
          <div className="mt-1 text-sm text-white/70">{toast.description}</div>
        ) : null}
        {toast.action ? (
          <div className="mt-3">
            <Button
              variant="ghost"
              size="xs"
              onClick={() => {
                toast.action?.onClick?.();
                onDismiss(toast.id);
              }}
            >
              {toast.action.label}
            </Button>
          </div>
        ) : null}
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Dismiss toast"
        onClick={() => onDismiss(toast.id)}
        className="absolute right-2 top-2 h-7 w-7"
      >
        <X size={14} />
      </Button>
    </div>
  );
}

export function ToastViewport() {
  const { toasts, dismiss } = useToast();
  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="pointer-events-none fixed inset-0 z-[100] flex flex-col items-end justify-end gap-2 p-4 sm:p-6"
    >
      <div className="mt-auto flex w-full flex-col items-end gap-2 sm:max-w-sm">
        {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
      ))}
      </div>
    </div>
  );
}
