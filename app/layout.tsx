import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ServiceWorkerRegistration } from "@/components/pwa/service-worker-registration";
import { ThemeSync } from "@/components/theme/theme-controller";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import "./globals.css";

const siteUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "LifeOS", template: "%s · LifeOS" },
  description: "Personal command center for your calendar, activities and finances.",
  applicationName: "LifeOS",
  // "default" keeps the status bar text readable in both the light and the dark theme.
  appleWebApp: { capable: true, title: "LifeOS", statusBarStyle: "default" },
  formatDetection: { telephone: false, email: false, address: false },
  // Private, per-user application: keep it out of search engines.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  // The theme-color tint is set by the theme script, which knows the chosen theme.
  colorScheme: "light dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

const geistSans = Geist({ variable: "--font-geist-sans", display: "swap", subsets: ["latin", "latin-ext"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", display: "swap", subsets: ["latin"] });

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // The pre-paint script sets data-theme on <html> before React hydrates.
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans text-sm antialiased`}>
        <ThemeSync />
        {children}
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
