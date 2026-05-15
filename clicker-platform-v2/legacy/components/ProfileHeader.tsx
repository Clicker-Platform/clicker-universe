import React from 'react';
import Image from 'next/image';
import { BusinessProfile } from '../types';
import { MapPin, Star } from 'lucide-react';

interface ProfileHeaderProps {
  profile: BusinessProfile;
}

export const ProfileHeader: React.FC<ProfileHeaderProps> = ({ profile }) => {
  return (
    <div className="flex flex-col items-center text-center mb-10 relative z-10">
      <div className="relative mb-6">
        <div className="w-32 h-32 bg-white rounded-full border-[4px] border-brand-dark overflow-hidden relative z-10">
            <Image
                src={profile.avatarUrl}
                alt={profile.name}
                fill
                className="object-cover"
                unoptimized
            />
        </div>
        {/* Decorative elements behind avatar */}
        <div className="absolute -right-4 -top-2 bg-brand-white border-[3px] border-brand-dark rounded-full p-2 rotate-12 z-20 shadow-sticker">
            <Star size={20} className="fill-brand-green text-brand-dark" />
        </div>
      </div>

      <h1 className="text-4xl font-black text-brand-dark mb-2 tracking-tight leading-none uppercase">
        {profile.name}
      </h1>
      
      <div className="inline-block bg-brand-dark text-brand-green px-4 py-1 rounded-full border-[2px] border-brand-dark mb-4 transform -rotate-1">
        <p className="font-bold text-sm tracking-wide uppercase">{profile.tagline}</p>
      </div>

      <p className="text-brand-dark font-bold text-lg max-w-xs leading-snug">
        {profile.description}
      </p>

      <div className="mt-4 flex items-center gap-2 text-brand-dark/80 font-bold">
        <MapPin size={18} strokeWidth={3} />
        <span className="text-sm">Jakarta, Indonesia</span>
      </div>
    </div>
  );
};