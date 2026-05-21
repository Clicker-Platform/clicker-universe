import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StarRatingDisplay } from '../StarRatingDisplay';

describe('StarRatingDisplay', () => {
    it('renders 5 stars total with N filled when rating=N', () => {
        render(<StarRatingDisplay rating={3} />);
        const filled = screen.getAllByTestId('star-filled');
        const empty = screen.getAllByTestId('star-empty');
        expect(filled).toHaveLength(3);
        expect(empty).toHaveLength(2);
    });

    it('renders 5 filled when rating=5', () => {
        render(<StarRatingDisplay rating={5} />);
        expect(screen.getAllByTestId('star-filled')).toHaveLength(5);
        expect(screen.queryAllByTestId('star-empty')).toHaveLength(0);
    });

    it('renders 1 filled when rating=1', () => {
        render(<StarRatingDisplay rating={1} />);
        expect(screen.getAllByTestId('star-filled')).toHaveLength(1);
        expect(screen.getAllByTestId('star-empty')).toHaveLength(4);
    });

    it('exposes accessible label with rating', () => {
        render(<StarRatingDisplay rating={4} />);
        expect(screen.getByLabelText(/4 out of 5/i)).toBeInTheDocument();
    });
});
