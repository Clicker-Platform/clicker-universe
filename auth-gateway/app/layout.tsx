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

export const metadata: Metadata = {
  title: "Auth Gateway",
  description: "Secure Authentication Service",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className="notranslate" translate="no" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${jakarta.variable} antialiased font-sans selection:bg-brand-dark selection:text-brand-green`}
      >
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
