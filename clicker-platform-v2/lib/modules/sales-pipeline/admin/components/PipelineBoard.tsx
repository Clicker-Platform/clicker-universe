'use client';

import { useSite } from '@/lib/site-context';
import { logger } from '@/lib/logger-edge';

import { useState, useMemo } from 'react';
import {
    DndContext,
    DragOverlay,
    useSensor,
    useSensors,
    PointerSensor,
    TouchSensor,
    DragEndEvent,
    DragStartEvent
} from '@dnd-kit/core';
import { PipelineStage, Lead } from '@/lib/modules/sales-pipeline/types';
import { StageColumn } from './StageColumn';
import { LeadCard } from './LeadCard';
import { updateLeadStage } from '@/lib/modules/sales-pipeline/api';
import { LeadDetailSheet } from './LeadDetailSheet';
import { NewLeadDialog } from './NewLeadDialog';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';

import { Settings } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface PipelineBoardProps {
    stages: PipelineStage[];
    leads: Lead[];
}

export function PipelineBoard({ stages, leads }: PipelineBoardProps) {
    const { siteId } = useSite();
    const router = useRouter();
    const [activeDragLead, setActiveDragLead] = useState<Lead | null>(null);
    const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
    const [isNewLeadOpen, setIsNewLeadOpen] = useState(false);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5,
            },
        }),
        useSensor(TouchSensor, {
            activationConstraint: {
                delay: 250,
                tolerance: 5,
            },
        })
    );

    const leadsByStage = useMemo(() => {
        const acc: Record<string, Lead[]> = {};
        stages.forEach(stage => {
            acc[stage.id] = leads.filter(l => l.stageId === stage.id);
        });
        return acc;
    }, [stages, leads]);

    function handleDragStart(event: DragStartEvent) {
        const { active } = event;
        const lead = active.data.current?.lead as Lead;
        setActiveDragLead(lead);
    }

    async function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event;
        setActiveDragLead(null);

        if (!over) return;

        const leadId = active.id as string;
        const newStageId = over.id as string;
        const currentStageId = active.data.current?.lead?.stageId;

        if (leadId && newStageId && newStageId !== currentStageId) {
            const MAX_RETRIES = 3;
            let attempt = 0;
            let success = false;

            while (attempt < MAX_RETRIES && !success) {
                try {
                    if (!siteId) throw new Error("No site ID");
                    await updateLeadStage(siteId, leadId, newStageId);
                    success = true;
                    toast.success("Lead moved");
                } catch (error) {
                    attempt++;
                    logger.error('sales-pipeline.lead.move.failed', { siteId, attempt, error });
                    if (attempt === MAX_RETRIES) {
                        toast.error("Failed to move lead. Please check your connection.");
                    } else {
                        await new Promise(resolve => setTimeout(resolve, 500 * Math.pow(2, attempt - 1)));
                    }
                }
            }
        }
    }

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Toolbar */}
            <div className="p-4 border-b border-gray-100 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex justify-between items-center flex-shrink-0">
                <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-gray-800 dark:text-neutral-200">Pipeline</h2>
                    <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-neutral-800 rounded-full text-gray-500 dark:text-neutral-500 font-mono">
                        {leads.length} Leads
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => router.push('/admin/sales-pipeline/settings')}
                        className="p-2 text-gray-400 dark:text-neutral-600 hover:text-brand-dark hover:bg-gray-100 dark:hover:bg-neutral-700 rounded-lg transition-colors"
                        title="Pipeline Settings"
                    >
                        <Settings className="w-5 h-5" />
                    </button>
                    <button
                        onClick={() => setIsNewLeadOpen(true)}
                        className="flex items-center gap-2 bg-black hover:bg-gray-800 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        New Lead
                    </button>
                </div>
            </div>

            {/* Board Area */}
            <DndContext
                sensors={sensors}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
            >
                <div className="flex-1 overflow-x-auto overflow-y-hidden p-4 bg-gray-50/30 dark:bg-neutral-900/30">
                    <div className="flex h-full gap-4 min-w-max">
                        {stages.map(stage => (
                            <StageColumn
                                key={stage.id}
                                stage={stage}
                                leads={leadsByStage[stage.id] || []}
                                onLeadClick={setSelectedLead}
                            />
                        ))}
                    </div>
                </div>

                <DragOverlay>
                    {activeDragLead ? (
                        <div className="min-w-[280px] max-w-[280px]">
                            <LeadCard
                                lead={activeDragLead}
                                onClick={() => { }}
                                isOverlay
                                color={stages.find(s => s.id === activeDragLead.stageId)?.color}
                            />
                        </div>
                    ) : null}
                </DragOverlay>
            </DndContext>

            {/* Modals */}
            <LeadDetailSheet
                lead={selectedLead}
                stages={stages}
                isOpen={!!selectedLead}
                onClose={() => setSelectedLead(null)}
            />

            <NewLeadDialog
                defaultStageId={stages[0]?.id || 'lead'}
                isOpen={isNewLeadOpen}
                onClose={() => setIsNewLeadOpen(false)}
            />
        </div>
    );
}
