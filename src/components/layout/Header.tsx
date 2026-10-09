"use client";

import * as React from "react";
import { Menu, Bell, UserRound } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ApronIcon } from "@/components/icons/ApronIcon";

interface HeaderProps {
  onOpenMenu: () => void;
  title?: string;
}

export const Header = React.forwardRef<HTMLButtonElement, HeaderProps>(
  function Header({ onOpenMenu, title }, ref) {
    return (
      <header className="sticky top-0 z-20 px-4 pt-4">
        <div className="glass !p-3 flex items-center gap-3">
          <Button
            ref={ref}
            variant="ghost"
            size="icon"
            onClick={onOpenMenu}
            aria-label="Open menu"
            className="h-10 w-10"
          >
            <Menu size={18} />
          </Button>
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <ApronIcon size={26} />
            {title ? (
              <div className="truncate text-base font-semibold text-white">
                {title}
              </div>
            ) : (
              <div className="flex flex-col leading-tight min-w-0">
                <span className="text-sm font-bold text-gradient-gold">
                  APRON
                </span>
                <span className="text-[11px] text-white/60 truncate">
                  Earn APN, daily
                </span>
              </div>
            )}
          </div>
          <Button variant="ghost" size="icon" className="h-10 w-10" aria-label="Notifications">
            <Bell size={18} />
          </Button>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/5 text-white/80">
            <UserRound size={18} />
          </div>
        </div>
      </header>
    );
  },
);
