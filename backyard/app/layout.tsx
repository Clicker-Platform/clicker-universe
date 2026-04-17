import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";


const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: '--font-jakarta' });

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
    title: "Backyard - God Mode",
    description: "Clicker Universe Admin Dashboard",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="id" className="notranslate" translate="no" suppressHydrationWarning>
            <body className={`${jakarta.variable} ${jakarta.className} antialiased`} suppressHydrationWarning>
                {children}
                <Toaster richColors position="top-right" theme="light" />
            </body>
        </html>
    );
}
