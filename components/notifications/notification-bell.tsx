"use client";

import * as React from "react";
import { Bell } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

import { NotificationCenter } from "./notification-center";
import { useReviewNotifications } from "./review-notifications-provider";

type NotificationBellProps = {
  className?: string;
};

function getUnreadLabel(unreadCount: number) {
  if (unreadCount === 0) {
    return "الإشعارات";
  }

  return `الإشعارات، ${unreadCount > 99 ? "99+" : unreadCount} غير مقروءة`;
}

function UnreadBadge({ unreadCount }: { unreadCount: number }) {
  if (unreadCount === 0) {
    return null;
  }

  return (
    <span
      aria-hidden="true"
      className="absolute -end-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[0.625rem] font-semibold leading-none text-primary-foreground"
    >
      {unreadCount > 99 ? "99+" : unreadCount}
    </span>
  );
}

export function NotificationBell({ className }: NotificationBellProps) {
  const { unreadCount } = useReviewNotifications();
  const [isDesktopOpen, setIsDesktopOpen] = React.useState(false);
  const [isMobileOpen, setIsMobileOpen] = React.useState(false);
  const triggerProps = {
    type: "button" as const,
    variant: "ghost" as const,
    size: "icon" as const,
    className: "relative",
    "aria-label": getUnreadLabel(unreadCount),
    title: "الإشعارات",
  };

  return (
    <div className={className}>
      <div className="hidden md:block">
        <DropdownMenu open={isDesktopOpen} onOpenChange={setIsDesktopOpen}>
          <DropdownMenuTrigger render={<Button {...triggerProps} />}>
            <Bell />
            <UnreadBadge unreadCount={unreadCount} />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            side="left"
            className="w-[min(24rem,calc(100vw-2rem))] max-w-none p-0"
          >
            <NotificationCenter
              isOpen={isDesktopOpen}
              onClose={() => setIsDesktopOpen(false)}
              presentation="menu"
              className="max-h-[min(30rem,calc(100svh-6rem))]"
            />
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="md:hidden">
        <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
          <SheetTrigger render={<Button {...triggerProps} />}>
            <Bell />
            <UnreadBadge unreadCount={unreadCount} />
          </SheetTrigger>
          <SheetContent
            side="bottom"
            dir="rtl"
            className="max-h-[80svh] gap-0 rounded-t-2xl p-0"
          >
            <SheetHeader className="border-b px-4 py-3 pe-12">
              <SheetTitle>الإشعارات</SheetTitle>
            </SheetHeader>
            <NotificationCenter
              isOpen={isMobileOpen}
              onClose={() => setIsMobileOpen(false)}
              presentation="plain"
              className="max-h-[calc(80svh-3.75rem)]"
            />
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
