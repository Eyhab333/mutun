import type { Metadata } from "next";

import { AuthProvider } from "@/components/auth/auth-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";

import { tajawal } from "./fonts";
import { DirectionProvider } from "@/components/ui/direction";
import "./globals.css";

export const metadata: Metadata = {
  title: "المتون",
  description: "تطبيق لحفظ ومراجعة المتون العلمية",
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
            <AuthProvider>{children}</AuthProvider>
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
