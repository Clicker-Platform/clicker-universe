import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { TestimonialCard } from '../TestimonialCard';
import type { TestimonialItem } from '@/lib/canvas/blocks/testimonials/types';

const baseItem: TestimonialItem = {
    id: 't1',
    personName: 'Jane Doe',
    content: 'Great service!',
};

describe('TestimonialCard', () => {
    it('renders name and content', () => {
        render(<TestimonialCard item={baseItem} />);
        expect(screen.getByText('Jane Doe')).toBeInTheDocument();
        expect(screen.getByText('Great service!')).toBeInTheDocument();
    });

    it('renders role when present', () => {
        render(<TestimonialCard item={{ ...baseItem, personRole: 'Director' }} />);
        expect(screen.getByText('Director')).toBeInTheDocument();
    });

    it('hides star row when rating is undefined', () => {
        render(<TestimonialCard item={baseItem} />);
        expect(screen.queryByRole('img', { name: /out of 5/i })).not.toBeInTheDocument();
    });

    it('renders star row when rating is set', () => {
        render(<TestimonialCard item={{ ...baseItem, rating: 4 }} />);
        expect(screen.getByLabelText(/4 out of 5/i)).toBeInTheDocument();
    });

    it('renders brand row when brandName is set', () => {
        render(<TestimonialCard item={{ ...baseItem, brandName: 'Acme' }} />);
        expect(screen.getByText('Acme')).toBeInTheDocument();
    });

    it('renders both photo and brand logo when both present', () => {
        render(
            <TestimonialCard
                item={{
                    ...baseItem,
                    personPhoto: 'https://example.com/p.jpg',
                    brandName: 'Acme',
                    brandLogo: 'https://example.com/l.png',
                }}
            />
        );
        expect(screen.getByAltText(/Jane Doe/i)).toBeInTheDocument();
        expect(screen.getByAltText(/Acme/i)).toBeInTheDocument();
    });

    it('does not render photo container when personPhoto is empty', () => {
        render(<TestimonialCard item={baseItem} />);
        expect(screen.queryByAltText(/Jane Doe/i)).not.toBeInTheDocument();
    });
});
