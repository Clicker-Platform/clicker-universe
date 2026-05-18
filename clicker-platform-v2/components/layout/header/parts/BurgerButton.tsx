'use client';

import React from 'react';
import { TextAlignEnd, X } from 'lucide-react';
import { useTemplate } from '@/components/TemplateProvider';

interface BurgerButtonProps {
  isOpen: boolean;
  onClick: () => void;
}

export const BurgerButton: React.FC<BurgerButtonProps> = ({ isOpen, onClick }) => {
  const { theme } = useTemplate();

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        onClick();
      }}
      className="p-2 transition-all"
      style={{ color: theme.colors.foreground }}
      aria-label="Toggle menu"
      aria-expanded={isOpen}
    >
      {isOpen ? <X className="w-6 h-6" /> : <TextAlignEnd className="w-6 h-6" />}
    </button>
  );
};
