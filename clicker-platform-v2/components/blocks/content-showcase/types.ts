import { MediaFieldValue } from '@/components/admin/blocks/media-field/types';

export type ShowcaseMaxWidth = 'sm' | 'md' | 'lg' | 'xl' | 'full';
export type ShowcaseRowGap = 'sm' | 'md' | 'lg' | 'xl';
export type ShowcaseVerticalAlign = 'top' | 'center' | 'bottom';
export type ShowcaseLayout = 'alternate' | 'image-left' | 'image-right';
export type RowLayout = 'inherit' | 'image-left' | 'image-right';
export type CtaVariant = 'primary' | 'secondary' | 'ghost' | 'link';

export interface ShowcaseRowCta {
    enabled: boolean;
    label: string;
    href: string;
    variant: CtaVariant;
}

export interface ShowcaseRow {
    id: string;
    media: MediaFieldValue;
    heading: {
        text: string;
        // headingLevel?: reserved for future H1-H5 preset system
    };
    content: string; // HTML via Tiptap
    layout: RowLayout;
    mediaColumnWidth?: number; // 25-75, optional per-row override
    cta?: ShowcaseRowCta;
}

export interface ContentShowcaseData {
    maxWidth: ShowcaseMaxWidth;
    rowGap: ShowcaseRowGap;
    verticalAlign: ShowcaseVerticalAlign;
    defaultLayout: ShowcaseLayout;
    mediaColumnWidth: number; // 25-75, default 50
    rowBackgrounds: {
        enabled: boolean;
        oddColor?: string;
        evenColor?: string;
    };
    rows: ShowcaseRow[];
}

export const DEFAULT_SHOWCASE_DATA: ContentShowcaseData = {
    maxWidth: 'lg',
    rowGap: 'lg',
    verticalAlign: 'center',
    defaultLayout: 'alternate',
    mediaColumnWidth: 50,
    rowBackgrounds: {
        enabled: false,
    },
    rows: [],
};

export const MAX_WIDTH_CLASS: Record<ShowcaseMaxWidth, string> = {
    sm: 'max-w-2xl',
    md: 'max-w-4xl',
    lg: 'max-w-5xl',
    xl: 'max-w-6xl',
    full: 'max-w-none',
};

export const ROW_GAP_CLASS: Record<ShowcaseRowGap, string> = {
    sm: 'gap-y-8',
    md: 'gap-y-12',
    lg: 'gap-y-16',
    xl: 'gap-y-24',
};

export const VERTICAL_ALIGN_CLASS: Record<ShowcaseVerticalAlign, string> = {
    top: 'items-start',
    center: 'items-center',
    bottom: 'items-end',
};

export function newRow(): ShowcaseRow {
    return {
        id: typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID()
            : `row-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        media: {
            type: 'image',
            src: '',
            aspectRatio: '16:9',
            objectFit: 'cover',
        },
        heading: { text: 'Heading' },
        content: '<p>Add your content here…</p>',
        layout: 'inherit',
    };
}
