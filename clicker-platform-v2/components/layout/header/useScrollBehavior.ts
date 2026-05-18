'use client';

import { useEffect, useState, useRef } from 'react';
import type { HeaderScrollBehavior } from '@/data/mockData';

interface UseScrollBehaviorArgs {
  behavior: HeaderScrollBehavior;
  /** When true, the hook returns the static/unscrolled state and ignores window scroll. */
  disabled?: boolean;
  /** Pixel threshold past which `scrolled` and `shrunk` become true. Default 80. */
  threshold?: number;
}

interface ScrollState {
  visible: boolean;
  scrolled: boolean;
  shrunk: boolean;
}

const STATIC_STATE: ScrollState = { visible: true, scrolled: false, shrunk: false };

export function useScrollBehavior({
  behavior,
  disabled = false,
  threshold = 80,
}: UseScrollBehaviorArgs): ScrollState {
  const [state, setState] = useState<ScrollState>(STATIC_STATE);
  const lastScrollY = useRef(0);

  useEffect(() => {
    if (disabled || behavior === 'none') {
      setState(STATIC_STATE);
      return;
    }

    const handleScroll = () => {
      const y = window.scrollY;
      const last = lastScrollY.current;
      const scrolled = y > threshold;
      const shrunk = behavior === 'shrink-on-scroll' && scrolled;

      let visible = true;
      if (behavior === 'sticky-on-scroll-up') {
        if (y <= threshold) {
          visible = true;
        } else if (y > last) {
          visible = false;
        } else if (y < last) {
          visible = true;
        }
      }

      lastScrollY.current = y;
      setState({ visible, scrolled, shrunk });
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [behavior, disabled, threshold]);

  return state;
}
