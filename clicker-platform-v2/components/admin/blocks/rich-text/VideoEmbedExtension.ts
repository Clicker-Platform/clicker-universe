import { Node, mergeAttributes } from '@tiptap/core';

export interface VideoEmbedOptions {
    HTMLAttributes: Record<string, unknown>;
}

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        videoEmbed: {
            setVideoEmbed: (options: { src: string }) => ReturnType;
        };
    }
}

function detectProvider(url: string): { provider: 'youtube' | 'vimeo' | 'mp4'; embedSrc: string } | null {
    const trimmed = url.trim();
    if (!trimmed) return null;

    const yt = trimmed.match(
        /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/
    );
    if (yt) return { provider: 'youtube', embedSrc: `https://www.youtube.com/embed/${yt[1]}` };

    const vimeo = trimmed.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    if (vimeo) return { provider: 'vimeo', embedSrc: `https://player.vimeo.com/video/${vimeo[1]}` };

    if (/\.(mp4|webm|ogg)(\?.*)?$/i.test(trimmed)) {
        if (!/^https?:\/\//i.test(trimmed)) return null;
        return { provider: 'mp4', embedSrc: trimmed };
    }

    return null;
}

export const VideoEmbed = Node.create<VideoEmbedOptions>({
    name: 'videoEmbed',
    group: 'block',
    atom: true,
    draggable: true,
    selectable: true,

    addOptions() {
        return {
            HTMLAttributes: {
                class: 'video-embed-wrapper relative w-full aspect-video my-4 rounded-lg overflow-hidden bg-black',
            },
        };
    },

    addAttributes() {
        return {
            src: {
                default: null,
                parseHTML: (el) => el.getAttribute('data-src'),
                renderHTML: (attrs) => ({ 'data-src': attrs.src ?? '' }),
            },
            provider: {
                default: null,
                parseHTML: (el) => el.getAttribute('data-provider'),
                renderHTML: (attrs) => ({ 'data-provider': attrs.provider ?? '' }),
            },
        };
    },

    parseHTML() {
        return [
            { tag: 'div[data-video-embed]' },
        ];
    },

    renderHTML({ HTMLAttributes }) {
        const src: string | null = HTMLAttributes.src;
        const provider: string | null = HTMLAttributes.provider;

        const wrapperAttrs = mergeAttributes(this.options.HTMLAttributes, {
            'data-video-embed': '',
            'data-src': src || '',
            'data-provider': provider || '',
        });

        if (!src) return ['div', wrapperAttrs, ''];

        if (provider === 'mp4') {
            return [
                'div',
                wrapperAttrs,
                ['video', { src, controls: 'true', class: 'w-full h-full object-contain' }],
            ];
        }

        return [
            'div',
            wrapperAttrs,
            [
                'iframe',
                {
                    src,
                    class: 'absolute inset-0 w-full h-full',
                    frameborder: '0',
                    allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture',
                    allowfullscreen: 'true',
                },
            ],
        ];
    },

    addCommands() {
        return {
            setVideoEmbed:
                ({ src }) =>
                ({ commands }) => {
                    const detected = detectProvider(src);
                    if (!detected) return false;
                    return commands.insertContent({
                        type: this.name,
                        attrs: { src: detected.embedSrc, provider: detected.provider },
                    });
                },
        };
    },
});

export { detectProvider as detectVideoProvider };
