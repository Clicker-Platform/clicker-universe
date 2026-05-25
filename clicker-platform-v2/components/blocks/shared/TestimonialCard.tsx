import React from 'react';
import type { TestimonialItem } from '@/lib/canvas/blocks/testimonials/types';
import { StarRatingDisplay } from '@/components/ui/star-rating/StarRatingDisplay';

interface TestimonialCardProps {
    item: TestimonialItem;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

const SIZE_TO_CONTENT_CLASS: Record<'sm' | 'md' | 'lg', string> = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
};

const SIZE_TO_PHOTO_PX: Record<'sm' | 'md' | 'lg', number> = {
    sm: 32,
    md: 44,
    lg: 56,
};

export const TestimonialCard: React.FC<TestimonialCardProps> = ({
    item,
    size = 'md',
    className,
}) => {
    const photoPx = SIZE_TO_PHOTO_PX[size];
    const contentClass = SIZE_TO_CONTENT_CLASS[size];
    const hasPersonRow = Boolean(item.personPhoto || item.personName || item.personRole);
    const hasBrandRow = Boolean(item.brandName || item.brandLogo);

    return (
        <article
            className={`testimonial-card ${className ?? ''}`}
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                padding: 16,
                borderRadius: 12,
            }}
        >
            {hasPersonRow && (
                <header style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {item.personPhoto && (
                        <img
                            src={item.personPhoto}
                            alt={item.personName}
                            width={photoPx}
                            height={photoPx}
                            style={{
                                width: photoPx,
                                height: photoPx,
                                flexShrink: 0,
                                borderRadius: '50%',
                                objectFit: 'cover',
                                aspectRatio: '1 / 1',
                            }}
                        />
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 600 }}>{item.personName}</span>
                        {item.personRole && (
                            <span style={{ opacity: 0.7, fontSize: '0.9em' }}>{item.personRole}</span>
                        )}
                    </div>
                </header>
            )}

            <p className={contentClass} style={{ margin: 0, lineHeight: 1.5 }}>
                {item.content}
            </p>

            {item.rating !== undefined && (
                <div>
                    <StarRatingDisplay rating={item.rating} />
                </div>
            )}

            {hasBrandRow && (
                <footer style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: 0.85 }}>
                    {item.brandLogo && (
                        <img
                            src={item.brandLogo}
                            alt={item.brandName ?? 'Brand'}
                            width={80}
                            height={20}
                            style={{ objectFit: 'contain', maxWidth: '100%', width: 'auto' }}
                        />
                    )}
                    {item.brandName && (
                        <span style={{ fontSize: '0.9em', fontWeight: 500 }}>{item.brandName}</span>
                    )}
                </footer>
            )}
        </article>
    );
};

export default TestimonialCard;
