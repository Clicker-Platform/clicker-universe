import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StickerBadgeProps {
  icon: LucideIcon;
  rotation?: number;
  className?: string;
  color?: string;
}

export const StickerBadge: React.FC<StickerBadgeProps> = ({ 
  icon: Icon, 
  rotation = 0, 
  className = '',
  color = 'bg-white' 
}) => {
  return (
    <div 
      className={`absolute flex items-center justify-center p-3 rounded-full border-[3px] border-brand-dark shadow-sticker ${color} ${className}`}
      style={{ transform: `rotate(${rotation}deg)` }}
    >
      <Icon size={24} className="text-brand-dark stroke-[3px]" />
    </div>
  );
};