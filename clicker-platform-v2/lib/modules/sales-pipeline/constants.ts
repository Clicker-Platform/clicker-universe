import { PipelineStage } from "./types";

export const DEFAULT_PIPELINE_STAGES: PipelineStage[] = [
    {
        id: 'lead',
        name: 'New Lead',
        order: 0,
        type: 'active',
        color: '#3b82f6' // Blue
    },
    {
        id: 'qualified',
        name: 'Qualified',
        order: 1,
        type: 'active',
        color: '#8b5cf6' // Violet
    },
    {
        id: 'proposal',
        name: 'Proposal',
        order: 2,
        type: 'active',
        color: '#f59e0b' // Amber
    },
    {
        id: 'negotiation',
        name: 'Negotiation',
        order: 3,
        type: 'active',
        color: '#ec4899' // Pink
    },
    {
        id: 'won',
        name: 'Won',
        order: 4,
        type: 'won',
        color: '#10b981' // Emerald
    },
    {
        id: 'lost',
        name: 'Lost',
        order: 5,
        type: 'lost',
        color: '#ef4444' // Red
    }
];

export const MODULE_ID = 'sales-pipeline';
export const COLLECTION_LEADS = 'leads';
export const COLLECTION_CONFIG = 'pipeline_config';
