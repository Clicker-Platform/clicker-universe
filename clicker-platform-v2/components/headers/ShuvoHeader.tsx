'use client';

import React from 'react';
import { BusinessProfile, BusinessContact } from '@/data/mockData';
import { MapPin, Star } from 'lucide-react';
import Image from 'next/image';
import { useTemplate } from '@/components/TemplateProvider';
import { useSite } from '@/lib/site-context';
import Link from 'next/link';

interface HeaderProps {
    profile: BusinessProfile;
    contact?: BusinessContact;
    showAddress?: boolean;
}

export const ShuvoHeader: React.FC<HeaderProps> = ({ profile, contact, showAddress }) => {
    useTemplate();
    const { siteId } = useSite();


    return (
        <div className="flex flex-col relative z-10 transition-all duration-300">
            {/* Top Row: 2-Column Layout (Logo | Name + Tagline) */}
            <Link href={`/${siteId}`} className="flex flex-row items-center gap-6 mb-6 hover:opacity-80 transition-opacity">
                {/* Left Column: Logo/Avatar */}
                <div className="relative shrink-0">
                    <div
                        className="w-24 h-24 bg-white rounded-full overflow-hidden relative z-10 shrink-0 flex items-center justify-center border-[3px]"
                        style={{ borderColor: 'var(--theme-border)' }}
                    >
                        {profile.avatarUrl ? (
                            <Image
                                src={profile.avatarUrl}
                                alt={profile.name}
                                fill
                                priority
                                sizes="96px"
                                className="object-cover"
                            />
                        ) : (
                            <div className="text-gray-300">
                                <span className="text-3xl font-bold uppercase">{profile.name.charAt(0) || 'S'}</span>
                            </div>
                        )}
                    </div>
                    {/* Decorative Element */}
                    <div className="absolute -right-2 -top-2 bg-theme-surface border-[2px] border-theme-border rounded-full p-1.5 rotate-12 z-20 shadow-sm">
                        <Star size={14} className="fill-theme-primary text-theme-foreground" />
                    </div>
                </div>

                {/* Right Column: Name and Tagline */}
                <div className="flex flex-col items-start min-w-0">
                    <h1 className="text-3xl font-black text-theme-foreground mb-2 tracking-tight leading-none uppercase text-left break-words w-full">
                        {profile.name}
                    </h1>

                    <div className="inline-block bg-theme-foreground text-theme-primary px-4 py-1 rounded-full border-[2px] border-theme-foreground shadow-[2px_2px_0px_0px_var(--theme-border)]">
                        <p className="font-bold text-xs tracking-wide uppercase whitespace-nowrap">{profile.tagline}</p>
                    </div>
                </div>
            </Link>

            {/* Description (Full Width Below) */}
            <div className="w-full px-0">
                <p className="text-theme-foreground font-bold text-lg leading-snug text-left">
                    {profile.description}
                </p>
            </div>

            {/* Address */}
            {showAddress && contact?.address && (
                <div className="mt-4 flex items-center gap-2 text-theme-foreground/80 font-bold">
                    <MapPin size={18} strokeWidth={3} />
                    <span className="text-sm text-left">{contact.address.split('\n')[0]}</span>
                </div>
            )}
        </div>
    );
};
