"use client";

import * as React from "react";
import { Header } from "./Header";
import { SideMenu } from "./SideMenu";
import { BottomNav } from "./BottomNav";
import { ToastProvider, ToastViewport } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";

interface AppShellProps {
  children: React.ReactNode;
  variant?: "app" | "admin";
  title?: string;
  className?: string;
}

export function AppShell({
  children,
  variant = "app",
  title,
  className,
}: AppShellProps) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const hamburgerRef = React.useRef<HTMLButtonElement>(null);

  const appContent = (
    <>
      <div
        className={cn(
          "mx-auto min-h-screen w-full max-w-[430px] md:max-w-2xl lg:max-w-4xl xl:max-w-6xl pb-28 lg:pb-10",
        )}
      >
        <Header
          ref={hamburgerRef}
          onOpenMenu={() => setMenuOpen(true)}
          title={title}
        />
        <main
          className={cn(
            "px-4 pt-5 md:px-6 md:pt-6 lg:px-8",
            className,
          )}
        >
          {children}
        </main>
      </div>
      <SideMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        onOpen={() => setMenuOpen(true)}
        triggerRef={hamburgerRef}
      />
      <BottomNav />
    </>
  );

  return (
    <ToastProvider>
      <div className="min-h-screen w-full bg-apron-gradient">
        {variant === "app" ? (
          appContent
        ) : (
          <div
            className={cn(
              "mx-auto min-h-screen w-full max-w-6xl pb-10 px-4 md:px-6 lg:px-8",
            )}
          >
            <main
              className={cn(
                "pt-6 md:pt-8",
                className,
              )}
            >
              {children}
            </main>
          </div>
        )}
      </div>
      <ToastViewport />
    </ToastProvider>
  );
}
