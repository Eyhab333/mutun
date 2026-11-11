import {
  BookOpen,
  CalendarDays,
  Layers3,
  RotateCcw,
  ShieldCheck,
  Wrench,
} from "lucide-react";

import type { NavigationItem } from "@/types";
import { isAdminUser } from "@/lib/auth/admin";
import type { User } from "firebase/auth";

export const navigationItems: readonly NavigationItem[] = [
  {
    label: "اليوم",
    href: "/",
    icon: CalendarDays,
    section: "main",
  },
  {
    label: "المستويات العلمية",
    mobileLabel: "المستويات",
    href: "/levels",
    icon: Layers3,
    section: "main",
  },
  {
    label: "المراجعة",
    href: "/review",
    icon: RotateCcw,
    section: "main",
  },
  {
    label: "الترميم",
    href: "/repair",
    icon: Wrench,
    section: "main",
  },
  {
    label: "الإدارة",
    href: "/admin",
    icon: ShieldCheck,
    section: "secondary",
    requiresAdmin: true,
  },
];

export const primaryNavigationItems = navigationItems.filter(
  (item) => item.section === "main"
);

export const secondaryNavigationItems = navigationItems.filter(
  (item) => item.section === "secondary"
);

export const applicationIcon = BookOpen;

export function getVisibleNavigationItems(
  items: readonly NavigationItem[],
  user: Pick<User, "uid"> | null | undefined
) {
  return items.filter((item) => !item.requiresAdmin || isAdminUser(user));
}

export function isNavigationItemActive(
  pathname: string,
  href: NavigationItem["href"]
) {
  return href === "/"
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);
}
