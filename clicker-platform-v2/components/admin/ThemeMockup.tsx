'use client';

import React from 'react';
import { SiteSettings } from '@/data/mockData';
import { TemplateDocument } from '@/lib/templates/types';

interface ThemeMockupProps {
    template: TemplateDocument | any;
    settings?: Partial<SiteSettings>;
    isMini?: boolean;
}

export const ThemeMockup: React.FC<ThemeMockupProps> = ({ template, settings: customSettings, isMini = false }) => {
    const config = template.config;
    if (!config) return null;

    // Combine base settings with custom overrides (if any)
    const displaySettings = {
        themeColor: customSettings?.themeColor || config.colors.primary,
        accentColor: customSettings?.accentColor || config.colors.accent,
        fontFamily: customSettings?.fontFamily || (template.id === 'shuvo' ? 'Playfair Display' : 'Plus Jakarta Sans'),
        borderRadius: customSettings?.borderRadius || 'large',
        faviconUrl: customSettings?.faviconUrl || '',
        ...customSettings
    };

    const isClean = config.cardStyle === 'clean';

    // Map radius setting to CSS value
    const radiusMap: Record<string, string> = {
        small: '0.5rem',
        medium: '1rem',
        large: '1.5rem'
    };
    const currentRadius = radiusMap[displaySettings.borderRadius || 'large'] || '1.5rem';

    return (
        <div
            className={`
                w-full overflow-hidden transition-all duration-300 flex flex-col
                ${isMini ? 'h-full' : 'min-h-[500px] border-[3px] shadow-sm'}
            `}
            style={{
                borderColor: isClean ? '#E0E0E0' : (isMini ? 'transparent' : displaySettings.accentColor),
                borderRadius: isMini ? '0px' : currentRadius,
                backgroundColor: isClean
                    ? (config.colors.background || '#FFFFFF')
                    : displaySettings.themeColor,
            }}
        >
            {/* Header for Active Preview */}
            {!isMini && (
                <div
                    className={`p-4 border-b text-center font-bold transition-colors ${isClean ? 'bg-white' : ''}`}
                    style={{
                        backgroundColor: isClean ? '#FFFFFF' : displaySettings.accentColor,
                        color: isClean ? displaySettings.accentColor : '#FFFFFF'
                    }}
                >
                    THEME PREVIEW
                </div>
            )}

            {/* Sojourner Hero Cover Hint */}
            {template.id === 'sojourner' && (
                <div className="w-full h-16 bg-gray-200 opacity-50 relative" style={{ backgroundColor: displaySettings.accentColor }}>
                    <div className="absolute inset-0 bg-white/20"></div>
                </div>
            )}

            {/* Content Body */}
            <div
                className={`flex-1 flex flex-col items-center justify-center transition-colors duration-300 ${isMini ? 'p-4' : 'p-8'}`}
                style={{
                    color: isClean ? (displaySettings.accentColor || '#1C1C1C') : (displaySettings.accentColor || '#0E3B2E'),
                    fontFamily: displaySettings.fontFamily || 'Plus Jakarta Sans',
                    // Scale down for mini grid view
                    transform: isMini ? 'scale(0.85)' : 'none',
                    transformOrigin: 'center center'
                }}
            >
                <link href={`https://fonts.googleapis.com/css2?family=${(displaySettings.fontFamily || 'Plus Jakarta Sans').replace(/ /g, '+')}:wght@400;700;800&family=Playfair+Display:wght@700&display=swap`} rel="stylesheet" />

                {/* Profile Section */}
                <div className={`w-full flex flex-col mb-4 ${config.headerLayout === 'left' ? 'items-start text-left' : 'items-center text-center'}`}>
                    <div
                        className={`w-16 h-16 bg-white mb-3 overflow-hidden ${isClean ? 'border border-gray-200 shadow-sm' : 'border-[3px]'}`}
                        style={{
                            borderColor: isClean ? displaySettings.themeColor : displaySettings.accentColor,
                            // Dynamic Radius: Shuvo is square, Modern is rounded-xl, Others full
                            borderRadius: template.id === 'shuvo' ? '4px' : (template.id === 'modern' ? '1rem' : '9999px')
                        }}
                    >
                        {displaySettings.faviconUrl ? (
                            <img src={displaySettings.faviconUrl} className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full bg-gray-50 bg-gradient-to-br from-gray-100 to-white" />
                        )}
                    </div>
                    {/* Sojourner adjustment: Move profile up to overlap hero */}
                    {template.id === 'sojourner' && <div className="-mt-8 relative z-10"></div>}
                    <h2 className={`uppercase leading-none mb-1 font-black ${isMini ? 'text-sm' : 'text-xl'}`}>
                        {isMini ? template.name : (customSettings?.title || 'YOUR NAME')}
                    </h2>
                    {!isMini && (
                        <p className={`text-[10px] ${isClean ? 'font-medium opacity-60' : 'font-bold opacity-80'}`}>
                            {customSettings?.description || 'Your tagline here'}
                        </p>
                    )}
                </div>

                {/* Mock Content - All templates now single column */}
                <div className="w-full space-y-2">
                    {/* Template Specific Content Hints */}
                    {template.id === 'shuvo' && (
                        <div className="w-full h-8 mb-2 bg-gray-100/50 flex items-center px-2 rounded-sm border border-gray-200/50">
                            <div className="w-1/2 h-2 bg-gray-300 rounded-full" />
                        </div>
                    )}

                    {[1, 2].map((i) => (
                        <div
                            key={i}
                            className={`
                                w-full bg-white p-2 flex items-center justify-between transition-all
                                ${config.cardVariant === 'shadow' ? 'shadow-sm border border-gray-100' : ''}
                                ${config.cardVariant === 'outlined' ? 'border-2 border-gray-100' : ''}
                                ${config.cardVariant === 'flat' ? 'border-0 bg-gray-50' : ''}
                            `}
                            style={{
                                borderColor: isClean ? '#F0F0F0' : displaySettings.accentColor,
                                borderRadius: template.id === 'classic' ? currentRadius : `calc(${currentRadius} * 0.4)`,
                                backgroundColor: config.colors.surface || '#FFFFFF'
                            }}
                        >
                            <span className="text-[10px] font-bold" style={{ color: isClean ? (template.id === 'shuvo' ? '#1A1A1A' : displaySettings.accentColor) : 'inherit' }}>
                                {isMini ? 'Sample Link' : `Action Item ${i}`}
                            </span>
                            {template.id !== 'shuvo' && (
                                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: displaySettings.themeColor }}></div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
