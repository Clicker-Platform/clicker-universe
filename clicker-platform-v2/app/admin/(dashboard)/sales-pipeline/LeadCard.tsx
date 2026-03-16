'use client';

import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Lead } from '@/lib/modules/sales-pipeline/types';
import { Calendar, User } from 'lucide-react';
import { format } from 'date-fns';

interface LeadCardProps {
    lead: Lead;
    onClick: (lead: Lead) => void;
    isOverlay?: boolean;
    color?: string;
}

export function LeadCard({ lead, onClick, isOverlay, color }: LeadCardProps) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: lead.id,
        data: { lead },
        disabled: isOverlay
    });

    const style = isOverlay ? {} : {
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.3 : 1,
        touchAction: 'none',
    };

    const content = (
        <div
            className={`
                bg-white dark:bg-neutral-800 rounded-lg p-3 border-l-4 shadow-sm
                ${isOverlay ? 'shadow-xl rotate-2 cursor-grabbing border-gray-300 dark:border-neutral-700' : 'hover:shadow-md border-gray-100 dark:border-neutral-700 cursor-grab'}
                transition-all border
            `}
            style={{ borderLeftColor: color || '#cbd5e1' }}
            onClick={() => !isOverlay && onClick(lead)}
        >
            <div className="flex justify-between items-start mb-2">
                <h4 className="font-semibold text-sm line-clamp-1 text-gray-800 dark:text-neutral-200">{lead.name}</h4>
                {(lead.value || 0) > 0 && (
                    <div className="flex items-center text-xs font-semibold text-gray-700 dark:text-neutral-300 bg-gray-50 dark:bg-neutral-800 px-2 py-1 rounded">
                        Rp {(lead.value || 0).toLocaleString('id-ID')}
                    </div>
                )}
            </div>

            <div className="flex flex-col gap-1 text-xs text-gray-500 dark:text-neutral-500">
                {lead.contact && (
                    <div className="flex items-center gap-1.5 line-clamp-1">
                        <User className="w-3 h-3 text-gray-400 dark:text-neutral-600" />
                        <span>{lead.contact}</span>
                    </div>
                )}
                <div className="flex items-center gap-1.5">
                    <Calendar className="w-3 h-3 text-gray-400 dark:text-neutral-600" />
                    <span>{format(lead.createdAt, 'MMM d')}</span>
                </div>
            </div>
        </div>
    );

    if (isOverlay) {
        return <div className="w-full">{content}</div>;
    }

    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="mb-3">
            {content}
        </div>
    );
}
