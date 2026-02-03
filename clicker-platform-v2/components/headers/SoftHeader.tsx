import React from 'react';
import { BusinessProfile } from '@/data/mockData';
import { Leaf } from 'lucide-react';
import Image from 'next/image';

interface HeaderProps {
    profile: BusinessProfile;
}

export const SoftHeader: React.FC<HeaderProps> = ({ profile }) => {
    return (
        <div className="flex flex-col mb-10 relative z-10 items-center text-center">
            <div className="relative mb-6">
                <div className="absolute top-0 right-0 transform translate-x-4 -translate-y-4 text-theme-primary opacity-50">
                    <Leaf size={32} />
                </div>
                <div className="w-36 h-36 bg-white rounded-[2rem] border-[1px] border-theme-border overflow-hidden relative z-10 shadow-sm rotate-3 hover:rotate-0 transition-transform duration-500 ease-out">
                    <Image
                        src={profile.avatarUrl}
                        alt={profile.name}
                        fill
                        priority
                        className="object-cover"
                    />
                </div>
            </div>

            <h1 className="text-4xl font-serif text-theme-foreground mb-3 tracking-wide capitalize">
                {profile.name}
            </h1>

            <div className="h-px w-20 bg-theme-border mb-4 mx-auto"></div>

            <p className="text-theme-foreground/80 font-medium text-lg max-w-xs leading-relaxed italic">
                &ldquo;{profile.tagline}&rdquo;
            </p>

            <p className="text-theme-foreground/70 text-sm mt-4 max-w-sm">
                {profile.description}
            </p>
        </div>
    );
};
