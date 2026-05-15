'use client';

import React, { useState } from 'react';
import { Branch, BusinessContact } from '@/data/mockData';
import { MapPin, Phone, ChevronDown, ChevronUp, ExternalLink, Navigation } from 'lucide-react';
import { useTemplate } from '@/components/TemplateProvider';
import { getCardClasses, getGlassStyle, getTextColor } from '@/components/blocks/public/cardStyles';

interface BranchesListProps {
    contact: BusinessContact;
    branches: Branch[];
}

export const DefaultBranchesBlock: React.FC<BranchesListProps> = ({ contact, branches }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    const { theme } = useTemplate();
    const cardStyle = theme.cardStyle;
    const isGlass = cardStyle === 'glass';
    const colors = theme.colors;

    if (!contact.address && branches.length === 0) return null;

    const textPrimary = getTextColor(cardStyle);
    const textMuted = getTextColor(cardStyle, true);

    // Contrast color for text/icons on top of theme.primary.
    const primaryContrastColor =
        colors.accentForeground ??
        (colors.accent && colors.accent !== colors.primary ? colors.accent : undefined) ??
        colors.background ??
        '#ffffff';

    return (
        <div className="w-full">
            {/* Main Location Card */}
            {contact.address && (
                <div
                    className={`p-4 ${branches.length > 0 ? 'mb-4' : ''} ${getCardClasses(cardStyle)}`}
                    style={{ borderRadius: 'var(--theme-radius)', ...(isGlass ? getGlassStyle(theme.colors.surface) : {}) }}
                >
                    <div className="flex items-start gap-4">
                        <div
                            className="p-3 shrink-0"
                            style={{
                                borderRadius: 'calc(var(--theme-radius) * 0.75)',
                                backgroundColor: isGlass ? 'rgba(255,255,255,0.10)' : `${colors.primary}1a`, // primary @ 10% opacity
                                color: isGlass ? 'rgba(255,255,255,0.95)' : colors.primary,
                            }}
                        >
                            <MapPin size={24} />
                        </div>
                        <div className="flex-1">
                            <h3 className={`uppercase font-bold text-base mb-1 ${textPrimary}`}>Main Location</h3>
                            <p className={`leading-relaxed mb-3 whitespace-pre-line text-sm font-medium ${textMuted}`}>
                                {contact.address}
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {contact.mapUrl && (
                                    <a
                                        href={contact.mapUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase hover:opacity-80 transition-opacity"
                                        style={{
                                            backgroundColor: colors.primary,
                                            color: primaryContrastColor,
                                            borderRadius: 'calc(var(--theme-radius) * 0.6)',
                                        }}
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
                <div
                    className={`overflow-hidden ${getCardClasses(cardStyle)}`}
                    style={{ borderRadius: 'var(--theme-radius)', ...(isGlass ? getGlassStyle(theme.colors.surface) : {}) }}
                >
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className={`w-full flex items-center justify-between p-4 transition-colors ${isGlass ? 'hover:bg-white/10' : 'hover:bg-gray-50'}`}
                    >
                        <span className={`font-bold flex items-center gap-2 ${textPrimary}`}>
                            <MapPin size={18} />
                            Other Locations ({branches.length})
                        </span>
                        {isExpanded
                            ? <ChevronUp size={20} className={textMuted} />
                            : <ChevronDown size={20} className={textMuted} />}
                    </button>

                    {isExpanded && (
                        <div className={`divide-y ${isGlass ? 'divide-white/10' : 'divide-gray-100'}`}>
                            {branches.map((branch) => (
                                <div key={branch.id} className={`p-4 transition-colors ${isGlass ? 'hover:bg-white/5' : 'hover:bg-gray-50'}`}>
                                    <h4 className={`font-bold mb-1 ${textPrimary}`}>{branch.name}</h4>
                                    <p className={`text-sm whitespace-pre-line mb-3 ${textMuted}`}>{branch.address}</p>
                                    <div className="flex gap-3">
                                        {branch.mapUrl && (
                                            <a
                                                href={branch.mapUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-1 text-xs font-bold hover:underline"
                                                style={{ color: 'var(--theme-primary)' }}
                                            >
                                                <ExternalLink size={12} /> Map
                                            </a>
                                        )}
                                        {branch.phone && (
                                            <a href={`tel:${branch.phone}`}
                                                className={`flex items-center gap-1 text-xs font-bold ${textMuted} hover:${textPrimary}`}>
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

export { DefaultBranchesBlock as BranchesList };
