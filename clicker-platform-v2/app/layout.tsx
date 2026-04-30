import type { Metadata } from "next";
import { Figtree, Space_Mono } from "next/font/google";
import { Toaster } from 'sonner';
import "./globals.css";

const figtree = Figtree({
  subsets: ["latin"],
  variable: "--font-jakarta",
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
});

const spaceMono = Space_Mono({
  subsets: ["latin"],
  variable: "--font-space",
  weight: ['400', '700'],
  display: 'swap',
});

import { fetchSiteSettings } from "@/lib/fetchData";
import ThemeRegistry from "@/components/ThemeRegistry";
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
  // FIXED: No more 'default' fallback. Use 'pending' to indicate no tenant context.
  // This forces explicit handling of "no site" states.
  const siteId = headersList.get('x-site-id') || 'pending';
  const tenantSlug = headersList.get('x-tenant-slug') || undefined;

  // 3. DETECT SUBDOMAIN (from Middleware with Fallback)
  let isSubdomain = headersList.get('x-clicker-is-subdomain') === 'true';
    if (!isSubdomain) {
      const host = headersList.get('x-clicker-original-host') || headersList.get('x-forwarded-host') || headersList.get('host') || '';
      const baseDomain = process.env.NEXT_PUBLIC_BASE_DOMAIN || 'clicker.id';
      const isFirebaseDefaultDomain = baseDomain.includes('.web.app');
      // On Firebase default domains, subdomains are not supported — always path-based
      if (!isFirebaseDefaultDomain && host.endsWith(`.${baseDomain}`) && host !== baseDomain && host !== `www.${baseDomain}`) {
        isSubdomain = true;
      }
    }

  // 4. THEME REGISTRY requests
  // 2. Fetch Settings (Only if we have a valid siteId)
  const settings = (siteId && siteId !== 'pending' && siteId !== 'default')
    ? await fetchSiteSettings(siteId)
    : null;

  return (
    <html lang="id" className="notranslate" translate="no" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="preconnect" href={`https://${process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'clicker-universe.firebaseapp.com'}`} />
        <link rel="preconnect" href="https://www.googleapis.com" />
        <link rel="preconnect" href="https://firebasestorage.googleapis.com" />
      </head>
      <body
        suppressHydrationWarning
        className={`${figtree.variable} ${spaceMono.variable} antialiased font-sans`}
      >
        <SiteProvider siteId={siteId} tenantSlug={tenantSlug} isSubdomain={isSubdomain}>
          <ThemeRegistry initialSettings={settings} />
<div className="flex-grow w-full">
            {children}
          </div>
          <Toaster position="top-right" richColors />
        </SiteProvider>
      </body>
    </html>
  );
}
