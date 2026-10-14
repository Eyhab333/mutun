"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { AccountSummary } from "@/components/auth/account-summary";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { ThemeSwitcher } from "@/components/theme-switcher";
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

  return (
    <Sidebar side="right" collapsible="icon" dir="rtl">
      <SidebarHeader>
        <Link
          href="/"
          className="flex h-10 items-center gap-2 rounded-md px-2 outline-none transition-colors hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring"
        >
          <span className="flex size-7 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
            <ApplicationIcon className="size-4" />
          </span>

          <span className="truncate font-semibold group-data-[collapsible=icon]:hidden">
            المتون
          </span>
        </Link>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent>
        <NavigationGroup
          label="الرئيسية"
          items={primaryNavigationItems}
          pathname={pathname}
        />

        <NavigationGroup
          label="الحساب"
          items={secondaryNavigationItems}
          pathname={pathname}
        />
      </SidebarContent>

      <SidebarFooter>
        {user ? (
          <>
            <div className="space-y-2 px-2">
              <AccountSummary
                user={user}
                detailsClassName="group-data-[collapsible=icon]:hidden"
              />

              <SignOutButton
                className="group-data-[collapsible=icon]:justify-center"
                labelClassName="group-data-[collapsible=icon]:hidden"
              />
            </div>

            <SidebarSeparator className="mx-0" />
          </>
        ) : null}

        <div className="flex items-center justify-between gap-2 px-2 group-data-[collapsible=icon]:justify-center">
          <span className="text-sm text-sidebar-foreground/70 group-data-[collapsible=icon]:hidden">
            المظهر
          </span>

          <ThemeSwitcher />
        </div>

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
  label: string;
  items: readonly NavigationItem[];
  pathname: string;
};

function NavigationGroup({ label, items, pathname }: NavigationGroupProps) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>

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
