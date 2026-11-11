"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Check, ChevronsUpDown, LoaderCircle, LogOut, Monitor, Moon, Settings, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import type { User } from "firebase/auth";

import { AccountSummary } from "@/components/auth/account-summary";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  applicationIcon,
  getVisibleNavigationItems,
  isNavigationItemActive,
  primaryNavigationItems,
  secondaryNavigationItems,
} from "@/lib/navigation";
import type { NavigationItem } from "@/types";
import { useAuth } from "@/hooks/use-auth";

const ApplicationIcon = applicationIcon;

export function AppSidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const visiblePrimaryNavigationItems = getVisibleNavigationItems(
    primaryNavigationItems,
    user
  );
  const visibleSecondaryNavigationItems = getVisibleNavigationItems(
    secondaryNavigationItems,
    user
  );

  return (
    <Sidebar side="right" collapsible="icon" dir="rtl">
      <SidebarHeader>
        <div className="flex h-10 items-center gap-1 px-2 group-data-[collapsible=icon]:h-auto group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:px-0">
          <Link
            href="/"
            className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-md px-2 outline-none transition-colors hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:flex-none group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0"
          >
            <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
              <ApplicationIcon className="size-4" />
            </span>

            <span className="truncate font-semibold group-data-[collapsible=icon]:hidden">
              المتون
            </span>
          </Link>

          <NotificationBell className="hidden shrink-0 md:block" />
        </div>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent>
        <NavigationGroup
          label="الرئيسية"
          items={visiblePrimaryNavigationItems}
          pathname={pathname}
        />

        {visibleSecondaryNavigationItems.length > 0 ? (
          <NavigationGroup
            items={visibleSecondaryNavigationItems}
            pathname={pathname}
          />
        ) : null}
      </SidebarContent>

      <SidebarFooter>
        {user ? (
          <>
            <SidebarSeparator className="mx-0" />

            <SidebarUserMenu user={user} />
          </>
        ) : null}

        <SidebarTrigger
          aria-label="طي الشريط الجانبي أو توسيعه"
          title="طي الشريط الجانبي أو توسيعه"
          className="self-end group-data-[collapsible=icon]:self-center"
        />
      </SidebarFooter>
    </Sidebar>
  );
}

type NavigationGroupProps = {
  label?: string;
  items: readonly NavigationItem[];
  pathname: string;
};

function NavigationGroup({ label, items, pathname }: NavigationGroupProps) {
  return (
    <SidebarGroup>
      {label ? <SidebarGroupLabel>{label}</SidebarGroupLabel> : null}

      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const isActive = isNavigationItemActive(pathname, item.href);
            const Icon = item.icon;

            return (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  render={<Link href={item.href} />}
                  isActive={isActive}
                  tooltip={{ children: item.label, side: "left" }}
                  aria-current={isActive ? "page" : undefined}
                >
                  <Icon />
                  <span>{item.label}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

const themes = [
  { value: "light", label: "فاتح", icon: Sun },
  { value: "dark", label: "داكن", icon: Moon },
  { value: "system", label: "النظام", icon: Monitor },
] as const;

type SidebarUserMenuProps = {
  user: User;
};

function SidebarUserMenu({ user }: SidebarUserMenuProps) {
  const router = useRouter();
  const { signOutUser } = useAuth();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  const [isSigningOut, setIsSigningOut] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  async function handleSignOut() {
    if (isSigningOut) {
      return;
    }

    setIsSigningOut(true);

    try {
      await signOutUser();
      router.replace("/login");
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("Google sign-out failed.", error);
      }

      toast.error("تعذر تسجيل الخروج. يُرجى المحاولة مرة أخرى.");
      setIsSigningOut(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            className="h-auto w-full justify-start gap-2 px-2 py-2 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-0!"
            aria-label="فتح قائمة الحساب"
          />
        }
      >
        <AccountSummary
          user={user}
          className="min-w-0 flex-1"
          detailsClassName="group-data-[collapsible=icon]:hidden"
        />
        <ChevronsUpDown className="ms-auto size-4 shrink-0 text-sidebar-foreground/70 group-data-[collapsible=icon]:hidden" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" side="top" className="w-56">
        <DropdownMenuItem render={<Link href="/settings" />}>
          <Settings />
          <span>الإعدادات</span>
        </DropdownMenuItem>

        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Monitor />
            <span>المظهر</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {themes.map(({ value, label, icon: Icon }) => (
              <DropdownMenuItem key={value} onClick={() => setTheme(value)}>
                <Icon />
                <span className="flex-1">{label}</span>
                {mounted && theme === value ? <Check /> : null}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          variant="destructive"
          disabled={isSigningOut}
          onClick={() => void handleSignOut()}
        >
          {isSigningOut ? <LoaderCircle className="animate-spin" /> : <LogOut />}
          <span>تسجيل الخروج</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
