import React from 'react';
import { BusinessProfile } from '@/data/mockData';
import { MapPin } from 'lucide-react';
import Image from 'next/image';

interface HeaderProps {
    profile: BusinessProfile;
    contact?: any; // Using any or importing BusinessContact to avoid import issues if not already there
    showAddress?: boolean;
}

export const ClassicHeader: React.FC<HeaderProps> = ({ profile, contact, showAddress = false }) => {
    return (
        <div className="flex flex-col mb-10 relative z-10 transition-all duration-300 items-center text-center">
            <div className="relative mb-6">
                <div className="w-32 h-32 bg-white rounded-full border-[4px] border-theme-border overflow-hidden relative z-10 shrink-0 mx-auto">
                    <Image
                        src={profile.avatarUrl}
                        alt={profile.name}
                        fill
                        priority
                        sizes="128px"
                        className="object-cover"
                    />
                </div>
                {/* Decorative elements */}
            </div>

            <h1 className="text-4xl font-black text-theme-foreground mb-2 tracking-tight leading-none uppercase">
                {profile.name}
            </h1>

            <div className="inline-block bg-theme-foreground text-theme-background px-4 py-1 rounded-full border-[2px] border-theme-border mb-4 transform -rotate-1">
                <p className="font-bold text-sm tracking-wide uppercase">{profile.tagline}</p>
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
