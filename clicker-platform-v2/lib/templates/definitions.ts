import { TemplateDefinition } from './types';

export const templateDefinitions: Record<string, Omit<TemplateDefinition, 'components'>> = {
    'classic': {
        id: 'classic',
        name: 'Sunnyside Original',
        description: 'The original vibrant and bold design.',
        config: {
            colors: {
                primary: '#B6FF2E',
                accent: '#0E3B2E',
                background: '#B6FF2E',
                foreground: '#0E3B2E',
                surface: '#FFFFFF',
                border: '#0E3B2E',
            },
            fonts: {
                heading: 'var(--font-jakarta), sans-serif',
                body: 'var(--font-jakarta), sans-serif',
            },
            borderRadius: '1.5rem',
            cardStyle: 'brutalist',
            cardVariant: 'shadow',
            backgroundElements: [
                { icon: 'Croissant', position: 'top-10 left-4', rotation: -15, size: 'w-16 h-16' },
                { icon: 'Coffee', position: 'top-20 right-6', rotation: 10, size: 'w-20 h-20', colorClass: 'bg-brand-green' },
                { icon: 'Sparkles', position: 'bottom-20 left-10', rotation: -5, size: 'w-12 h-12' },
                { icon: 'Clock', position: 'bottom-40 right-4', rotation: 12, size: 'w-14 h-14', colorClass: 'bg-brand-white' }
            ],
            headerLayout: 'center',
            homeButtonStyle: 'pill',
            homeButtonColor: 'primary',
            taglineStyle: 'outline', // Classic uses outline

            // Default Classic Layout (Narrow, Mobile-First)
            layout: {
                containerWidth: 'narrow',
                navMode: 'mobile-only',
                grid: { mobile: 1, tablet: 1, desktop: 1, gap: 'gap-4' }
            },
            defaultBlockLayouts: {
                hero: 'centered',
                text: 'prose',
                image: 'standard',
                faq: 'simple-list',
                map: 'card-with-address'
            }
        }
    },
    'modern': {
        id: 'modern',
        name: 'Modern Clean',
        description: 'A cleaner, more structured look.',
        config: {
            colors: {
                primary: '#FFD400',
                accent: '#1A1A1A',
                background: '#FFFFFF',
                foreground: '#1A1A1A',
                surface: '#F5F5F5',
                border: '#E5E5E5',
            },
            fonts: {
                heading: 'var(--font-space), monospace',
                body: 'var(--font-space), monospace',
            },
            borderRadius: '1rem',
            cardStyle: 'clean',
            cardVariant: 'shadow',
            backgroundElements: [],
            headerLayout: 'left',
            homeButtonStyle: 'pill',
            homeButtonColor: 'foreground',
            taglineStyle: 'contrast', // Modern uses high contrast

            // Modern Web App Layout (Single Column)
            layout: {
                containerWidth: 'boxed',
                navMode: 'adaptive',
                grid: { mobile: 1, tablet: 1, desktop: 1, gap: 'gap-6' }
            },
            defaultBlockLayouts: {
                hero: 'split',
                text: 'two-column',
                image: 'full-width',
                faq: 'accordion',
                map: 'embed-full'
            }
        }
    },
    'sojourner': {
        id: 'sojourner',
        name: 'Sojourner',
        description: 'Professional, clean, and trustworthy. Perfect for travel and business.',
        config: {
            colors: {
                primary: '#00AA6C', // Tripadvisor Green
                accent: '#00AA6C', // Same as primary for Sojourner by default
                background: '#F5F7FA', // Soft cool gray
                foreground: '#1C1C1C', // Dark text
                surface: '#FFFFFF',
                border: '#E0E0E0',
            },
            fonts: {
                heading: 'var(--font-inter), sans-serif',
                body: 'var(--font-inter), sans-serif',
            },
            borderRadius: '1rem',
            cardStyle: 'clean',
            cardVariant: 'outlined',
            backgroundElements: [],
            allowThemeColorOverride: false,
            headerLayout: 'left',
            homeButtonStyle: 'text',
            homeButtonColor: 'glass',
            taglineStyle: 'gentle', // Sojourner uses gentle gray

            // Immersive Layout (Single Column)
            layout: {
                containerWidth: 'full',
                navMode: 'adaptive',
                grid: { mobile: 1, tablet: 1, desktop: 1, gap: 'gap-8' }
            },
            defaultBlockLayouts: {
                hero: 'fullbleed',
                text: 'prose',
                image: 'standard',
                faq: 'grid',
                map: 'embed-full'
            }
        }
    },
    'shuvo': {
        id: 'shuvo',
        name: 'Shuvo Real Estate',
        description: 'Minimalist, architectural design with deep contrast.',
        config: {
            colors: {
                primary: '#1A1A1A', // Black Buttons
                accent: '#E65100', // Deep Orange
                background: '#F5F5F0', // Stone White
                foreground: '#1A1A1A', // Sharp Black Text
                surface: '#FFFFFF', // White Cards
                border: '#E5E5E5',
            },
            fonts: {
                heading: 'var(--font-playfair), serif', // Assuming Playfair exists, else fallback to Serif
                body: 'var(--font-jakarta), sans-serif',
            },
            borderRadius: '1rem',
            cardStyle: 'clean',
            cardVariant: 'flat', // Flat look for modern architectural feel
            backgroundElements: [],
            allowThemeColorOverride: false,
            headerLayout: 'left',
            homeButtonStyle: 'pill',
            homeButtonColor: 'primary',
            taglineStyle: 'contrast',

            // Responsive Layout
            layout: {
                containerWidth: 'tablet',
                navMode: 'adaptive', // Triggers Top Bar
                showBottomNav: true, // Explicitly enable Bottom Bar
                grid: { mobile: 1, tablet: 1, desktop: 1, gap: 'gap-4' }
            },
            defaultBlockLayouts: {
                hero: 'split',
                text: 'highlight-box',
                image: 'rounded-card',
                faq: 'accordion',
                map: 'card-with-address'
            },

            // Shuvo-Specific Customizations
            custom: {
                bottomNavStyle: 'minimal', // Options: 'minimal', 'labeled', 'float'
                cardOpacity: 0.95,         // For semi-transparent cards
                heroHeight: 'large',        // 'medium' | 'large' | 'full'
                hideQuickActionsTitle: true // Hides the "HOME" / "Quick Actions" button label
            }
        }
    },
    'mrb': {
        id: 'mrb',
        name: 'Mr Brightside',
        description: 'Dark mode elegance with neon accents and glassmorphism styling.',
        config: {
            colors: {
                primary: '#ec5b13', // Neon Orange
                accent: '#ec5b13',
                background: '#0a0a0a', // Deep Dark
                foreground: '#f8fafc', // Off-White
                surface: '#1a1a1a', // Dark Gray Cards
                border: '#262626', // Subtle Borders
                accentForeground: '#ffffff',
                surfaceElevated: '#222222',
                textMuted: '#94a3b8',   // slate-400
                textSubtle: '#64748b',  // slate-500
            },
            fonts: {
                heading: 'var(--font-inter), sans-serif',
                body: 'var(--font-inter), sans-serif',
            },
            borderRadius: '1rem',
            cardStyle: 'glass',
            cardVariant: 'outlined',
            backgroundElements: [],
            allowThemeColorOverride: false,
            headerLayout: 'center',
            homeButtonStyle: 'pill',
            homeButtonColor: 'primary',
            taglineStyle: 'contrast',
            decorations: {
                surfaceStyle: 'glass',
                accentGlow: true,
                neutralTone: 'cool',
            },
            layout: {
                containerWidth: 'boxed',
                navMode: 'adaptive',
                showBottomNav: true,
                grid: { mobile: 1, tablet: 1, desktop: 1, gap: 'gap-6' }
            },
            defaultBlockLayouts: {
                hero: 'centered',
                text: 'two-column',
                image: 'full-width',
                faq: 'accordion',
                map: 'embed-full'
            },
            custom: {
                bottomNavStyle: 'glass',
            }
        },
        homeBlockOrder: ['hero', 'quick_actions', 'branches', 'featured', 'gallery', 'hours'],
    },
    'mrb-light': {
        id: 'mrb-light',
        name: 'Mr Brightside Light',
        description: 'Modern minimalist elegance with warm tones and terracotta accents.',
        config: {
            colors: {
                primary: '#c2693a',       // Terracotta (default accent — user can override)
                accent: '#c2693a',
                background: '#FAF7F2',    // Warm off-white / cream
                foreground: '#2A2724',    // Soft charcoal — not true black
                surface: '#F0EBE3',       // Warm card surface
                border: '#E5DDD4',        // Warm subtle border
                accentForeground: '#ffffff',
                surfaceElevated: '#FFFFFF', // Pure white cards elevated above cream
                textMuted: '#8C7B6E',     // Warm medium gray
                textSubtle: '#B5A99E',    // Warm light gray (captions, meta)
            },
            fonts: {
                heading: 'var(--font-inter), sans-serif',
                body: 'var(--font-inter), sans-serif',
            },
            borderRadius: '1rem',
            cardStyle: 'clean',
            cardVariant: 'shadow',
            backgroundElements: [],
            allowThemeColorOverride: false,
            headerLayout: 'center',
            homeButtonStyle: 'pill',
            homeButtonColor: 'primary',
            taglineStyle: 'gentle',
            decorations: {
                surfaceStyle: 'soft',
                accentGlow: false,
                neutralTone: 'warm',
            },
            layout: {
                containerWidth: 'boxed',
                navMode: 'adaptive',
                showBottomNav: true,
                grid: { mobile: 1, tablet: 1, desktop: 1, gap: 'gap-6' }
            },
            defaultBlockLayouts: {
                hero: 'centered',
                text: 'two-column',
                image: 'full-width',
                faq: 'accordion',
                map: 'embed-full'
            },
            custom: {
                bottomNavStyle: 'minimal',
            }
        },
        homeBlockOrder: ['hero', 'quick_actions', 'branches', 'featured', 'gallery', 'hours'],
    }
};

export const getTemplateDefinition = (id: string) => {
    return templateDefinitions[id] || templateDefinitions['classic'];
};
