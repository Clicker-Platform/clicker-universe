import { BlockType } from '@/data/mockData';
import { Type, Image as ImageIcon, Layout, Box, HelpCircle, AlignCenter, Link, Map, List, Clock, Star, MapPin, Play, Columns2, ClipboardList, LayoutGrid, Columns3, Megaphone, Quote } from 'lucide-react';
import { DEFAULT_SHOWCASE_DATA, newRow } from '@/components/blocks/content-showcase/types';
import { DEFAULT_MEDIA } from '@/components/admin/blocks/media-field/types';
import { makeDefaultCard } from '@/components/blocks/feature-cards/types';
import { makeDefaultMarqueeItem } from '@/components/blocks/marquee/types';
import { DEFAULT_TESTIMONIALS_BLOCK_DATA } from '@/lib/canvas/blocks/testimonials/types';

export const BLOCK_OPTIONS: { type: BlockType; label: string; icon: React.ElementType }[] = [
    { type: 'hero', label: 'Hero Section', icon: Layout },
    { type: 'text', label: 'Text Content', icon: Type },
    { type: 'content_showcase', label: 'Content Showcase', icon: Columns2 },
    { type: 'image', label: 'Image', icon: ImageIcon },
    { type: 'button', label: 'Button', icon: Box },
    { type: 'products', label: 'Product List', icon: AlignCenter },
    { type: 'faq', label: 'FAQ List', icon: HelpCircle },
    { type: 'link', label: 'Link Card', icon: Link },
    { type: 'map', label: 'Map', icon: Map },
    { type: 'image_gallery', label: 'Image Gallery', icon: ImageIcon },
    { type: 'social_embed', label: 'Social Embeds', icon: Play },
    { type: 'quick_actions', label: 'Quick Actions', icon: List },
    { type: 'hours', label: 'Operating Hours', icon: Clock },
    { type: 'featured_product', label: 'Featured Product', icon: Star },
    { type: 'branches', label: 'Branches', icon: MapPin },
    { type: 'inline_form', label: 'Inline Form', icon: ClipboardList },
    { type: 'heading', label: 'Heading', icon: Type },
    { type: 'feature_cards', label: 'Feature Cards', icon: LayoutGrid },
    { type: 'columns', label: 'Columns', icon: Columns3 },
    { type: 'grid', label: 'Grid', icon: LayoutGrid },
    { type: 'marquee', label: 'Marquee', icon: Megaphone },
    { type: 'testimonials', label: 'Testimonials', icon: Quote },
];

// Block-owned default layout variants. Industry-standard: the block defines its own
// default; the template controls visual identity (colors, fonts, spacing) only.
export const BLOCK_DEFAULT_LAYOUT: Record<string, string> = {
    hero: 'centered',
    text: 'prose',
    image: 'standard',
    faq: 'accordion',
    map: 'card-with-address',
};

export function getDefaultData(type: BlockType, _templateId = 'classic'): any {
    const defaultLayoutVariant = BLOCK_DEFAULT_LAYOUT[type];
    const baseData: any = {};

    if (defaultLayoutVariant) {
        baseData.layoutVariant = defaultLayoutVariant;
    }

    switch (type) {
        case 'hero':
            return { ...baseData, title: 'Your Wonderful Headline', subtitle: 'Your subtitle goes here' };
        case 'text':
            return { ...baseData, content: '<p>Start writing your content here...</p>', verticalSpacing: 'medium', horizontalPadding: 'none' };
        case 'content_showcase':
            return { ...baseData, ...DEFAULT_SHOWCASE_DATA, rows: [newRow()] };
        case 'image':
            return { ...baseData, media: { ...DEFAULT_MEDIA, type: 'image' }, caption: '' };
        case 'button':
            return { ...baseData, label: 'Click Me', url: '#', variant: 'primary' };
        case 'products':
            return { ...baseData, title: 'Our Products' };
        case 'faq':
            return { ...baseData, title: 'Frequently Asked Questions', items: [{ question: 'Sample question?', answer: 'Sample answer.' }] };
        case 'link':
            return { ...baseData, title: 'Link Title', url: '#' };
        case 'map':
            return { ...baseData, address: 'Your address here' };
        case 'image_gallery':
            return { ...baseData, title: 'Gallery', images: [] };
        case 'social_embed':
            return { ...baseData, title: '', limit: 6, items: [] };
        case 'quick_actions':
        case 'hours':
        case 'branches':
        case 'featured_product':
            return baseData;
        case 'inline_form':
            return {
                ...baseData,
                formId: '',
                heading: '',
                subheading: '',
                successMessage: "Thank you! We'll be in touch.",
                redirectUrl: '',
            };
        case 'heading':
            return {
                ...baseData,
                heading: 'Your Headline',
                headingSize: 'xl',
                headingAlign: 'left',
                subheading: null,
                subheadingAlign: 'left',
                verticalSpacing: 'medium',
                horizontalPadding: 'none',
            };
        case 'feature_cards':
            return {
                ...baseData,
                title: '',
                subtitle: '',
                columns: 3,
                cards: [
                    makeDefaultCard(),
                    makeDefaultCard(),
                    makeDefaultCard(),
                ],
            };
        case 'columns': {
            const colIds = [
                `col-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                `col-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            ];
            return {
                ...baseData,
                columns: [
                    { id: colIds[0], size: 6, blocks: [] },
                    { id: colIds[1], size: 6, blocks: [] },
                ],
                gap: 16,        // horizontal gap between columns
                blockGap: 16,   // vertical gap between stacked blocks inside each column
                padding: 16,
                stackOnMobile: true,
                maxWidth: 'full',
            };
        }
        case 'grid': {
            const cols = 3, rows = 2;
            const cells = [];
            for (let r = 1; r <= rows; r++) {
                for (let c = 1; c <= cols; c++) {
                    cells.push({
                        id: `cell-${Date.now()}-${Math.random().toString(36).slice(2, 6)}-${r}-${c}`,
                        row: r,
                        col: c,
                        block: null,
                    });
                }
            }
            return {
                ...baseData,
                cols,
                rows,
                cells,
                gapX: 16,
                gapY: 16,
                padding: 16,
                stackOnMobile: true,
                maxWidth: 'full',
            };
        }
        case 'marquee':
            return {
                ...baseData,
                items: [
                    makeDefaultMarqueeItem('100% Online', 'Globe'),
                    makeDefaultMarqueeItem('Clear Pricing', 'DollarSign'),
                    makeDefaultMarqueeItem('Shipped To Your Door', 'Package'),
                    makeDefaultMarqueeItem('Licensed Providers', 'Award'),
                ],
                speed: 'normal',
                direction: 'left',
                iconSize: 'md',
                itemGap: 'normal',
            };
        case 'testimonials':
            return {
                ...baseData,
                ...DEFAULT_TESTIMONIALS_BLOCK_DATA,
            };
        default:
            return baseData;
    }
}
