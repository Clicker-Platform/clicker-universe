'use client';

import Script from 'next/script';
import { useEffect } from 'react';

interface PixelTrackerProps {
    pixels?: {
        facebookPixelId?: string;
        googleAnalyticsId?: string;
        tiktokPixelId?: string;
    };
}

export const PixelTracker = ({ pixels }: PixelTrackerProps) => {
    if (!pixels) return null;

    const { facebookPixelId, googleAnalyticsId, tiktokPixelId } = pixels;

    useEffect(() => {
        // Facebook Pixel PageView
        if (facebookPixelId && (window as any).fbq) {
            (window as any).fbq('track', 'PageView');
        }
    }, [facebookPixelId]);

    // TikTok Pixel Initialization Effect
    useEffect(() => {
        if (tiktokPixelId) {
            /* eslint-disable */
            (function (w, d, t) {
                // @ts-ignore
                w.TiktokAnalyticsObject = t; var ttq = w[t] = w[t] || [];
                // @ts-ignore
                ttq.methods = ["page", "track", "identify", "instances", "debug", "on", "off", "once", "ready", "alias", "group", "enableCookie", "disableCookie"];
                // @ts-ignore
                ttq.setAndDefer = function (t, e) { t[e] = function () { t.push([e].concat(Array.prototype.slice.call(arguments, 0))) } };
                // @ts-ignore
                for (var i = 0; i < ttq.methods.length; i++)ttq.setAndDefer(ttq, ttq.methods[i]);
                // @ts-ignore
                ttq.instance = function (t) { for (var e = ttq.methods[i], n = 0; n < ttq.methods.length; n++)ttq.setAndDefer(e, ttq.methods[n]); return e };
                // @ts-ignore
                ttq.load = function (e, n) {
                    var i = "https://analytics.tiktok.com/i18n/pixel/events.js";
                    // @ts-ignore
                    ttq._i = ttq._i || {}, ttq._i[e] = [], ttq._i[e]._u = i, ttq._t = ttq._t || {}, ttq._t[e] = +new Date,
                        // @ts-ignore
                        ttq._o = ttq._o || {}, ttq._o[e] = n || {}; var o = document.createElement("script");
                    o.type = "text/javascript", o.async = !0, o.src = i + "?sdkid=" + e + "&lib=" + t;
                    var a = document.getElementsByTagName("script")[0];
                    a.parentNode?.insertBefore(o, a)
                };

                // @ts-ignore
                ttq.load(tiktokPixelId);
                // @ts-ignore
                ttq.page();
            })(window, document, 'ttq');
            /* eslint-enable */
        }
    }, [tiktokPixelId]);

    return (
        <>
            {/* Facebook Pixel */}
            {facebookPixelId && (
                <Script id="facebook-pixel" strategy="afterInteractive">
                    {`
                        !function(f,b,e,v,n,t,s)
                        {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
                        n.callMethod.apply(n,arguments):n.queue.push(arguments)};
                        if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
                        n.queue=[];t=b.createElement(e);t.async=!0;
                        t.src=v;s=b.getElementsByTagName(e)[0];
                        s.parentNode.insertBefore(t,s)}(window, document,'script',
                        'https://connect.facebook.net/en_US/fbevents.js');
                        fbq('init', '${facebookPixelId}');
                        fbq('track', 'PageView');
                    `}
                </Script>
            )}

            {/* Google Analytics */}
            {googleAnalyticsId && (
                <>
                    <Script
                        src={`https://www.googletagmanager.com/gtag/js?id=${googleAnalyticsId}`}
                        strategy="afterInteractive"
                        onLoad={() => {
                            (window as any).dataLayer = (window as any).dataLayer || [];
                            function gtag(...args: any[]) { (window as any).dataLayer.push(arguments); }
                            (window as any).gtag = gtag; // Make globally available
                            gtag('js', new Date());
                            gtag('config', googleAnalyticsId);
                        }}
                    />
                </>
            )}

            {/* TikTok Pixel handled in Effect to avoid hydration mismatch with new Date() */}
        </>
    );
};
