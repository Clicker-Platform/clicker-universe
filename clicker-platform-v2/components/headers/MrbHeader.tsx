'use client';

import React from 'react';
import { BusinessProfile, BusinessContact } from '@/data/mockData';
import { MapPin } from 'lucide-react';
import { useTemplate } from '@/components/TemplateProvider';

interface HeaderProps {
    profile: BusinessProfile;
    contact?: BusinessContact;
    showAddress?: boolean;
}

export const MrbHeader: React.FC<HeaderProps> = ({ profile: _profile, contact, showAddress }) => {
    const { theme } = useTemplate();

    return (
        <div className="flex flex-col w-full relative z-10 font-sans overflow-hidden rounded-3xl"
             style={{ backgroundColor: theme.colors.background }}>
            
            {/* Show Address - On Mrb this usually appears as a stylized footer or sub-header section */}
            {showAddress && contact?.address && (
                <div className="w-full px-0 py-8" style={{ backgroundColor: theme.colors.background }}>
                    <div 
                        className="flex flex-col items-center justify-center gap-3 p-6 rounded-2xl w-full max-w-md mx-auto"
                        style={{ 
                            backgroundColor: `${theme.colors.surface}99`,
                            backdropFilter: 'blur(12px)',
                            border: `1px solid ${theme.colors.primary}15`
                        }}
                    >
                        <div className="size-12 rounded-full flex items-center justify-center" style={{ backgroundColor: `${theme.colors.primary}20` }}>
                            <MapPin size={24} color={theme.colors.primary} strokeWidth={2} />
                        </div>
                        <div className="text-center">
                            <p className="font-bold text-lg" style={{ color: theme.colors.foreground }}>Find Us</p>
                            <p className="text-sm opacity-60" style={{ color: theme.colors.foreground }}>{contact.address.split('\n')[0]}</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

