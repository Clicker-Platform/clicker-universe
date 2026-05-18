'use client';

import Image from 'next/image';
import { useTemplate } from '@/components/TemplateProvider';
import { getCardClasses, getMutedColor } from './cardStyles';
import { BODY_SM } from './typography';
import { useDeviceView, dv } from '@/components/DeviceViewContext';
import { MediaView } from './MediaView';
import { MediaFieldValue, DEFAULT_MEDIA } from '@/components/admin/blocks/media-field/types';

export const DefaultImageBlock = ({ data, isFirst = false }: { data: any; isFirst?: boolean }) => {
    const { theme } = useTemplate();
    const d = useDeviceView();
    const cardStyle = theme.cardStyle;
    const isGlass = cardStyle === 'glass';
    const radius = theme.borderRadius || 'var(--theme-radius)';
    const captionColor = getMutedColor(cardStyle, theme);

    // Resolve media: prefer new `media` field, fall back to legacy `url`
    const media: MediaFieldValue | null = data.media
        ? data.media
        : data.url
            ? { ...DEFAULT_MEDIA, type: 'image', src: data.url }
            : null;

    if (!media || !media.src) return null;

    // If type is image but src looks like a video/lottie URL, don't attempt to render with next/image
    const isVideoSrc = /youtu\.?be|vimeo\.com|\.(mp4|webm|ogg|json)(\?.*)?$/i.test(media.src);
    if (media.type === 'image' && isVideoSrc) return null;

    // Lottie and video: render via MediaView across all variants
    if (media.type === 'lottie' || media.type === 'video') {
        return (
            <section className={`w-full ${dv(d, 'px-4', 'md:px-8')} py-6 max-w-5xl mx-auto`}>
                <MediaView
                    media={media}
                    className={`shadow-md ${getCardClasses(cardStyle)}`}
                    style={{ borderRadius: radius }}
                    priority={isFirst}
                />
                {data.caption && (
                    <p
                        className={`${BODY_SM(d)} text-center mt-4 italic`}
                        style={{ color: captionColor }}
                    >
                        {data.caption}
                    </p>
                )}
            </section>
        );
    }

    const variant = data.layoutVariant || 'standard';

    if (variant === 'full-width') {
        return (
            <section className="w-full">
                <div className="w-full relative">
                    <Image
                        src={media.src}
                        alt={data.caption || "Image"}
                        width={1920}
                        height={1080}
                        sizes="100vw"
                        priority={isFirst}
                        fetchPriority={isFirst ? 'high' : 'auto'}
                        // No object-cover: image renders at its natural aspect ratio,
                        // filling the container width. Previously object-cover + the
                        // hardcoded 1920×1080 dimensions cropped portrait images to
                        // a forced 16:9 frame. Full variant means "edge-to-edge,
                        // no chrome" — that includes not cropping.
                        className="w-full h-auto"
                        style={{ width: '100%', height: 'auto' }}
                    />
                </div>
                {data.caption && (
                    <p
                        className={`${BODY_SM(d)} text-center mt-3 px-4 italic`}
                        style={{ color: captionColor }}
                    >
                        {data.caption}
                    </p>
                )}
            </section>
        );
    }

    if (variant === 'rounded-card') {
        return (
            <section className={`w-full ${dv(d, 'p-4', 'md:p-8')} flex justify-center`}>
                <div className={`overflow-hidden max-w-4xl w-full ${getCardClasses(cardStyle)}`} style={{ borderRadius: radius }}>
                    <Image
                        src={media.src}
                        alt={data.caption || "Image"}
                        width={1200}
                        height={800}
                        sizes="(max-width: 1024px) 100vw, 800px"
                        priority={isFirst}
                        fetchPriority={isFirst ? 'high' : 'auto'}
                        className="w-full h-auto object-cover max-h-[60vh]"
                        style={{ width: '100%', height: 'auto' }}
                    />
                    {data.caption && (
                        <div
                            className="p-4 backdrop-blur border-t"
                            style={{
                                backgroundColor: isGlass ? 'rgba(255,255,255,0.05)' : `${theme.colors.surface || theme.colors.background}80`,
                                borderColor: isGlass ? 'rgba(255,255,255,0.10)' : (theme.colors.border || `${theme.colors.foreground}1a`),
                            }}
                        >
                            <p
                                className={`${BODY_SM(d)} text-center`}
                                style={{ color: captionColor }}
                            >
                                {data.caption}
                            </p>
                        </div>
                    )}
                </div>
            </section>
        );
    }

    // Default: 'standard' — naked image, padded section, optional caption.
    // No card chrome (border / shadow / bg); use the 'card' variant for framing.
    return (
        <section className={`w-full ${dv(d, 'px-4', 'md:px-8')} py-6 max-w-5xl mx-auto`}>
            <div className="overflow-hidden" style={{ borderRadius: radius }}>
                <Image
                    src={media.src}
                    alt={data.caption || "Image"}
                    width={1000}
                    height={600}
                    sizes="(max-width: 1024px) 100vw, 1000px"
                    priority={isFirst}
                    fetchPriority={isFirst ? 'high' : 'auto'}
                    className="w-full h-auto object-cover max-h-[70vh]"
                    style={{ width: '100%', height: 'auto' }}
                />
            </div>
            {data.caption && (
                <p
                    className={`${BODY_SM(d)} text-center mt-4 italic`}
                    style={{ color: captionColor }}
                >
                    {data.caption}
                </p>
            )}
        </section>
    );
};
