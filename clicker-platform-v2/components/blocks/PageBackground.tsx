'use client';

import { BackgroundMedia, BackgroundMediaBase } from '@/data/mockData';
import { useDeviceView } from '@/components/DeviceViewContext';

function buildVideoEmbedUrl(url: string): string {
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
        const videoId = url.split('v=')[1]?.split('&')[0] || url.split('youtu.be/')[1]?.split('?')[0];
        return `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&controls=0&loop=1&playlist=${videoId}&playsinline=1&rel=0&showinfo=0`;
    }
    if (url.includes('vimeo.com')) {
        const videoId = url.split('vimeo.com/')[1]?.split('?')[0];
        return `https://player.vimeo.com/video/${videoId}?autoplay=1&loop=1&muted=1&background=1`;
    }
    return url;
}

function BackgroundLayer({
    cfg,
    visibilityClass,
    positionClass,
}: {
    cfg: BackgroundMediaBase;
    visibilityClass: string; // e.g. 'md:block' or 'md:hidden'
    positionClass: string;
}) {
    const { mode, color, url, displaySize = 'cover', backgroundPosition = 'center', overlayColor, overlayOpacity = 0 } = cfg;
    const isVideo = mode === 'video' && !!url;
    const isEmbed = isVideo && (url.includes('youtube.com') || url.includes('youtu.be') || url.includes('vimeo.com'));

    if (mode === 'color' && color) {
        return (
            <div className={`${positionClass} inset-0 overflow-hidden pointer-events-none ${visibilityClass}`} style={{ zIndex: -15 }}>
                <div className="absolute inset-0" style={{ backgroundColor: color }} />
            </div>
        );
    }

    if (mode === 'image' && url) {
        return (
            <div className={`${positionClass} inset-0 overflow-hidden pointer-events-none ${visibilityClass}`} style={{ zIndex: -15 }}>
                <div
                    className="absolute inset-0"
                    style={{
                        backgroundImage: `url("${url}")`,
                        backgroundSize: displaySize === 'pattern' ? 'auto' : displaySize,
                        backgroundRepeat: displaySize === 'pattern' ? 'repeat' : 'no-repeat',
                        backgroundPosition,
                    }}
                />
                {(overlayColor || overlayOpacity > 0) && (
                    <div className="absolute inset-0" style={{ backgroundColor: overlayColor || '#000000', opacity: overlayOpacity }} />
                )}
            </div>
        );
    }

    if (isVideo && url) {
        return (
            <div className={`${positionClass} inset-0 overflow-hidden pointer-events-none bg-black ${visibilityClass}`} style={{ zIndex: -15 }}>
                {isEmbed ? (
                    <iframe
                        src={buildVideoEmbedUrl(url)}
                        className="absolute top-1/2 left-1/2 w-[100vw] h-[56.25vw] min-h-[100vh] min-w-[177.77vh] -translate-x-1/2 -translate-y-1/2"
                        style={{ border: 'none' }}
                        allow="autoplay; fullscreen; picture-in-picture"
                        allowFullScreen
                        title="Background Video"
                    />
                ) : (
                    <video
                        src={url}
                        autoPlay loop muted playsInline
                        className={`absolute inset-0 w-full h-full ${displaySize === 'contain' ? 'object-contain' : 'object-cover'}`}
                    />
                )}
                {(overlayColor || overlayOpacity > 0) && (
                    <div className="absolute inset-0" style={{ backgroundColor: overlayColor || '#000000', opacity: overlayOpacity }} />
                )}
            </div>
        );
    }

    return null;
}

export function PageBackground({ config, previewMode = false }: { config?: BackgroundMedia, previewMode?: boolean }) {
    const deviceView = useDeviceView();
    if (!config || config.mode === 'inherit') return null;

    const positionClass = (config.scrollEffect === 'fixed' && !previewMode) ? 'fixed' : 'absolute';
    const hasMobileOverride = config.mobile && config.mobile.mode !== 'inherit';

    if (!hasMobileOverride) {
        return <BackgroundLayer cfg={config} visibilityClass="" positionClass={positionClass} />;
    }

    // In canvas preview, deviceView context drives which layer is visible — CSS breakpoints
    // don't fire because the canvas is a constrained div inside a full-width browser window.
    if (previewMode) {
        const isMobilePreview = deviceView === 'mobile' || deviceView === 'tablet';
        return isMobilePreview
            ? <BackgroundLayer cfg={config.mobile!} visibilityClass="" positionClass="absolute" />
            : <BackgroundLayer cfg={config} visibilityClass="" positionClass={positionClass} />;
    }

    // In real browser, CSS breakpoints handle the switch
    return (
        <>
            <BackgroundLayer cfg={config} visibilityClass="hidden md:block" positionClass={positionClass} />
            <BackgroundLayer cfg={config.mobile!} visibilityClass="block md:hidden" positionClass="absolute" />
        </>
    );
}
