import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LiveModeToggle } from '../LiveModeToggle';

describe('LiveModeToggle', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('does not call onTick when off', () => {
    const onTick = vi.fn();
    render(<LiveModeToggle onTick={onTick} intervalMs={30_000} paused={false} />);
    act(() => { vi.advanceTimersByTime(60_000); });
    expect(onTick).not.toHaveBeenCalled();
  });

  it('calls onTick at interval when on', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onTick = vi.fn();
    render(<LiveModeToggle onTick={onTick} intervalMs={30_000} paused={false} />);
    await user.click(screen.getByRole('switch', { name: /live mode/i }));
    act(() => { vi.advanceTimersByTime(90_000); });
    expect(onTick).toHaveBeenCalledTimes(3);
  });

  it('pauses ticks when paused prop is true', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onTick = vi.fn();
    const { rerender } = render(
      <LiveModeToggle onTick={onTick} intervalMs={30_000} paused={false} />
    );
    await user.click(screen.getByRole('switch', { name: /live mode/i }));
    rerender(<LiveModeToggle onTick={onTick} intervalMs={30_000} paused={true} />);
    act(() => { vi.advanceTimersByTime(60_000); });
    expect(onTick).not.toHaveBeenCalled();
  });
});
