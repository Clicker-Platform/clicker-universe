'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { MediaFieldValue, ASPECT_RATIO_CLASS } from '@/components/admin/blocks/media-field/types';
import { detectVideoProvider } from '@/components/admin/blocks/rich-text/VideoEmbedExtension';

const Lottie = dynamic(() => import('lottie-react'), { ssr: false });

interface MediaViewProps {
    media?: MediaFieldValue;
    className?: string;
    style?: React.CSSProperties;
    priority?: boolean;
}

export function MediaView({ media, className = '', style, priority = false }: MediaViewProps) {
    if (!media || !media.src) return null;

    const aspectClass = ASPECT_RATIO_CLASS[media.aspectRatio || '16:9'] || 'aspect-video';
    const fitClass = media.objectFit === 'contain' ? 'object-contain' : 'object-cover';
    const wrapperClass = `relative w-full ${aspectClass || 'aspect-video'} overflow-hidden ${className}`.trim();

    if (media.type === 'image') {
        return (
            <div className={wrapperClass} style={style}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src={media.src}
                    alt={media.alt || ''}
                    loading={priority ? 'eager' : 'lazy'}
                    fetchPriority={priority ? 'high' : 'auto'}
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
                <div className={wrapperClass} style={style}>
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
            <div className={wrapperClass} style={style}>
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
        return <LottieView media={media} wrapperClass={wrapperClass} style={style} />;
    }

    return null;
}

type LottieState =
    | { kind: 'loading' }
    | { kind: 'ready'; data: unknown }
    | { kind: 'error' };

function LottieView({ media, wrapperClass, style }: { media: MediaFieldValue; wrapperClass: string; style?: React.CSSProperties }) {
    const [state, setState] = useState<LottieState>({ kind: 'loading' });

    useEffect(() => {
        let cancelled = false;
        if (!media.src.startsWith('https://')) {
            setState({ kind: 'error' });
            return;
        }
        const proxyUrl = `/api/proxy/lottie?url=${encodeURIComponent(media.src)}`;
        fetch(proxyUrl)
            .then((r) => {
                if (!r.ok) throw new Error('proxy error');
                return r.json();
            })
            .then((data: unknown) => {
                // Must be a Lottie object — has 'layers' or 'v' field
                if (!data || typeof data !== 'object' || !('v' in data || 'layers' in data)) {
                    throw new Error('not lottie');
                }
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
        return <div className={`${wrapperClass} bg-gray-100 dark:bg-neutral-900 animate-pulse`} style={style} />;
    }

    return (
        <div className={wrapperClass} style={style}>
            <div className="absolute inset-0 overflow-hidden">
                <Lottie
                    animationData={state.data}
                    loop={media.loop !== false}
                    autoplay={media.autoplay !== false}
                    style={{ width: '100%', height: '100%' }}
                />
            </div>
        </div>
    );
}
