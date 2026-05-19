'use client';
// Force rebuild

import { useRef } from 'react';
import { useServerInsertedHTML, usePathname } from 'next/navigation';
import { SiteSettings } from '@/data/mockData';
import { getPackById, getDefaultPack } from '@/lib/fonts/packs';
import { getTemplate } from '@/lib/templates/registry';

type Props = {
  initialSettings: SiteSettings | null;
  appearanceStyles?: { fontPackId: string | null } | null;
  templateId?: string | null;
};

export default function ThemeRegistry({ initialSettings, appearanceStyles, templateId }: Props) {
    const settings = initialSettings;
    const pathname = usePathname();
    const isAdmin = pathname?.startsWith('/admin');

    // useServerInsertedHTML fires once per streaming chunk in Next.js SSR.
    // The `data-theme-registry` id ensures the browser deduplicates if injected multiple times,
    // but we also guard with a ref so we only return content on the first call.
    const inserted = useRef(false);
    useServerInsertedHTML(() => {
        if (!settings) return null;
        if (inserted.current) return null;
        inserted.current = true;

        const sitePack = getPackById(appearanceStyles?.fontPackId);
        let pack;
        if (sitePack) {
          pack = sitePack;
        } else if (templateId) {
          const template = getTemplate(templateId);
          pack = getPackById(template.config.defaultFontPackId) ?? getDefaultPack();
        } else {
          pack = getDefaultPack();
        }
        const headingVar = 'var(' + pack.heading.cssVar + ')';
        const bodyVar = 'var(' + pack.body.cssVar + ')';

        // In admin we only emit the font vars so the canvas (inside the admin
        // shell) inherits the tenant's Font Pack. Brand colors and the legacy
        // --font-dynamic / body background path stay off admin to avoid bleeding
        // tenant brand styling into the admin chrome.
        if (isAdmin) {
            return (
                <style
                    data-theme-registry
                    dangerouslySetInnerHTML={{
                        __html: ':root { --font-heading: ' + headingVar + '; --font-body: ' + bodyVar + '; }',
                    }}
                />
            );
        }

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
                <style data-theme-registry dangerouslySetInnerHTML={{
                    __html: `
                    :root {
                        --color-brand-green: ${settings.themeColor || '#B6FF2E'};
                        --color-brand-dark: ${settings.accentColor || '#0E3B2E'};
                        --font-dynamic: ${fontFamily.startsWith('var(') ? fontFamily : `'${fontFamily}', sans-serif`};
                        --font-heading: ${headingVar};
                        --font-body: ${bodyVar};
                    }
                    body {
                        background-color: var(--color-brand-green);
                        color: var(--color-brand-dark);
                        font-family: var(--font-body) !important;
                    }
                `
                }} />
            </>
        );
    });

    return null;
}
