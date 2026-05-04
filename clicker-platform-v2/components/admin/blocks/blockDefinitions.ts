import { BlockType } from '@/data/mockData';
import { Type, Image as ImageIcon, Layout, Box, HelpCircle, AlignCenter, Link, Map, List, Clock, Star, MapPin, Play, Columns2, ClipboardList } from 'lucide-react';
import { getTemplate } from '@/lib/templates/registry';
import { DEFAULT_SHOWCASE_DATA, newRow } from '@/components/blocks/content-showcase/types';
import { DEFAULT_MEDIA } from '@/components/admin/blocks/media-field/types';

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
];

export function getDefaultData(type: BlockType, templateId = 'classic'): any {
    const template = getTemplate(templateId);
    const defaultLayoutVariant = template.config.defaultBlockLayouts?.[type];
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
        default:
            return baseData;
    }
}
