import React from 'react';
import { Loader2 } from 'lucide-react';

interface SubmitButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    isLoading: boolean;
    label?: string; // Default label (e.g., "Save")
    loadingLabel?: string; // Label when loading (e.g., "Saving...")
}

export const SubmitButton: React.FC<SubmitButtonProps> = ({
    isLoading,
    label = 'Save',
    loadingLabel = 'Saving...',
    className = '',
    disabled,
    children,
    ...props
}) => {
    return (
        <button
            type="submit"
            disabled={isLoading || disabled}
            className={`
                relative flex items-center justify-center gap-2
                transition-all duration-200
                ${isLoading ? 'cursor-not-allowed opacity-90' : ''}
                ${className}
            `}
            aria-busy={isLoading}
            aria-disabled={isLoading || disabled}
            {...props}
        >
            {isLoading && (
                <Loader2 className="animate-spin" size={18} strokeWidth={2.5} />
            )}
            <span className={isLoading ? 'animate-pulse' : ''}>
                {isLoading ? loadingLabel : (children || label)}
            </span>
        </button>
    );
};
