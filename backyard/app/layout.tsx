import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";


const inter = Inter({ subsets: ["latin"] });

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
            <body className={`${inter.className} antialiased`} suppressHydrationWarning>
                {children}
                <Toaster richColors position="top-right" theme="light" />
            </body>
        </html>
    );
}
