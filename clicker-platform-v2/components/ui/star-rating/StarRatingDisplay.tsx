import React from 'react';
import { Star } from 'lucide-react';

interface StarRatingDisplayProps {
    rating: 1 | 2 | 3 | 4 | 5;
    size?: number; // px, default 16
    className?: string;
}

export const StarRatingDisplay: React.FC<StarRatingDisplayProps> = ({
    rating,
    size = 16,
    className,
}) => {
    return (
        <div
            className={className}
            role="img"
            aria-label={`${rating} out of 5 stars`}
            style={{ display: 'inline-flex', gap: Math.max(2, Math.round(size * 0.125)) }}
        >
            {[1, 2, 3, 4, 5].map((n) => {
                const filled = n <= rating;
                return (
                    <Star
                        key={n}
                        size={size}
                        data-testid={filled ? 'star-filled' : 'star-empty'}
                        fill={filled ? 'currentColor' : 'none'}
                        stroke="currentColor"
                        aria-hidden="true"
                    />
                );
            })}
        </div>
    );
};
