import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SiteStylesPanel } from '../SiteStylesPanel';

const setFontPackIdMock = vi.fn(async () => {});
const getAppearanceStylesMock = vi.fn(async () => ({ fontPackId: null as string | null }));

vi.mock('@/lib/appearance/api', () => ({
  setFontPackId: (...args: any[]) => setFontPackIdMock(...args),
  getAppearanceStyles: (...args: any[]) => getAppearanceStylesMock(...args),
}));

vi.mock('@/lib/site-context', () => ({
  useSite: () => ({ siteId: 'site-test' }),
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn() },
}));

describe('SiteStylesPanel', () => {
  beforeEach(() => {
    setFontPackIdMock.mockClear();
    getAppearanceStylesMock.mockClear();
    getAppearanceStylesMock.mockResolvedValue({ fontPackId: null });
    document.documentElement.style.removeProperty('--font-heading');
    document.documentElement.style.removeProperty('--font-body');
  });

  it('shows the Fonts entry on the index view', () => {
    render(<SiteStylesPanel />);
    expect(screen.getByText('Fonts')).toBeInTheDocument();
    expect(screen.getAllByText('Coming soon').length).toBe(3);
  });

  it('navigates into Fonts and renders pack cards', async () => {
    render(<SiteStylesPanel />);
    fireEvent.click(screen.getByText('Fonts'));
    // FontPackCard renders "{heading.family} / {body.family}" — not pack.name
    await waitFor(() => expect(screen.getByText('Inter / Inter Tight')).toBeInTheDocument());
    expect(screen.getByText('Outfit / DM Sans')).toBeInTheDocument();
  });

  it('selecting a pack writes Firestore and updates CSS vars', async () => {
    render(<SiteStylesPanel />);
    fireEvent.click(screen.getByText('Fonts'));
    // Wait for pack cards to appear (loading resolves)
    await waitFor(() => screen.getByText('Outfit / DM Sans'));
    // Click the FontPackCard button that contains the "Modern Geometric" family text
    fireEvent.click(screen.getByText('Outfit / DM Sans').closest('button')!);
    await waitFor(() => expect(setFontPackIdMock).toHaveBeenCalledWith('site-test', 'modern-geometric'));
    expect(document.documentElement.style.getPropertyValue('--font-heading')).toContain('--font-outfit');
    expect(document.documentElement.style.getPropertyValue('--font-body')).toContain('--font-dm-sans');
  });

  it('reset clears the pack', async () => {
    getAppearanceStylesMock.mockResolvedValue({ fontPackId: 'editorial-serif' });
    render(<SiteStylesPanel />);
    fireEvent.click(screen.getByText('Fonts'));
    // FontsSection shows active pack name ("Editorial Serif") and a Reset button
    await waitFor(() => screen.getByText('Reset to template'));
    fireEvent.click(screen.getByText('Reset to template'));
    await waitFor(() => expect(setFontPackIdMock).toHaveBeenCalledWith('site-test', null));
    expect(document.documentElement.style.getPropertyValue('--font-heading')).toBe('');
  });
});
