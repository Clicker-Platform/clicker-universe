import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { Toaster } from 'sonner';
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
});

import { fetchSiteSettings } from "@/lib/fetchData";
import ThemeRegistry from "@/components/ThemeRegistry";
import { AnalyticsTracker } from "@/components/AnalyticsTracker";
import { headers } from "next/headers";
import { SiteProvider } from "@/lib/site-context";

export const revalidate = 3600; // Enable ISR for layout

export async function generateMetadata(): Promise<Metadata> {
  const headersList = await headers();
  const siteId = headersList.get('x-site-id') || 'default';
  const settings = await fetchSiteSettings(siteId);

  return {
    title: settings?.title || "Clicker Platform",
    description: settings?.description || "Powered by Clicker",
    openGraph: {
      images: settings?.ogImageUrl ? [{ url: settings.ogImageUrl }] : [],
    },
    icons: {
      icon: settings?.faviconUrl || '/favicon.ico',
    }
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // 1. EXTRACT TENANT ID
  const headersList = await headers();
  const siteId = headersList.get('x-site-id') || 'default';
  const tenantSlug = headersList.get('x-tenant-slug') || undefined;

  // 2. Fetch Settings
  const settings = await fetchSiteSettings(siteId);

  return (
    <html lang="id" className="notranslate" translate="no" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${jakarta.variable} antialiased font-sans selection:bg-brand-dark selection:text-brand-green`}
      >
        <SiteProvider siteId={siteId} tenantSlug={tenantSlug}>
          <ThemeRegistry initialSettings={settings} />
          <AnalyticsTracker />
          <div className="flex-grow w-full">
            {children}
          </div>
          <Toaster position="top-right" richColors />
        </SiteProvider>
      </body>
    </html>
  );
}
