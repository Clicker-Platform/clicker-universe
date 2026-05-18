import { TemplateDefinition, TemplateId } from './types';
import { templateDefinitions } from './definitions';

// Component Imports
import { BackgroundDecorations } from '@/components/BackgroundDecorations';

import { MrbQuickActions } from '@/components/blocks/mrb/MrbQuickActions';
import { MrbOperatingHours } from '@/components/blocks/mrb/MrbOperatingHours';
import { MrbHero } from '@/components/blocks/mrb/MrbHero';

// Map IDs to Component Sets
const templateComponents: Record<string, any> = {
    'classic': {
        Background: BackgroundDecorations,
    },
    'modern': {
        Background: () => null, // Modern template has no background decorations
    },
    'sojourner': {
        Background: BackgroundDecorations,
    },
    'shuvo': {
        Background: BackgroundDecorations,
    },
    'mrb': {
        Background: () => null,
        Blocks: {
            Hero: MrbHero,
            QuickActions: MrbQuickActions,
            OperatingHours: MrbOperatingHours
        }
    },
    'mrb-light': {
        Background: () => null,
        Blocks: {
            Hero: MrbHero,
            QuickActions: MrbQuickActions,
            OperatingHours: MrbOperatingHours
        }
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
