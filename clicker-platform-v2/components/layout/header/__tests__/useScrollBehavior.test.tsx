import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useScrollBehavior } from '../useScrollBehavior';

describe('useScrollBehavior', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'scrollY', { value: 0, writable: true, configurable: true });
  });

  it('returns visible+unscrolled for behavior=none', () => {
    const { result } = renderHook(() => useScrollBehavior({ behavior: 'none' }));
    expect(result.current.visible).toBe(true);
    expect(result.current.scrolled).toBe(false);
    expect(result.current.shrunk).toBe(false);
  });

  it('returns visible+unscrolled for behavior=fixed at scrollY=0', () => {
    const { result } = renderHook(() => useScrollBehavior({ behavior: 'fixed' }));
    expect(result.current.visible).toBe(true);
    expect(result.current.scrolled).toBe(false);
  });

  it('sets scrolled=true when scrollY > 80', () => {
    const { result } = renderHook(() => useScrollBehavior({ behavior: 'fixed' }));
    act(() => {
      (window as any).scrollY = 100;
      window.dispatchEvent(new Event('scroll'));
    });
    expect(result.current.scrolled).toBe(true);
  });

  it('sets shrunk=true for shrink-on-scroll when scrollY > 80', () => {
    const { result } = renderHook(() => useScrollBehavior({ behavior: 'shrink-on-scroll' }));
    act(() => {
      (window as any).scrollY = 100;
      window.dispatchEvent(new Event('scroll'));
    });
    expect(result.current.shrunk).toBe(true);
  });

  it('hides header when scrolling down for sticky-on-scroll-up', () => {
    const { result } = renderHook(() => useScrollBehavior({ behavior: 'sticky-on-scroll-up' }));
    act(() => {
      (window as any).scrollY = 100;
      window.dispatchEvent(new Event('scroll'));
    });
    act(() => {
      (window as any).scrollY = 200;
      window.dispatchEvent(new Event('scroll'));
    });
    expect(result.current.visible).toBe(false);
  });

  it('shows header when scrolling up for sticky-on-scroll-up', () => {
    const { result } = renderHook(() => useScrollBehavior({ behavior: 'sticky-on-scroll-up' }));
    act(() => {
      (window as any).scrollY = 200;
      window.dispatchEvent(new Event('scroll'));
    });
    act(() => {
      (window as any).scrollY = 150;
      window.dispatchEvent(new Event('scroll'));
    });
    expect(result.current.visible).toBe(true);
  });

  it('short-circuits to static state when disabled', () => {
    const { result } = renderHook(() =>
      useScrollBehavior({ behavior: 'sticky-on-scroll-up', disabled: true })
    );
    act(() => {
      (window as any).scrollY = 500;
      window.dispatchEvent(new Event('scroll'));
    });
    expect(result.current.visible).toBe(true);
    expect(result.current.scrolled).toBe(false);
  });
});
