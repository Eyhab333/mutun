"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";

import { AccountSummary } from "@/components/auth/account-summary";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { isNavigationItemActive, secondaryNavigationItems } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";

export function MobilePageMenu() {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();
  const { user } = useAuth();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label="فتح القائمة"
          />
        }
      >
        <Menu />
      </SheetTrigger>

      <SheetContent
        side="right"
        dir="rtl"
        showCloseButton={false}
        className="w-3/4 max-w-sm p-0"
      >
        <SheetHeader className="flex-row items-center justify-between gap-4 border-b px-4 py-3">
          <div className="space-y-0.5 text-start">
            <SheetTitle>القائمة</SheetTitle>
            <SheetDescription>إعدادات وخيارات التطبيق</SheetDescription>
          </div>

          <SheetClose
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="إغلاق القائمة"
              />
            }
          >
            <X />
          </SheetClose>
        </SheetHeader>

        <div className="space-y-1 p-3">
          {secondaryNavigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = isNavigationItemActive(pathname, item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isActive && "bg-accent text-accent-foreground"
                )}
              >
                <Icon className="size-4 text-muted-foreground" />
                <span>{item.label}</span>
              </Link>
            );
          })}

          <div className="mt-2 flex items-center justify-between border-t px-3 pt-3">
            <span className="text-sm text-muted-foreground">المظهر</span>
            <ThemeSwitcher />
          </div>

          {user ? (
            <div className="space-y-3 border-t px-3 pt-3">
              <AccountSummary user={user} />
              <SignOutButton />
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
