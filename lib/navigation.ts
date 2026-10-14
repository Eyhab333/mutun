import {
  BookOpen,
  CalendarDays,
  Layers3,
  RotateCcw,
  Settings,
  ShieldCheck,
  Wrench,
} from "lucide-react";

import type { NavigationItem } from "@/types";

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
  },
  {
    label: "الإعدادات",
    href: "/settings",
    icon: Settings,
    section: "secondary",
  },
];

export const primaryNavigationItems = navigationItems.filter(
  (item) => item.section === "main"
);

export const secondaryNavigationItems = navigationItems.filter(
  (item) => item.section === "secondary"
);

export const applicationIcon = BookOpen;

export function isNavigationItemActive(
  pathname: string,
  href: NavigationItem["href"]
) {
  return href === "/"
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);
}
