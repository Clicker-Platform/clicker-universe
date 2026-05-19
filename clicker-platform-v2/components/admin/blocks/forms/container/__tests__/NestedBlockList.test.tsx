// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NestedBlockList } from '../NestedBlockList';
import type { PageBlock } from '@/data/mockData';

vi.mock('@/lib/modules/registry', () => ({
  subscribeToEnabledModules: (cb: any) => { cb([]); return () => {}; },
}));

const block = (id: string): PageBlock => ({
  id,
  type: 'button',
  data: { label: `Btn ${id}` },
});

describe('NestedBlockList', () => {
  it('renders each block with its label', () => {
    render(
      <NestedBlockList
        blocksList={[block('a'), block('b')]}
        onBlocksChange={() => {}}
        onBlockClick={() => {}}
      />
    );
    expect(screen.getAllByText('Button').length).toBe(2);
  });

  it('calls onBlockClick with block id when edit chevron clicked', () => {
    const onBlockClick = vi.fn();
    render(
      <NestedBlockList
        blocksList={[block('a')]}
        onBlocksChange={() => {}}
        onBlockClick={onBlockClick}
      />
    );
    fireEvent.click(screen.getByLabelText('Edit block a'));
    expect(onBlockClick).toHaveBeenCalledWith('a');
  });

  it('removes a block when delete button is clicked', () => {
    const onChange = vi.fn();
    render(
      <NestedBlockList
        blocksList={[block('a'), block('b')]}
        onBlocksChange={onChange}
        onBlockClick={() => {}}
      />
    );
    fireEvent.click(screen.getByLabelText('Delete block a'));
    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'b' }),
    ]);
  });
});
