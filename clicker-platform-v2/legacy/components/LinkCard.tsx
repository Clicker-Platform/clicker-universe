import React from 'react';
import { LinkItem } from '../types';
import { ExternalLink, ArrowRight } from 'lucide-react';

interface LinkCardProps {
  item: LinkItem;
}

export const LinkCard: React.FC<LinkCardProps> = ({ item }) => {
  const isHighlight = item.highlight;
  
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`
        group relative w-full flex items-center justify-between p-4 mb-4
        rounded-2xl border-[3px] border-brand-dark
        transition-all duration-200 ease-in-out
        hover:-translate-y-1 hover:shadow-sticker
        active:translate-y-0 active:shadow-none
        ${isHighlight ? 'bg-brand-dark text-brand-green' : 'bg-white text-brand-dark'}
      `}
    >
      <div className="flex items-center gap-4">
        {item.icon && (
          <div className={`
            p-2 rounded-xl border-[2px] 
            ${isHighlight ? 'bg-brand-green border-brand-green text-brand-dark' : 'bg-brand-green border-brand-dark text-brand-dark'}
          `}>
            <item.icon size={24} strokeWidth={2.5} />
          </div>
        )}
        <div className="text-left">
          <h3 className="font-extrabold text-lg leading-tight">{item.title}</h3>
          {item.subtitle && (
            <p className={`text-sm font-bold ${isHighlight ? 'text-brand-green/80' : 'text-brand-dark/60'}`}>
              {item.subtitle}
            </p>
          )}
        </div>
      </div>
      
      <div className={`
        transform transition-transform duration-200 
        group-hover:translate-x-1
      `}>
        {isHighlight ? <ArrowRight size={24} strokeWidth={3} /> : <ExternalLink size={24} strokeWidth={3} />}
      </div>
    </a>
  );
};