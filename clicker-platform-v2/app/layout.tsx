import type { Metadata } from "next";
import {
  Figtree,
  Space_Mono,
  Inter,
  Inter_Tight,
  Outfit,
  DM_Sans,
  Playfair_Display,
  Lora,
  Fraunces,
  Archivo,
  Archivo_Black,
  Space_Grotesk,
  DM_Serif_Display,
  Quicksand,
  Montserrat,
} from "next/font/google";
import { Toaster } from 'sonner';
import "./globals.css";

const figtree = Figtree({ subsets: ["latin"], variable: "--font-jakarta", weight: ['400','500','600','700','800'], display: 'swap' });
const spaceMono = Space_Mono({ subsets: ["latin"], variable: "--font-space", weight: ['400','700'], display: 'swap' });

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", weight: ['400','500','600','700'], display: 'swap' });
const interTight = Inter_Tight({ subsets: ["latin"], variable: "--font-inter-tight", weight: ['400','500','600','700'], display: 'swap' });
const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit", weight: ['400','500','600','700'], display: 'swap' });
const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans", weight: ['400','500','600','700'], display: 'swap' });
const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-playfair", weight: ['400','600','700'], display: 'swap' });
const lora = Lora({ subsets: ["latin"], variable: "--font-lora", weight: ['400','500','600'], display: 'swap' });
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", weight: ['400','600','700'], display: 'swap' });
const archivo = Archivo({ subsets: ["latin"], variable: "--font-archivo", weight: ['400','500','600','700'], display: 'swap' });
const archivoBlack = Archivo_Black({ subsets: ["latin"], variable: "--font-archivo-black", weight: ['400'], display: 'swap' });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-space-grotesk", weight: ['400','500','600','700'], display: 'swap' });
const dmSerifDisplay = DM_Serif_Display({ subsets: ["latin"], variable: "--font-dm-serif-display", weight: ['400'], display: 'swap' });
const quicksand = Quicksand({ subsets: ["latin"], variable: "--font-quicksand", weight: ['400','500','600','700'], display: 'swap' });
const montserrat = Montserrat({ subsets: ["latin"], variable: "--font-montserrat", weight: ['400','500','600','700'], display: 'swap' });

const FONT_CLASS_NAMES = [
  figtree.variable, spaceMono.variable,
  inter.variable, interTight.variable, outfit.variable, dmSans.variable,
  playfair.variable, lora.variable, fraunces.variable,
  archivo.variable, archivoBlack.variable, spaceGrotesk.variable,
  dmSerifDisplay.variable, quicksand.variable, montserrat.variable,
].join(' ');

import { fetchSiteSettings, fetchAppearanceStyles } from "@/lib/fetchData";
import ThemeRegistry from "@/components/ThemeRegistry";
import { headers } from "next/headers";
import { SiteProvider } from "@/lib/site-context";
import { PostHogProvider } from "@/lib/analytics/PostHogProvider";

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
  // 2. Fetch Settings + appearance in parallel (only if we have a valid siteId)
  const hasValidSite = siteId && siteId !== 'pending' && siteId !== 'default';
  const [settings, appearanceStyles] = hasValidSite
    ? await Promise.all([
        fetchSiteSettings(siteId),
        fetchAppearanceStyles(siteId),
      ])
    : [null, { fontPackId: null }];

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
        className={`${FONT_CLASS_NAMES} antialiased font-sans`}
      >
        <PostHogProvider>
          <SiteProvider siteId={siteId} tenantSlug={tenantSlug} isSubdomain={isSubdomain}>
            <ThemeRegistry
              initialSettings={settings}
              appearanceStyles={appearanceStyles}
              templateId={settings?.templateId ?? null}
            />
            <div className="flex-grow w-full">
              {children}
            </div>
            <Toaster position="top-right" richColors />
          </SiteProvider>
        </PostHogProvider>
      </body>
    </html>
  );
}
