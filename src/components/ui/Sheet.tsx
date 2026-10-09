"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";

export interface SheetProps {
  open: boolean;
  onClose?: () => void;
  onOpenChange?: (open: boolean) => void;
  side?: "left" | "right" | "top" | "bottom";
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

function sheetSizeClass(size: SheetProps["size"], side: SheetProps["side"]) {
  const isHorizontal = side === "left" || side === "right";
  if (isHorizontal) {
    switch (size) {
      case "sm":
        return "max-w-sm w-full";
      case "md":
      default:
        return "max-w-md w-full";
      case "lg":
        return "max-w-lg w-full";
    }
  }
  switch (size) {
    case "sm":
      return "max-h-sm h-auto sm:max-h-[40vh]";
    case "md":
    default:
      return "max-h-[55vh] h-auto";
    case "lg":
      return "max-h-[75vh] h-auto";
  }
}

function SheetBase(
  {
    open,
    onClose,
    onOpenChange,
    side = "right",
    title,
    description,
    children,
    footer,
    size = "md",
    className,
  }: SheetProps,
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

  const isLeft = side === "left";
  const isRight = side === "right";
  const isTop = side === "top";
  const isBottom = side === "bottom";

  const positionClasses = cn(
    isLeft && "inset-y-0 left-0 h-full",
    isRight && "inset-y-0 right-0 h-full",
    isTop && "inset-x-0 top-0 w-full",
    isBottom && "inset-x-0 bottom-0 w-full",
  );

  const enterAnimation = cn(
    isLeft && "animate-[slide-in-right_220ms_ease-out]",
    isRight && "animate-[slide-in-left_220ms_ease-out]",
    isTop && "animate-[slide-in-down_220ms_ease-out]",
    isBottom && "animate-[slide-in-up_220ms_ease-out]",
  );

  return (
    <div
      ref={setRef}
      className="fixed inset-0 z-50"
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
          "absolute z-10 glass p-5 sm:p-6 flex flex-col",
          positionClasses,
          sheetSizeClass(size, side),
          enterAnimation,
          className,
        )}
      >
        <div className="flex items-start justify-between gap-3 shrink-0">
          <div className="flex-1 min-w-0">
            {title ? (
              <h2 id="sheet-title" className="text-lg font-semibold text-white">
                {title}
              </h2>
            ) : null}
            {description ? (
              <p id="sheet-description" className="mt-1 text-sm text-white/60 break-words">
                {description}
              </p>
            ) : null}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={close}
            aria-label="Close"
            className="h-9 w-9 -mr-1 -mt-1 shrink-0"
          >
            <X size={18} />
          </Button>
        </div>
        <div className="mt-4 flex-1 overflow-y-auto min-h-0 pr-1">{children}</div>
        {footer ? (
          <div className="mt-5 pt-2 shrink-0 flex flex-col-reverse sm:flex-row justify-end gap-2">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

const SheetRoot = React.forwardRef<HTMLDivElement, SheetProps>(SheetBase);
SheetRoot.displayName = "Sheet";

function SheetHeader({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cn("flex flex-col gap-1", className)}>{children}</div>;
}

function SheetTitle({
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

function SheetBody({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cn("mt-4 space-y-3", className)}>{children}</div>;
}

function SheetFooter({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "mt-5 pt-2 shrink-0 flex flex-col-reverse sm:flex-row justify-end gap-2",
        className,
      )}
    >
      {children}
    </div>
  );
}

const Sheet = Object.assign(SheetRoot, {
  Header: SheetHeader,
  Title: SheetTitle,
  Body: SheetBody,
  Footer: SheetFooter,
});

export { Sheet, SheetHeader, SheetTitle, SheetBody, SheetFooter };

export default Sheet;
