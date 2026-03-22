import { BlockType } from '@/data/mockData';
import { Type, Image as ImageIcon, Layout, Box, HelpCircle, AlignCenter, Link, Map, List, Clock, Star, MapPin } from 'lucide-react';
import { getTemplate } from '@/lib/templates/registry';

export const BLOCK_OPTIONS: { type: BlockType; label: string; icon: React.ElementType }[] = [
    { type: 'hero', label: 'Hero Section', icon: Layout },
    { type: 'text', label: 'Text Content', icon: Type },
    { type: 'image', label: 'Image', icon: ImageIcon },
    { type: 'button', label: 'Button', icon: Box },
    { type: 'products', label: 'Product List', icon: AlignCenter },
    { type: 'faq', label: 'FAQ List', icon: HelpCircle },
    { type: 'link', label: 'Link Card', icon: Link },
    { type: 'map', label: 'Map', icon: Map },
    { type: 'image_gallery', label: 'Image Gallery', icon: ImageIcon },
    { type: 'quick_actions', label: 'Quick Actions', icon: List },
    { type: 'hours', label: 'Operating Hours', icon: Clock },
    { type: 'featured_product', label: 'Featured Product', icon: Star },
    { type: 'branches', label: 'Branches', icon: MapPin },
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
            return { ...baseData, title: 'Your Headline', subtitle: 'Your subtitle goes here' };
        case 'text':
            return { ...baseData, content: '<p>Start writing your content here...</p>' };
        case 'image':
            return { ...baseData, alt: 'Image description', caption: '' };
        case 'button':
            return { ...baseData, label: 'Click Me', url: '#', style: 'primary' };
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
        case 'quick_actions':
        case 'hours':
        case 'branches':
        case 'featured_product':
            return baseData;
        default:
            return baseData;
    }
}
