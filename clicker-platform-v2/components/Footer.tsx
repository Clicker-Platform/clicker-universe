'use client';

import React from 'react';
import { SocialLinkItem, BusinessContact } from '@/data/mockData';
import {
    Instagram,
    Facebook,
    Twitter,
    Linkedin,
    Globe,
    Video, // As Tiktok replacement
    MapPin,
    Mail,
    MessageCircle
} from 'lucide-react';
import { useTemplate } from '@/components/TemplateProvider';

interface FooterProps {
    socialLinks: SocialLinkItem[];
    footerText?: string;
    contact?: BusinessContact;
    hideContact?: boolean;
}

const ICON_MAP: Record<string, any> = {
    'Instagram': Instagram,
    'Facebook': Facebook,
    'Twitter': Twitter,
    'X': Twitter,
    'Linkedin': Linkedin,
    'Tiktok': Video,
    'Custom': Globe
};

export const Footer: React.FC<FooterProps> = ({ socialLinks, footerText, contact, hideContact }) => {
    const { templateId, theme } = useTemplate();
    const isClean = theme.cardStyle === 'clean';
    const isGlass = theme.cardStyle === 'glass';

    return (
        <footer className="flex flex-col items-center gap-6 pb-8 text-center">
            <div className="flex gap-4">
                {socialLinks && socialLinks.map((social, index) => {
                    const Icon = ICON_MAP[social.platform] || Globe;
                    return (
                        <a
                            key={`${social.platform}-${index}`}
                            href={social.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`
                                p-3 rounded-full transition-all duration-200
                                ${isClean
                                    ? 'bg-white border border-gray-200 text-gray-600 hover:shadow-md'
                                    : isGlass
                                    ? 'bg-black/20 border border-white/20 text-white hover:bg-white/10 hover:shadow-md'
                                    : 'bg-white border-[3px] border-brand-dark text-brand-dark hover:bg-brand-dark hover:text-brand-green shadow-sticker hover:shadow-none hover:translate-y-[2px] hover:translate-x-[2px]'
                                }
                            `}
                        >
                            <Icon size={24} strokeWidth={isClean || isGlass ? 2 : 2.5} />
                        </a>
                    );
                })}
            </div>

            {contact && !hideContact && (
                <div className={`space-y-2 font-medium text-sm ${isGlass ? 'text-white/80' : 'text-gray-800'}`} style={!isClean && !isGlass ? { color: theme.colors.foreground } : {}}>
                    {contact.address && (
                        <div className="flex items-center justify-center gap-2">
                            <MapPin size={16} />
                            {contact.mapUrl ? (
                                <a href={contact.mapUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
                                    {contact.address.split('\n')[0]}
                                </a>
                            ) : (
                                <span>{contact.address.split('\n')[0]}</span>
                            )}
                        </div>
                    )}
                    {contact.email && (
                        <div className="flex items-center justify-center gap-2">
                            <Mail size={16} />
                            <a href={`mailto:${contact.email}`} className="hover:underline">{contact.email}</a>
                        </div>
                    )}
                    {contact.whatsapp && (
                        <div className="flex items-center justify-center gap-2">
                            <MessageCircle size={16} />
                            <a href={`https://wa.me/${contact.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="hover:underline">
                                {contact.whatsapp}
                            </a>
                        </div>
                    )}
                </div>
            )}

            <p className={`font-normal text-sm ${isGlass ? 'text-white/40' : 'opacity-60'}`} style={!isGlass ? { color: theme.colors.foreground } : {}}>
                {footerText || '© 2024 SunnySide'}
            </p>
        </footer>
    );
};
