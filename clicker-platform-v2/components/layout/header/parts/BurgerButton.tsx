'use client';

import React from 'react';
import { Menu, X } from 'lucide-react';
import { useTemplate } from '@/components/TemplateProvider';

interface BurgerButtonProps {
  isOpen: boolean;
  onClick: () => void;
}

export const BurgerButton: React.FC<BurgerButtonProps> = ({ isOpen, onClick }) => {
  const { theme } = useTemplate();
  const textMuted = `${theme.colors.foreground}99`;
  const borderColor = theme.colors.border ?? `${theme.colors.foreground}26`;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        onClick();
      }}
      className="p-2 rounded-xl border transition-all"
      style={{
        backgroundColor: theme.colors.surface ?? theme.colors.background,
        borderColor,
        color: textMuted,
      }}
      aria-label="Toggle menu"
      aria-expanded={isOpen}
    >
      {isOpen ? (
        <X className="w-6 h-6" style={{ color: theme.colors.foreground }} />
      ) : (
        <Menu className="w-6 h-6" />
      )}
    </button>
  );
};
