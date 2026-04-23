'use client';

import { BackgroundMedia } from '@/data/mockData';

export function PageBackground({ config, previewMode = false }: { config?: BackgroundMedia, previewMode?: boolean }) {
    if (!config || config.mode === 'inherit') return null;

    const { mode, color, url, displaySize = 'cover', backgroundPosition = 'center', scrollEffect = 'scroll', overlayColor, overlayOpacity = 0 } = config;

    // Check if video
    const isVideo = mode === 'video' && !!url;
    const isYoutube = isVideo && (url.includes('youtube.com') || url.includes('youtu.be'));
    const isVimeo = isVideo && url.includes('vimeo.com');

    const getVideoEmbedUrl = () => {
        if (!url) return '';
        if (isYoutube) {
            const videoId = url.split('v=')[1]?.split('&')[0] || url.split('youtu.be/')[1]?.split('?')[0];
            return `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&controls=0&loop=1&playlist=${videoId}&playsinline=1&rel=0&showinfo=0`;
        }
        if (isVimeo) {
            const videoId = url.split('vimeo.com/')[1]?.split('?')[0];
            return `https://player.vimeo.com/video/${videoId}?autoplay=1&loop=1&muted=1&background=1`;
        }
        return url;
    };

    const positionClass = (scrollEffect === 'fixed' && !previewMode) ? 'fixed' : 'absolute';

    return (
        <div className={`${positionClass} inset-0 overflow-hidden pointer-events-none`} style={{ zIndex: -15 }}>
            {mode === 'color' && color && (
                <div className="absolute inset-0" style={{ backgroundColor: color }} />
            )}
            
            {mode === 'image' && url && (
                <div 
                    className="absolute inset-0" 
                    style={{ 
                        backgroundImage: `url("${url}")`,
                        backgroundSize: displaySize === 'pattern' ? 'auto' : displaySize,
                        backgroundRepeat: displaySize === 'pattern' ? 'repeat' : 'no-repeat',
                        backgroundPosition,
                    }} 
                />
            )}

            {isVideo && url && (
                <div className="absolute inset-0 overflow-hidden bg-black">
                    {isYoutube || isVimeo ? (
                        <iframe
                            src={getVideoEmbedUrl()}
                            className="absolute top-1/2 left-1/2 w-[100vw] h-[56.25vw] min-h-[100vh] min-w-[177.77vh] -translate-x-1/2 -translate-y-1/2 opacity-100"
                            style={{ border: 'none' }}
                            allow="autoplay; fullscreen; picture-in-picture"
                            allowFullScreen
                            title="Background Video"
                        />
                    ) : (
                        <video
                            src={url}
                            autoPlay
                            loop
                            muted
                            playsInline
                            className={`absolute inset-0 w-full h-full ${displaySize === 'contain' ? 'object-contain' : 'object-cover'}`}
                        />
                    )}
                </div>
            )}

            {/* Overlay */}
            {(overlayColor || (overlayOpacity > 0)) && (mode === 'image' || mode === 'video') && (
                <div 
                    className="absolute inset-0" 
                    style={{ 
                        backgroundColor: overlayColor || '#000000',
                        opacity: overlayOpacity 
                    }} 
                />
            )}
        </div>
    );
}
