import {
    ShoppingBag,
    MessageCircle,
    Map,
    Utensils,
    Instagram,
    Facebook,
    Twitter,
    Clock
} from 'lucide-react';
import { TemplateId } from '@/lib/templates/types';
import { DaySchedule } from '@/lib/core/types';

export interface LinkItem {
    id: string;
    title: string;
    subtitle: string;
    url: string;
    icon?: React.ElementType;
    iconName?: string;
    highlight?: boolean;
    order?: number;
    type?: 'url' | 'form' | 'page';
    formId?: string;
    pageId?: string; // If type is 'page'
    hideOnHome?: boolean;
    openInNewTab?: boolean;
}

export type BlockType = 'hero' | 'text' | 'image' | 'button' | 'products' | 'faq' | 'link' | 'map' | 'image_gallery' | 'social_embed' | 'quick_actions' | 'hours' | 'featured_product' | 'branches' | 'reservation' | 'reservation_cta' | 'content_showcase' | 'inline_form' | string;

export interface PageBlock {
    id: string;
    type: BlockType;
    data: any;
}

export interface BackgroundMediaBase {
    mode: 'inherit' | 'color' | 'image' | 'video';
    url?: string;
    color?: string;
    displaySize?: 'cover' | 'contain' | 'pattern';
    backgroundPosition?: string;
    scrollEffect?: 'scroll' | 'fixed';
    overlayColor?: string;
    overlayOpacity?: number;
}

export interface BackgroundMedia extends BackgroundMediaBase {
    // When set, overrides all desktop fields for screens below md breakpoint.
    // mode: 'inherit' means "same as desktop" (no override).
    mobile?: BackgroundMediaBase;
}

export interface Page {
    id: string;
    title: string;
    slug: string;
    content: string; // Legacy support
    blocks?: PageBlock[]; // New block-based content
    background?: BackgroundMedia;
    createdAt?: any;
    updatedAt?: any;
    seo?: {
        title?: string;
        description?: string;
        image?: string;
        noIndex?: boolean;
    };
    pixels?: {
        facebookPixelId?: string;
        googleAnalyticsId?: string;
        tiktokPixelId?: string;
    };
    templateConfig?: {
        activeTemplateId?: string;
        customConfig?: any; // Partial<ThemeConfig>
    };
}

export interface FormField {
    id: string;
    type: 'text' | 'email' | 'tel' | 'textarea' | 'select' | 'file';
    label: string;
    placeholder?: string;
    required: boolean;
    options?: string[];
}

export interface Form {
    id: string;
    title: string;
    buttonText: string;
    isPublished: boolean;
    fields: FormField[];
    emailNotificationTo?: string;
    createdAt?: any;
}

export interface Submission {
    id: string;
    formId: string;
    formTitle: string;
    data: Record<string, any>;
    fieldLabels?: Record<string, string>; // Snapshot of labels at submission time
    submittedAt?: any;
    status: 'new' | 'read' | 'archived';
}

export interface BusinessProfile {
    name: string;
    tagline: string;
    description: string;
    avatarUrl: string;
    templateConfig?: {
        activeTemplateId?: string;
        customConfig?: any;
    };
}

export interface SocialLink {
    platform: string;
    url: string;
    icon: React.ElementType;
}

export interface Product {
    id: string;
    name: string;
    price: string;
    description?: string;
    imageUrl: string;
    category?: string;
    images?: string[];
    isActive?: boolean;
    showPrice?: boolean;
    showLabel?: boolean;
}

export interface SiteSettings {
    title: string;
    description: string;
    faviconUrl: string;
    ogImageUrl: string;
    themeColor: string;
    accentColor: string;
    fontFamily: string;
    templateId: TemplateId;
    /** @deprecated Use templateId instead. Kept for backward compatibility with existing Firestore data. */
    layoutStyle?: TemplateId;
    backgroundImageUrl: string;
    socialLinkItems?: SocialLinkItem[];
    footerText?: string;
    hideFooterContact?: boolean;
    showHeaderAddress?: boolean;
    homeBlockOrder?: string[];
    hiddenBlockIds?: string[]; // IDs of blocks to hide from the public page
    galleryTitle?: string;
    borderRadius?: 'small' | 'medium' | 'large' | 'none' | 'custom';
    customBorderRadius?: string;
    cardVariant?: 'shadow' | 'outlined' | 'flat';
    globalBackground?: BackgroundMedia;
    seo?: {
        title?: string;
        description?: string;
        image?: string;
    };
    pixels?: {
        facebookPixelId?: string;
        googleAnalyticsId?: string;
        tiktokPixelId?: string;
    };
    homepageSlug?: string;
    // Extended color tokens for locked-background templates (MRB, MRB-Light)
    backgroundColor?: string;  // overrides template background color
    surfaceColor?: string;      // overrides template surface/card color
    navigation?: {
        topNav: NavigationItem[];
        bottomNav: NavigationItem[];
        topNavActions?: {
            showSearch: boolean;
            cta?: {
                enabled: boolean;
                label: string;
                linkType: 'url' | 'page' | 'form';
                linkValue: string; // URL, PageID, or FormID
                formId?: string | null; // Optional redundancy for clarity/easier binding
                pageId?: string | null;
            };
        };
        fab?: NavigationItem;
    };
}

export interface NavigationItem {
    id: string;
    label: string;
    type: 'link' | 'page' | 'action' | 'url' | 'form';
    value: string;
    icon?: string;
    formId?: string | null;
    pageId?: string | null;
    enabled?: boolean;
}

export interface SocialLinkItem {
    platform: string;
    url: string;
    // We don't store the icon component here, we map it on the client
}

export const profile: BusinessProfile = {
    name: "SunnySide",
    tagline: "Baked Fresh Daily",
    description: "Artisanal pastries, strong coffee, and good vibes. Your neighborhood spot since 2024.",
    avatarUrl: "https://picsum.photos/300/300"
};

export const links: LinkItem[] = [
    {
        id: '1',
        title: 'Order for Pickup',
        subtitle: 'Skip the line, earn points',
        url: '#',
        icon: ShoppingBag,
        highlight: true
    },
    {
        id: '2',
        title: 'View Today’s Menu',
        subtitle: 'Fresh croissants just dropped',
        url: '#',
        icon: Utensils
    },
    {
        id: '3',
        title: 'Chat on WhatsApp',
        subtitle: 'For catering & bulk orders',
        url: '#',
        icon: MessageCircle
    },
    {
        id: '4',
        title: 'Find Our Location',
        subtitle: 'Directions via Google Maps',
        url: '#',
        icon: Map
    },
    {
        id: '5',
        title: 'Book Appointment',
        subtitle: 'Schedule your visit',
        url: '/book',
        icon: Clock,
        highlight: true
    }
];

export const featuredProduct: Product = {
    id: 'featured-1',
    name: 'Tiramisu Croissant',
    price: '$6.50',
    description: 'Our signature flaky croissant filled with mascarpone cream and dusted with premium cocoa.',
    imageUrl: 'https://images.unsplash.com/photo-1576618148400-f54bed99fcf8?q=80&w=800&auto=format&fit=crop'
};

export const products: Product[] = [
    {
        id: '1',
        name: 'Pain au Chocolat',
        price: '$4.50',
        imageUrl: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?q=80&w=400&auto=format&fit=crop'
    },
    {
        id: '2',
        name: 'Berry Danish',
        price: '$5.00',
        imageUrl: 'https://images.unsplash.com/photo-1509365465985-25d11c17e812?q=80&w=400&auto=format&fit=crop'
    },
    {
        id: '3',
        name: 'Iced Matcha',
        price: '$6.00',
        imageUrl: 'https://images.unsplash.com/photo-1515823664972-6d66e79b3872?q=80&w=400&auto=format&fit=crop'
    },
    {
        id: '4',
        name: 'Avocado Toast',
        price: '$12.00',
        imageUrl: 'https://images.unsplash.com/photo-1588137372308-15f75323a4dd?q=80&w=400&auto=format&fit=crop'
    }
];

export interface BusinessHours {
    enabled: boolean;
    label: string;
    tagText: string;
    monFri: string;
    satSun: string;
    schedule?: DaySchedule[];
}

export const initialBusinessHours: BusinessHours = {
    enabled: true,
    label: "Opening Hours",
    tagText: "Open Now",
    monFri: "07:00 - 20:00",
    satSun: "08:00 - 22:00"
};

export const socialLinks: SocialLink[] = [
    { platform: 'Instagram', url: '#', icon: Instagram },
    { platform: 'Facebook', url: '#', icon: Facebook },
    { platform: 'Twitter', url: '#', icon: Twitter },
];

export interface BusinessContact {
    whatsapp: string;
    email: string;
    address: string;
    mapUrl: string;
}

export const initialBusinessContact: BusinessContact = {
    whatsapp: "",
    email: "",
    address: "",
    mapUrl: ""
};

export interface Branch {
    id: string;
    name: string;
    address: string;
    mapUrl: string;
    phone?: string;
    isActive: boolean;
    order: number;
}

export interface LinkSettings {
    sectionTitle: string;
    showOnHome: boolean;
}

export interface ProductSettings {
    galleryTitle: string;
    showSectionTitle: boolean;
    itemsToShow: number;
    // Whatsapp Button Settings
    whatsappBtnLabel?: string;
    whatsappMessageTemplate?: string;
    whatsappBtnColor?: string;
    whatsappBtnTextColor?: string;
    ctaMode?: 'whatsapp' | 'url';
    ctaUrl?: string;
    ctaUrlLabel?: string;
    // Featured Product Settings
    featuredBtnText?: string;
}

export const defaultBusinessSchedule: DaySchedule[] = [
    { dayOfWeek: 1, isOpen: true, hours: [{ start: "09:00", end: "17:00" }] }, // Mon
    { dayOfWeek: 2, isOpen: true, hours: [{ start: "09:00", end: "17:00" }] }, // Tue
    { dayOfWeek: 3, isOpen: true, hours: [{ start: "09:00", end: "17:00" }] }, // Wed
    { dayOfWeek: 4, isOpen: true, hours: [{ start: "09:00", end: "17:00" }] }, // Thu
    { dayOfWeek: 5, isOpen: true, hours: [{ start: "09:00", end: "17:00" }] }, // Fri
    { dayOfWeek: 6, isOpen: true, hours: [{ start: "10:00", end: "15:00" }] }, // Sat
    { dayOfWeek: 0, isOpen: false, hours: [] } // Sun
];
