"use client";

import { Bell } from "lucide-react";

import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { UserNotification } from "@/types";

type NotificationItemProps = {
  notification: UserNotification;
  isPending?: boolean;
  presentation: "menu" | "plain";
  onSelect: (notification: UserNotification) => void;
};

function formatNotificationTime(createdAt: UserNotification["createdAt"]) {
  const createdAtDate = createdAt?.toDate?.();

  if (!createdAtDate) {
    return "الآن";
  }

  const differenceInMinutes = Math.max(
    0,
    Math.floor((Date.now() - createdAtDate.getTime()) / 60_000)
  );

  if (differenceInMinutes < 1) {
    return "الآن";
  }

  if (differenceInMinutes < 60) {
    return `منذ ${differenceInMinutes} د`;
  }

  const differenceInHours = Math.floor(differenceInMinutes / 60);

  if (differenceInHours < 24) {
    return `منذ ${differenceInHours} س`;
  }

  return new Intl.DateTimeFormat("ar", {
    day: "numeric",
    month: "short",
  }).format(createdAtDate);
}

export function NotificationItem({
  notification,
  isPending = false,
  presentation,
  onSelect,
}: NotificationItemProps) {
  const content = (
    <>
      <Bell className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 space-y-0.5 text-start">
        <span className="flex items-start justify-between gap-3">
          <span className="truncate text-sm font-medium text-foreground">
            {notification.title}
          </span>
          {!notification.isRead ? (
            <span
              aria-label="غير مقروء"
              className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary"
            />
          ) : null}
        </span>
        <span className="line-clamp-2 text-xs leading-5 text-muted-foreground">
          {notification.body}
        </span>
        <span className="block text-[0.7rem] text-muted-foreground/80">
          {formatNotificationTime(notification.createdAt)}
        </span>
      </span>
    </>
  );
  const className = cn(
    "flex w-full items-start gap-2.5 rounded-md px-3 py-2.5 text-start whitespace-normal",
    !notification.isRead && "bg-accent/70"
  );

  if (presentation === "menu") {
    return (
      <DropdownMenuItem
        className={className}
        disabled={isPending}
        onClick={() => onSelect(notification)}
      >
        {content}
      </DropdownMenuItem>
    );
  }

  return (
    <button
      type="button"
      className={cn(
        className,
        "transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-60"
      )}
      disabled={isPending}
      onClick={() => onSelect(notification)}
    >
      {content}
    </button>
  );
}
