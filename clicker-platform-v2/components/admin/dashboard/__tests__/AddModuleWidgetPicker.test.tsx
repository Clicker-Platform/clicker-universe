import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AddModuleWidgetPicker } from '../AddModuleWidgetPicker';
import type { ModuleDefinition } from '@/lib/modules/types';

const makeModule = (id: string, displayName: string): ModuleDefinition => ({
  id,
  displayName,
  icon: 'cog',
  version: '1.0.0',
  enabled: true,
  adminDashboardWidget: { componentKey: `${id}:DashboardWidget` },
});

const candidates = [
  makeModule('membership', 'Membership & Loyalty'),
  makeModule('byod_pos', 'Self Order'),
  makeModule('promo', 'Promo'),
];

describe('AddModuleWidgetPicker', () => {
  it('pre-checks already-visible modules', () => {
    render(
      <AddModuleWidgetPicker
        open
        candidates={candidates}
        currentVisible={['membership']}
        onSave={() => {}}
        onClose={() => {}}
      />,
    );
    expect(screen.getByLabelText('Membership & Loyalty')).toBeChecked();
    expect(screen.getByLabelText('Self Order')).not.toBeChecked();
  });

  it('calls onSave with new ids, appending new picks to existing order', () => {
    const onSave = vi.fn();
    render(
      <AddModuleWidgetPicker
        open
        candidates={candidates}
        currentVisible={['membership']}
        onSave={onSave}
        onClose={() => {}}
      />,
    );
    fireEvent.click(screen.getByLabelText('Self Order'));
    fireEvent.click(screen.getByText('Save'));
    expect(onSave).toHaveBeenCalledWith(['membership', 'byod_pos']);
  });

  it('removes deselected ids on save', () => {
    const onSave = vi.fn();
    render(
      <AddModuleWidgetPicker
        open
        candidates={candidates}
        currentVisible={['membership', 'byod_pos']}
        onSave={onSave}
        onClose={() => {}}
      />,
    );
    fireEvent.click(screen.getByLabelText('Membership & Loyalty'));
    fireEvent.click(screen.getByText('Save'));
    expect(onSave).toHaveBeenCalledWith(['byod_pos']);
  });

  it('discards changes on cancel', () => {
    const onSave = vi.fn();
    const onClose = vi.fn();
    render(
      <AddModuleWidgetPicker
        open
        candidates={candidates}
        currentVisible={['membership']}
        onSave={onSave}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByLabelText('Self Order'));
    fireEvent.click(screen.getByText('Cancel'));
    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('returns null when open is false', () => {
    const { container } = render(
      <AddModuleWidgetPicker
        open={false}
        candidates={candidates}
        currentVisible={[]}
        onSave={() => {}}
        onClose={() => {}}
      />,
    );
    expect(container.firstChild).toBeNull();
  });
});
