'use client';

import React from 'react';

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
