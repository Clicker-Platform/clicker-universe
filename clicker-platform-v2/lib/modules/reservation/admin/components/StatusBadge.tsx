import React from 'react';

// Centralize the logic for status labels and colors
export const getStatusLabel = (status: string) => {
    if (status === 'pending') return 'New Booking';
    return status;
};

interface StatusBadgeProps {
    status: string;
    size?: 'sm' | 'md' | 'lg';
}

export function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
    const label = getStatusLabel(status);

    let colorClass = 'bg-gray-100 text-gray-700';
    if (status === 'pending') colorClass = 'bg-orange-100 text-orange-800';
    else if (status === 'confirmed') colorClass = 'bg-green-100 text-green-700';
    else if (status === 'cancelled') colorClass = 'bg-red-100 text-red-700';
    else if (status === 'completed') colorClass = 'bg-blue-100 text-blue-700';

    const sizeClasses = {
        sm: "px-2 py-0.5 text-[10px]",
        md: "px-2.5 py-1 text-xs",
        lg: "px-3 py-1.5 text-sm tracking-wide"
    };

    return (
        <span className={`${sizeClasses[size]} rounded-full font-bold uppercase ${colorClass}`}>
            {label}
        </span>
    );
}
