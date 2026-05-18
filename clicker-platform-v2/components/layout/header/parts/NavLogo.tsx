'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTemplate } from '@/components/TemplateProvider';
import type { BusinessProfile } from '@/data/mockData';

interface NavLogoProps {
  profile: BusinessProfile;
  siteId?: string;
  isSubPage?: boolean;
  pageTitle?: string;
  forceMobile?: boolean;
}

export const NavLogo: React.FC<NavLogoProps> = ({
  profile,
  siteId,
  isSubPage = false,
  pageTitle,
  forceMobile = false,
}) => {
  const router = useRouter();
  const { theme } = useTemplate();

  return (
    <div className="flex items-center gap-3 md:gap-4 overflow-hidden max-w-[60%] md:max-w-none">
      {isSubPage ? (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            if (!forceMobile) router.back();
          }}
          className="w-10 h-10 flex-shrink-0 flex items-center justify-center hover:bg-white/10 rounded-full transition-colors -ml-2"
          style={{ color: theme.colors.foreground }}
        >
          <ArrowLeft size={24} />
        </button>
      ) : (
        <Link href={siteId ? `/${siteId}` : '/'} className="flex-shrink-0 hover:opacity-80 transition-opacity">
          <div
            className="rounded-full flex items-center justify-center w-10 h-10 overflow-hidden shadow-sm"
            style={{ backgroundColor: theme.colors.surface ?? theme.colors.background }}
          >
            {profile.avatarUrl ? (
              <Image
                src={profile.avatarUrl}
                alt={profile.name}
                width={40}
                height={40}
                className="object-cover"
                style={{ width: '100%', height: '100%' }}
              />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center font-bold text-sm"
                style={{ color: theme.colors.foreground }}
              >
                {profile.name?.charAt(0) || '?'}
              </div>
            )}
          </div>
        </Link>
      )}
      <h1
        className="font-bold tracking-[0.1em] md:tracking-[0.3em] uppercase text-sm md:text-lg whitespace-nowrap truncate"
        style={{ color: theme.colors.foreground }}
      >
        {isSubPage ? pageTitle : profile.name}
      </h1>
    </div>
  );
};
