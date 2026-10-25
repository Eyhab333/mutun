import type { Metadata, Viewport } from "next";

import { AuthProvider } from "@/components/auth/auth-provider";
import { ReviewNotificationsProvider } from "@/components/notifications/review-notifications-provider";
import { PwaProvider } from "@/components/pwa/pwa-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";

import { tajawal } from "./fonts";
import { DirectionProvider } from "@/components/ui/direction";
import "./globals.css";

export const metadata: Metadata = {
  title: "المتون",
  description: "تطبيق لحفظ ومراجعة المتون العلمية",
  applicationName: "المتون",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "المتون",
  },
  icons: {
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ar"
      dir="rtl"
      suppressHydrationWarning
      className={tajawal.variable}
    >
      <body className="font-sans antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <DirectionProvider direction="rtl">
            <AuthProvider>
              <PwaProvider>
                <ReviewNotificationsProvider>
                  {children}
                </ReviewNotificationsProvider>
              </PwaProvider>
            </AuthProvider>
          </DirectionProvider>

          <Toaster
            position="top-center"
            toastOptions={{
              classNames: {
                success: "!text-green-600 dark:!text-green-400",
                error: "!text-red-600 dark:!text-red-400",
              },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
