'use client';

import React from 'react';
import { cn } from '@/lib/utils'; // Assuming standard shadcn utils exist, or I will use template literal

interface ResponsiveContainerProps {
    children: React.ReactNode;
    className?: string;
}

/**
 * ResponsiveContainer
 * Enforces the max-width defined by the current template's `containerWidth`
 * using the CSS variable `--layout-max-width` injected by TemplateProvider.
 */
export const ResponsiveContainer: React.FC<ResponsiveContainerProps> = ({ children, className }) => {
    return (
        <div
            className={`w-full mx-auto px-4 md:px-6 transition-all duration-300 ${className || ''}`}
            style={{ maxWidth: 'var(--layout-max-width, 480px)' }}
        >
            {children}
        </div>
    );
};
