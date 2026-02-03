'use client';

import { useDroppable } from '@dnd-kit/core';
import { PipelineStage, Lead } from '@/lib/modules/sales-pipeline/types';
import { LeadCard } from './LeadCard';
import { cn } from '@/lib/utils';

interface StageColumnProps {
    stage: PipelineStage;
    leads: Lead[];
    onLeadClick: (lead: Lead) => void;
}

export function StageColumn({ stage, leads, onLeadClick }: StageColumnProps) {
    const { setNodeRef, isOver } = useDroppable({
        id: stage.id,
        data: { stage }
    });

    const isTerminal = stage.type === 'won' || stage.type === 'lost';

    return (
        <div className="flex flex-col h-full min-w-[280px] md:min-w-[320px] max-w-[320px] rounded-xl bg-gray-50 border border-gray-200 flex-shrink-0 snap-center">
            {/* Header */}
            <div className={cn(
                "p-3 rounded-t-xl border-b border-gray-200 flex items-center justify-between sticky top-0 bg-gray-50 z-10",
                isTerminal && "bg-opacity-50"
            )}>
                <div className="flex items-center gap-2">
                    <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: stage.color || '#cbd5e1' }}
                    />
                    <h3 className="font-semibold text-sm text-gray-700">{stage.name}</h3>
                </div>
                <span className="text-xs bg-white border border-gray-200 text-gray-500 px-2 py-0.5 rounded-full font-mono">
                    {leads.length}
                </span>
            </div>

            {/* Content Area - Droppable */}
            <div
                ref={setNodeRef}
                className={cn(
                    "flex-1 p-2 overflow-y-auto scrollbar-thin transition-colors",
                    isOver && "bg-blue-50/50 border-2 border-brand-primary/20 border-dashed rounded-b-xl"
                )}
            >
                {leads.map((lead) => (
                    <LeadCard
                        key={lead.id}
                        lead={lead}
                        onClick={onLeadClick}
                        color={stage.color}
                    />
                ))}

                {leads.length === 0 && (
                    <div className="h-full flex items-center justify-center text-gray-300 text-xs italic p-4 text-center">
                        Drop items here
                    </div>
                )}
            </div>
        </div>
    );
}
