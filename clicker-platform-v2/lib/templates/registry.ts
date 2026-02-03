import { TemplateDefinition, TemplateId } from './types';
import { templateDefinitions } from './definitions';

// Component Imports
import { ClassicProfileHeader } from '@/components/headers/ClassicProfileHeader';
import { ModernProfileHeader } from '@/components/headers/ModernProfileHeader';
import { ShuvoHeader } from '@/components/headers/ShuvoHeader';
import { BackgroundDecorations } from '@/components/BackgroundDecorations';

// Map IDs to Component Sets
const templateComponents: Record<string, any> = {
    'classic': {
        Header: ClassicProfileHeader,
        Background: BackgroundDecorations,
    },
    'modern': {
        Header: ModernProfileHeader,
        Background: () => null, // Modern template has no background decorations
    },
    'sojourner': {
        Header: ModernProfileHeader,
        Background: BackgroundDecorations,
    },
    'shuvo': {
        Header: ShuvoHeader,
        Background: BackgroundDecorations,
    }
};

// Merge definitions with components for the full registry
export const templates: Record<string, TemplateDefinition> = Object.keys(templateDefinitions).reduce((acc, key) => {
    acc[key] = {
        ...templateDefinitions[key],
        components: templateComponents[key]
    };
    return acc;
}, {} as Record<string, TemplateDefinition>);

export const getTemplate = (id: string): TemplateDefinition => {
    return templates[id] || templates['classic'];
};
