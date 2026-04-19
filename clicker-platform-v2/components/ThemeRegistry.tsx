'use client';
// Force rebuild

import { useServerInsertedHTML, usePathname } from 'next/navigation';
import { SiteSettings } from '@/data/mockData';

export default function ThemeRegistry({ initialSettings }: { initialSettings: SiteSettings | null }) {
    const settings = initialSettings;
    const pathname = usePathname();
    const isAdmin = pathname?.startsWith('/admin');

    useServerInsertedHTML(() => {
        if (!settings || isAdmin) return null;

        const fontFamily = settings.fontFamily || 'var(--font-jakarta)';
        const isCustomFont = !fontFamily.startsWith('var(');
        const fontUrl = `https://fonts.googleapis.com/css2?family=${fontFamily.replace(/ /g, '+')}:wght@400;700;800&display=swap`;

        return (
            <>
                {isCustomFont && (
                    <>
                        <link href={fontUrl} rel="stylesheet" media="print" data-font-swap />
                        <script dangerouslySetInnerHTML={{ __html: `(function(){var l=document.querySelector('link[data-font-swap]');if(l)l.media='all';})()` }} />
                        <noscript><link href={fontUrl} rel="stylesheet" /></noscript>
                    </>
                )}
                <style dangerouslySetInnerHTML={{
                    __html: `
                    :root {
                        --color-brand-green: ${settings.themeColor || '#B6FF2E'};
                        --color-brand-dark: ${settings.accentColor || '#0E3B2E'};
                        --font-dynamic: ${fontFamily.startsWith('var(') ? fontFamily : `'${fontFamily}', sans-serif`};
                    }
                    body {
                        background-color: var(--color-brand-green);
                        color: var(--color-brand-dark);
                        font-family: var(--font-dynamic) !important;
                    }
                `
                }} />
            </>
        );
    });

    return null;
}
