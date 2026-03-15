'use client';

import React, { useState } from 'react';
import { Branch, BusinessContact } from '@/data/mockData';
import { MapPin, Phone, ChevronDown, ChevronUp, ExternalLink, Navigation } from 'lucide-react';
import { useTemplate } from '@/components/TemplateProvider';

interface BranchesListProps {
    contact: BusinessContact;
    branches: Branch[];
}

export const BranchesList: React.FC<BranchesListProps> = ({ contact, branches }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    const { templateId, theme } = useTemplate();
    const isClean = theme.cardStyle === 'clean';
    const isGlass = theme.cardStyle === 'glass';

    // If no data, don't render
    if (!contact.address && branches.length === 0) return null;

    return (
        <div className="w-full">
            {/* Main Location Card */}
            {contact.address && (
                <div className={`
                    p-4 mb-4 rounded-2xl
                    ${isClean
                        ? 'bg-white border border-gray-200 shadow-sm'
                        : isGlass ? 'bg-black/20 backdrop-blur-md border border-white/10 shadow-xl'
                        : 'bg-white border-[3px] border-theme-border shadow-sticker'
                    }
                `}>
                        <div className="flex items-start gap-4">
                            <div className={`
                                p-3 rounded-xl shrink-0
                                ${isClean ? 'bg-green-50 text-brand-green' : isGlass ? 'bg-primary/20 text-primary' : 'bg-brand-dark text-brand-green'}
                            `}>
                                <MapPin size={24} />
                            </div>
                            <div className="flex-1">
                                <h3 className={`uppercase mb-1 ${isClean ? 'font-bold text-gray-900 text-base' : isGlass ? 'font-bold text-white text-lg' : 'font-black text-brand-dark text-lg'}`}>Main Location</h3>
                                <p className={`leading-relaxed mb-3 whitespace-pre-line ${isClean ? 'text-gray-500 font-medium text-sm' : isGlass ? 'text-white/70 font-medium text-sm' : 'text-gray-700 font-medium text-sm'}`}>
                                    {contact.address}
                                </p>

                                <div className="flex flex-wrap gap-2">
                                    {contact.mapUrl && (
                                        <a
                                            href={contact.mapUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className={`
                                                inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase transition-colors
                                                ${isClean
                                                    ? 'bg-brand-dark text-white hover:bg-brand-green'
                                                    : isGlass
                                                    ? 'bg-primary text-white hover:bg-primary/90'
                                                    : 'bg-brand-dark text-white hover:bg-brand-green hover:text-brand-dark'
                                                }
                                            `}
                                        >
                                            <Navigation size={14} /> Get Directions
                                        </a>
                                    )}
                                </div>
                            </div>
                        </div>
                </div>
            )}

            {/* Branches Accordion */}
            {branches.length > 0 && (
                <div className={`
                    rounded-3xl overflow-hidden
                    ${isClean
                        ? 'bg-white border border-gray-200'
                        : isGlass
                        ? 'bg-black/20 backdrop-blur-md border border-white/10'
                        : 'bg-white border-[3px] border-theme-border shadow-sticker'
                    }
                `}>
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className={`w-full flex items-center justify-between p-4 transition-colors ${
                            isClean ? 'bg-gray-50 hover:bg-gray-100' : isGlass ? 'bg-white/5 hover:bg-white/10' : 'bg-transparent hover:bg-gray-50'
                        }`}
                    >
                        <span className={`font-bold flex items-center gap-2 ${isGlass ? 'text-white' : 'text-brand-dark'}`}>
                            <MapPin size={18} />
                            Other Locations ({branches.length})
                        </span>
                        {isExpanded ? <ChevronUp size={20} className={isGlass ? 'text-white/70' : ''} /> : <ChevronDown size={20} className={isGlass ? 'text-white/70' : ''} />}
                    </button>

                    {isExpanded && (
                        <div className={`divide-y ${isGlass ? 'divide-white/10' : 'divide-gray-100'}`}>
                            {branches.map((branch) => (
                                <div key={branch.id} className={`p-4 transition-colors ${isGlass ? 'hover:bg-white/5' : 'hover:bg-gray-50'}`}>
                                    <h4 className={`font-bold mb-1 ${isGlass ? 'text-white' : 'text-brand-dark'}`}>{branch.name}</h4>
                                    <p className={`text-sm whitespace-pre-line mb-3 ${isGlass ? 'text-white/70' : 'text-gray-600'}`}>{branch.address}</p>

                                    <div className="flex gap-3">
                                        {branch.mapUrl && (
                                            <a
                                                href={branch.mapUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:underline"
                                            >
                                                <ExternalLink size={12} /> Map
                                            </a>
                                        )}
                                        {branch.phone && (
                                            <a
                                                href={`tel:${branch.phone}`}
                                                className="flex items-center gap-1 text-xs font-bold text-gray-500 hover:text-brand-dark"
                                            >
                                                <Phone size={12} /> {branch.phone}
                                            </a>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
