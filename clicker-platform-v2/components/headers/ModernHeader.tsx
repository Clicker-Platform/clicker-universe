import React from 'react';
import { BusinessProfile } from '@/data/mockData';
import { MapPin, Star } from 'lucide-react';
import Image from 'next/image';

interface HeaderProps {
    profile: BusinessProfile;
    contact?: any;
    showAddress?: boolean;
}

export const ModernHeader: React.FC<HeaderProps> = ({ profile, contact, showAddress = false }) => {
    return (
        <div className="flex flex-col mb-10 relative z-10 transition-all duration-300 items-start text-left">
            <div className="relative mb-6 flex items-center gap-6">
                <div className="w-32 h-32 bg-theme-surface rounded-full border-[4px] border-theme-border overflow-hidden relative z-10 shrink-0">
                    <Image
                        src={profile.avatarUrl}
                        alt={profile.name}
                        fill
                        priority
                        sizes="128px"
                        className="object-cover"
                    />
                </div>

                {/* Decorative star */}
                <div className="absolute left-24 top-0 bg-theme-surface border-[3px] border-theme-border rounded-full p-2 rotate-12 z-20 shadow-sticker">
                    <Star size={20} className="fill-theme-primary text-theme-foreground" />
                </div>

                <div className="flex flex-col items-start">
                    <h1 className="text-4xl font-black text-theme-foreground mb-1 tracking-tight leading-none uppercase">
                        {profile.name}
                    </h1>
                    <div className="inline-block bg-theme-foreground text-theme-background px-3 py-1 rounded-full border-[2px] border-theme-border transform -rotate-1">
                        <p className="font-bold text-xs tracking-wide uppercase">{profile.tagline}</p>
                    </div>
                </div>
            </div>

            <p className="text-theme-foreground font-bold text-lg max-w-xs leading-snug">
                {profile.description}
            </p>

            {showAddress && contact?.address && (
                <div className="mt-4 flex items-center gap-2 text-theme-foreground/80 font-bold">
                    <MapPin size={18} strokeWidth={3} />
                    <span className="text-sm">{contact.address.split('\n')[0]}</span>
                </div>
            )}
        </div>
    );
};
