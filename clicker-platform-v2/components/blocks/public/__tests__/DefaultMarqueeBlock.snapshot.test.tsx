// components/blocks/public/__tests__/DefaultMarqueeBlock.snapshot.test.tsx
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { DefaultMarqueeBlock } from '../DefaultMarqueeBlock';
import { DEFAULT_MARQUEE_DATA } from '@/components/blocks/marquee/types';

describe('DefaultMarqueeBlock (pre/post refactor parity)', () => {
    it('matches snapshot for default data', () => {
        const { container } = render(<DefaultMarqueeBlock data={DEFAULT_MARQUEE_DATA} />);
        expect(container.innerHTML).toMatchSnapshot();
    });

    it('matches snapshot when empty', () => {
        const data = { ...DEFAULT_MARQUEE_DATA, items: [] };
        const { container } = render(<DefaultMarqueeBlock data={data} />);
        expect(container.innerHTML).toMatchSnapshot();
    });
});
