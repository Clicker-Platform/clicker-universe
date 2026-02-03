import React from 'react';
import { BusinessProfile } from '@/data/mockData';
import { MapPin, ArrowUpRight } from 'lucide-react';
import Image from 'next/image';

interface HeaderProps {
    profile: BusinessProfile;
}

export const CenteredHeader: React.FC<HeaderProps> = ({ profile }) => {
    return (
        <div className="flex flex-col mb-12 relative z-10 items-center justify-center text-center">
            {/* Large Glowing Avatar */}
            <div className="relative mb-8 group">
                <div className="absolute inset-0 bg-gradient-to-tr from-theme-primary to-purple-500 rounded-full blur-xl opacity-75 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="w-40 h-40 bg-theme-background rounded-full border border-theme-border overflow-hidden relative z-10">
                    <Image
                        src={profile.avatarUrl}
                        alt={profile.name}
                        fill
                        priority
                        className="object-cover grayscale hover:grayscale-0 transition-all duration-500 scale-110"
                    />
                </div>
            </div>

            <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-theme-foreground via-theme-foreground to-theme-foreground/50 mb-4 tracking-tighter uppercase">
                {profile.name}
            </h1>

            <div className="inline-flex items-center gap-2 px-4 py-2 bg-theme-surface/50 backdrop-blur-md rounded-none border border-theme-border/20 mb-6">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <p className="font-mono text-xs tracking-widest uppercase text-theme-foreground">{profile.tagline}</p>
            </div>

            <p className="text-theme-foreground/80 font-light text-xl max-w-sm leading-relaxed mb-6">
                {profile.description}
            </p>

            <div className="flex items-center gap-4 text-theme-foreground/60 text-sm font-mono tracking-wider">
                <span className="flex items-center gap-2">
                    <MapPin size={14} /> Jakarta, ID
                </span>
            </div>
        </div>
    );
};
