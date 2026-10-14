import type { User } from "firebase/auth";

import { cn } from "@/lib/utils";

type AccountSummaryProps = {
  user: User;
  className?: string;
  detailsClassName?: string;
};

function getAvatarFallback(user: User) {
  return (user.displayName ?? user.email ?? "م").trim().charAt(0).toUpperCase();
}

export function AccountSummary({
  user,
  className,
  detailsClassName,
}: AccountSummaryProps) {
  return (
    <div className={cn("flex min-w-0 items-center gap-2", className)}>
      {user.photoURL ? (
        <img
          src={user.photoURL}
          alt=""
          className="size-8 shrink-0 rounded-full border bg-muted object-cover"
          referrerPolicy="no-referrer"
        />
      ) : (
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-xs font-medium text-sidebar-accent-foreground">
          {getAvatarFallback(user)}
        </span>
      )}

      <div className={cn("min-w-0", detailsClassName)}>
        <p className="truncate text-sm font-medium">
          {user.displayName || "حساب Google"}
        </p>
        {user.email ? (
          <p dir="ltr" className="truncate text-xs text-muted-foreground">
            {user.email}
          </p>
        ) : null}
      </div>
    </div>
  );
}
