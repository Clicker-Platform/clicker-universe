'use client';

import React from 'react';
import { BusinessProfile, BusinessContact } from '@/data/mockData';
import { MapPin, Star } from 'lucide-react';
import Image from 'next/image';
import { useTemplate } from '@/components/TemplateProvider';

interface HeaderProps {
    profile: BusinessProfile;
    contact?: BusinessContact;
    showAddress?: boolean;
}

export const ClassicProfileHeader: React.FC<HeaderProps> = ({ profile, contact, showAddress }) => {
    const { theme } = useTemplate();

    return (
        <div className="flex flex-col mb-10 relative z-10 transition-all duration-300 items-center text-center">
            <div className="relative mb-6">
                <div
                    className="w-32 h-32 bg-white rounded-full overflow-hidden relative z-10 shrink-0 flex items-center justify-center mx-auto border-[4px]"
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

                <div className="absolute -right-4 -top-2 bg-theme-surface border-[3px] border-theme-border rounded-full p-2 rotate-12 z-20 shadow-sticker left-24 top-0 right-auto">
                    <Star size={20} className="fill-theme-primary text-theme-foreground" />
                </div>
            </div>

            <h1 className="text-4xl font-black text-theme-foreground mb-2 tracking-tight leading-none uppercase">
                {profile.name}
            </h1>

            <div className="inline-block bg-theme-foreground text-theme-primary px-4 py-1 rounded-full border-[2px] border-theme-foreground mb-5 transform -rotate-1 shadow-[4px_4px_0px_0px_var(--theme-border)] hover:shadow-[2px_2px_0px_0px_var(--theme-border)] transition-shadow">
                <p className="font-bold text-sm tracking-wide uppercase">{profile.tagline}</p>
            </div>

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
