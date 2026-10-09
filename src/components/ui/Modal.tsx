"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";

export interface ModalProps {
  open: boolean;
  onClose?: () => void;
  onOpenChange?: (open: boolean) => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "area[href]",
  "button:not(:disabled)",
  "input:not(:disabled)",
  "select:not(:disabled)",
  "textarea:not(:disabled)",
  "iframe",
  "object",
  "embed",
  "[contenteditable]",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

function getFocusable(container: Element): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => el.offsetParent !== null || el.getClientRects().length > 0,
  );
}

function useClose(
  onClose: (() => void) | undefined,
  onOpenChange: ((o: boolean) => void) | undefined,
) {
  return React.useCallback(() => {
    onClose?.();
    onOpenChange?.(false);
  }, [onClose, onOpenChange]);
}

function ModalBase(
  {
    open,
    onClose,
    onOpenChange,
    title,
    description,
    children,
    footer,
    size = "md",
    className,
  }: ModalProps,
  ref: React.Ref<HTMLDivElement>,
) {
  const close = useClose(onClose, onOpenChange);
  const dialogRef = React.useRef<HTMLDivElement | null>(null);
  const lastFocusedRef = React.useRef<HTMLElement | null>(null);
  const setRef = (node: HTMLDivElement | null) => {
    dialogRef.current = node;
    if (typeof ref === "function") ref(node);
    else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
  };

  React.useEffect(() => {
    if (!open) return;
    lastFocusedRef.current = document.activeElement as HTMLElement | null;

    const focusFirst = () => {
      const el = dialogRef.current;
      if (!el) return;
      const focusables = getFocusable(el);
      const target = focusables[0] ?? el;
      target.focus({ preventScroll: true });
    };
    focusFirst();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key !== "Tab" || !dialogRef.current) return;
      const focusables = getFocusable(dialogRef.current);
      if (focusables.length === 0) {
        e.preventDefault();
        dialogRef.current.focus({ preventScroll: true });
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey) {
        if (active === first || !focusables.includes(active ?? ({} as HTMLElement))) {
          e.preventDefault();
          last.focus({ preventScroll: true });
        }
      } else {
        if (active === last || !focusables.includes(active ?? ({} as HTMLElement))) {
          e.preventDefault();
          first.focus({ preventScroll: true });
        }
      }
    };
    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("keydown", onKey);
      const last = lastFocusedRef.current;
      if (last && typeof last.focus === "function") {
        last.focus({ preventScroll: true });
      }
      lastFocusedRef.current = null;
    };
  }, [open, close]);

  if (!open) return null;

  return (
    <div
      ref={setRef}
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      role="dialog"
      aria-modal="true"
      tabIndex={-1}
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={close}
      />
      <div
        className={cn(
          "relative z-10 w-full glass p-6 animate-fade-in",
          size === "sm" && "max-w-sm",
          size === "md" && "max-w-md",
          size === "lg" && "max-w-lg",
          className,
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            {title ? (
              <h2 className="text-lg font-semibold text-white">{title}</h2>
            ) : null}
            {description ? (
              <p className="mt-1 text-sm text-white/60">{description}</p>
            ) : null}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={close}
            aria-label="Close"
            className="h-9 w-9 -mr-1 -mt-1"
          >
            <X size={18} />
          </Button>
        </div>
        <div className="mt-4">{children}</div>
        {footer ? <div className="mt-5 flex justify-end gap-2">{footer}</div> : null}
      </div>
    </div>
  );
}

const ModalRoot = React.forwardRef<HTMLDivElement, ModalProps>(ModalBase);
ModalRoot.displayName = "Modal";

// Compound sub-components (sugar; not strictly required, but mirrors shadcn-like API)
function ModalHeader({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cn("flex flex-col gap-1", className)}>{children}</div>;
}

function ModalTitle({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <h2 className={cn("text-lg font-semibold text-white", className)}>
      {children}
    </h2>
  );
}

function ModalBody({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cn("mt-4 space-y-3", className)}>{children}</div>;
}

function ModalFooter({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn("mt-5 flex flex-col-reverse sm:flex-row justify-end gap-2", className)}
    >
      {children}
    </div>
  );
}

// "content" wrapper alias (kept for API compatibility; it just wraps + mounts Modal)
const Modal = Object.assign(ModalRoot, {
  Header: ModalHeader,
  Title: ModalTitle,
  Body: ModalBody,
  Footer: ModalFooter,
});

// Also export as named compound components
export {
  Modal,
  ModalHeader,
  ModalTitle,
  ModalBody,
  ModalFooter,
  ModalContent as _Noop,
};

// Standalone ModalContent export (some callers use this)
export function ModalContent(props: { children: React.ReactNode; className?: string }) {
  // NOTE: ModalContent should only be used as the direct first child of <Modal> when the modal uses props API
  return <div className={cn("space-y-4", props.className)}>{props.children}</div>;
}

export default Modal;
