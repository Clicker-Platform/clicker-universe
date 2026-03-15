'use client';

import React from 'react';
import { BusinessProfile, BusinessContact } from '@/data/mockData';
import { MapPin } from 'lucide-react';
import Image from 'next/image';
import { useTemplate } from '@/components/TemplateProvider';
import { useSite } from '@/lib/site-context';
import Link from 'next/link';

interface HeaderProps {
    profile: BusinessProfile;
    contact?: BusinessContact;
    showAddress?: boolean;
}

export const ModernProfileHeader: React.FC<HeaderProps> = ({ profile, contact, showAddress }) => {
    const { theme } = useTemplate();
    const { siteId } = useSite();


    return (
        <div className="flex flex-col mb-10 relative z-10 transition-all duration-300 items-center md:items-start text-center md:text-left">
            <Link href={`/${siteId}`} className="relative mb-6 flex flex-col md:flex-row items-center gap-4 md:gap-6 hover:opacity-80 transition-opacity">
                <div
                    className="w-32 h-32 bg-white rounded-full overflow-hidden relative z-10 shrink-0 flex items-center justify-center border-[4px]"
                    style={{ borderColor: theme.colors.border }}
                >
                    {profile.avatarUrl ? (
                        <Image
                            src={profile.avatarUrl}
                            alt={profile.name}
                            fill
                            priority
                            sizes="(max-width: 768px) 100vw, 128px"
                            className="object-cover"
                        />
                    ) : (
                        <div className="text-gray-300">
                            <span className="text-4xl font-bold uppercase">{profile.name.charAt(0) || 'S'}</span>
                        </div>
                    )}
                </div>

                <div className="flex flex-col items-center md:items-start">
                    <h1
                        className="text-3xl md:text-4xl font-black mb-1 tracking-tight leading-none uppercase"
                        style={{ color: theme.colors.foreground }}
                    >
                        {profile.name}
                    </h1>
                    <div
                        className={`
                            inline-block px-3 py-1 rounded-full
                            ${theme.taglineStyle === 'gentle' ? 'bg-gray-100' : 'border-[2px] transform -rotate-1'}
                        `}
                        style={
                            theme.taglineStyle === 'contrast'
                                ? {
                                    borderColor: theme.colors.border,
                                    backgroundColor: theme.colors.foreground,
                                    color: theme.colors.background
                                }
                                : theme.taglineStyle === 'gentle'
                                    ? { color: '#666' }
                                    : { borderColor: theme.colors.border } // Fallback
                        }
                    >
                        <p className="font-bold text-xs tracking-wide uppercase">
                            {profile.tagline}
                        </p>
                    </div>
                </div>
            </Link>

            <div className="w-full px-0 md:px-0">
                <p className="text-theme-foreground font-bold text-lg leading-snug mx-auto">
                    {profile.description}
                </p>
            </div>

            {showAddress && contact?.address && (
                <div className="mt-4 flex items-center gap-2 text-theme-foreground/80 font-bold">
                    <MapPin size={18} strokeWidth={3} />
                    <span className="text-sm">{contact.address.split('\n')[0]}</span>
                </div>
            )}
        </div>
    );
};
