'use client';

import { useEffect, useState } from 'react';
import { PipelineBoard } from './components/PipelineBoard';
import { getPipelineConfig, subscribeToLeads } from '@/lib/modules/sales-pipeline/api';
import { PipelineStage, Lead } from '@/lib/modules/sales-pipeline/types';
import { useSite } from '@/lib/site-context';
import { Loader2 } from 'lucide-react';

export default function PipelinePage() {
    const [stages, setStages] = useState<PipelineStage[]>([]);
    const [leads, setLeads] = useState<Lead[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { siteId } = useSite();

    useEffect(() => {
        if (!siteId) return;

        let unsubscribe: () => void;

        const init = async () => {
            const config = await getPipelineConfig(siteId);
            if (config.stages) {
                setStages(config.stages.sort((a, b) => a.order - b.order));
            }

            unsubscribe = subscribeToLeads(siteId, (updatedLeads) => {
                setLeads(updatedLeads);
                setIsLoading(false);
            });
        };

        init();

        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [siteId]);

    if (isLoading) {
        return (
            <div className="flex h-full items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
            </div>
        );
    }

    return (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden flex flex-col h-[calc(100vh-2rem)] md:h-[calc(100vh-6rem)]">
            <PipelineBoard stages={stages} leads={leads} />
        </div>
    );
}
