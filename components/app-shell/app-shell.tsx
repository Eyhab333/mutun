import { Suspense, type ReactNode } from "react";

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";

import { AppSidebar } from "./app-sidebar";
import { MobileNavigation } from "./mobile-navigation";

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  return (
    <TooltipProvider>
      <SidebarProvider>
        <Suspense
          fallback={
            <div
              aria-hidden="true"
              className="hidden w-(--sidebar-width) md:block"
            />
          }
        >
          <AppSidebar />
        </Suspense>

        <SidebarInset>
          <div className="min-h-svh pb-24 md:pb-0">{children}</div>
        </SidebarInset>

        <Suspense fallback={null}>
          <MobileNavigation />
        </Suspense>
      </SidebarProvider>
    </TooltipProvider>
  );
}
