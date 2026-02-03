export interface PipelineStage {
    id: string;
    name: string;
    order: number;
    type: 'active' | 'won' | 'lost';
    color?: string; // Hex code for UI decoration
}

export interface Lead {
    id: string;
    name: string;
    contact: string; // Phone or Email
    source?: string; // e.g. "Walk-in", "Website", "Referral"
    notes?: string;
    stageId: string;
    value?: number; // Potential deal value
    createdAt: number; // Timestamp
    updatedAt: number; // Timestamp
}

export interface PipelineConfig {
    stages: PipelineStage[];
    formIntegrations?: FormIntegration[];
}

export interface FormIntegration {
    formId: string;
    targetStageId: string;
    fieldMapping: {
        name: string;
        contact: string;
        source?: string;
        notes?: string;
    };
}
