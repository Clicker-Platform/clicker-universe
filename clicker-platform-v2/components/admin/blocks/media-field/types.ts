export type MediaType = 'image' | 'video' | 'lottie';
export type MediaAspectRatio = 'square' | '4:3' | '16:9' | '3:4' | 'free';
export type MediaObjectFit = 'cover' | 'contain';

export interface MediaFieldValue {
    type: MediaType;
    src: string;
    alt?: string;
    aspectRatio?: MediaAspectRatio;
    objectFit?: MediaObjectFit;
    // video-specific
    autoplay?: boolean;
    muted?: boolean;
    loop?: boolean;
    poster?: string;
}

export const DEFAULT_MEDIA: MediaFieldValue = {
    type: 'image',
    src: '',
    aspectRatio: '16:9',
    objectFit: 'cover',
    autoplay: true,
    muted: true,
    loop: true,
};

export const ASPECT_RATIO_CLASS: Record<MediaAspectRatio, string> = {
    'square': 'aspect-square',
    '4:3': 'aspect-[4/3]',
    '16:9': 'aspect-video',
    '3:4': 'aspect-[3/4]',
    'free': '',
};
