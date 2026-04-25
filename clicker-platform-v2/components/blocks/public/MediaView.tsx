'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { MediaFieldValue, ASPECT_RATIO_CLASS } from '@/components/admin/blocks/media-field/types';
import { detectVideoProvider } from '@/components/admin/blocks/rich-text/VideoEmbedExtension';

const Lottie = dynamic(() => import('lottie-react'), { ssr: false });

interface MediaViewProps {
    media?: MediaFieldValue;
    className?: string;
}

export function MediaView({ media, className = '' }: MediaViewProps) {
    if (!media || !media.src) return null;

    const aspectClass = ASPECT_RATIO_CLASS[media.aspectRatio || '16:9'] || '';
    const fitClass = media.objectFit === 'contain' ? 'object-contain' : 'object-cover';
    const wrapperClass = `relative w-full ${aspectClass} overflow-hidden ${className}`.trim();

    if (media.type === 'image') {
        return (
            <div className={wrapperClass}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src={media.src}
                    alt={media.alt || ''}
                    loading="lazy"
                    className={`w-full h-full ${fitClass}`}
                />
            </div>
        );
    }

    if (media.type === 'video') {
        const detected = detectVideoProvider(media.src);
        if (!detected) return null;

        if (detected.provider === 'mp4') {
            return (
                <div className={wrapperClass}>
                    <video
                        src={detected.embedSrc}
                        poster={media.poster || undefined}
                        autoPlay={!!media.autoplay}
                        muted={!!media.muted}
                        loop={!!media.loop}
                        playsInline
                        controls={!media.autoplay}
                        className={`w-full h-full ${fitClass}`}
                    />
                </div>
            );
        }

        // YouTube/Vimeo — build query params for autoplay/mute/loop
        const params = new URLSearchParams();
        if (media.autoplay) params.set('autoplay', '1');
        if (media.muted) params.set('muted', '1');
        if (media.muted) params.set('mute', '1'); // YouTube uses 'mute', Vimeo 'muted'
        if (media.loop) params.set('loop', '1');
        params.set('playsinline', '1');
        const embedUrl = `${detected.embedSrc}?${params.toString()}`;

        return (
            <div className={wrapperClass}>
                <iframe
                    src={embedUrl}
                    className="absolute inset-0 w-full h-full border-0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                />
            </div>
        );
    }

    if (media.type === 'lottie') {
        return <LottieView media={media} wrapperClass={wrapperClass} />;
    }

    return null;
}

type LottieState =
    | { kind: 'loading' }
    | { kind: 'ready'; data: unknown }
    | { kind: 'error' };

function LottieView({ media, wrapperClass }: { media: MediaFieldValue; wrapperClass: string }) {
    const [state, setState] = useState<LottieState>({ kind: 'loading' });

    useEffect(() => {
        let cancelled = false;
        fetch(media.src)
            .then((r) => r.json())
            .then((data: unknown) => {
                if (!cancelled) setState({ kind: 'ready', data });
            })
            .catch(() => {
                if (!cancelled) setState({ kind: 'error' });
            });
        return () => {
            cancelled = true;
        };
    }, [media.src]);

    if (!media.src || state.kind === 'error') return null;
    if (state.kind === 'loading') {
        return <div className={`${wrapperClass} bg-gray-100 dark:bg-neutral-900 animate-pulse`} />;
    }

    return (
        <div className={wrapperClass}>
            <Lottie
                animationData={state.data}
                loop={media.loop !== false}
                autoplay={media.autoplay !== false}
                className="w-full h-full"
            />
        </div>
    );
}
