import React from 'react';
import { BusinessProfile } from '@/data/mockData';
import { MapPin, Globe, Mail } from 'lucide-react';
import Image from 'next/image';

interface HeaderProps {
    profile: BusinessProfile;
}

export const SimpleHeader: React.FC<HeaderProps> = ({ profile }) => {
    return (
        <div className="flex flex-col mb-8 relative z-10 p-6 bg-theme-surface rounded-lg border border-theme-border shadow-sm">
            <div className="flex items-center gap-5">
                <div className="w-20 h-20 bg-gray-100 rounded-full border-2 border-theme-border overflow-hidden shrink-0">
                    <Image
                        src={profile.avatarUrl}
                        alt={profile.name}
                        fill
                        priority
                        className="object-cover"
                    />
                </div>

                <div className="flex flex-col">
                    <h1 className="text-2xl font-bold text-theme-foreground tracking-tight leading-tight">
                        {profile.name}
                    </h1>
                    <p className="text-theme-foreground/70 font-medium text-sm mt-1">
                        {profile.tagline}
                    </p>
                </div>
            </div>

            <div className="mt-5 pt-5 border-t border-theme-border/50">
                <p className="text-theme-foreground/80 text-base leading-relaxed">
                    {profile.description}
                </p>

                <div className="mt-4 flex flex-wrap gap-4 text-theme-foreground/60 text-sm font-medium">
                    <div className="flex items-center gap-1.5">
                        <MapPin size={16} />
                        <span>Jakarta</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
