'use client';

import React from 'react';
import Link from 'next/link';
import type { ButtonTier, ButtonSize } from '@/lib/buttonPacks/types';
import './unified-button.css';

export interface UnifiedButtonProps {
  tier: ButtonTier;
  size?: ButtonSize;
  children: React.ReactNode;
  href?: string;
  onClick?: (e: React.MouseEvent) => void;
  fullWidth?: boolean;
  disabled?: boolean;
  external?: boolean;
  loading?: boolean;
  className?: string;
  type?: 'button' | 'submit';
  ariaLabel?: string;
}

function isExternalProtocol(href: string): boolean {
  return /^(https?:\/\/|mailto:|tel:)/i.test(href);
}
function isSafeHref(href: string): boolean {
  return /^(https?:\/\/|\/|#|mailto:|tel:)/i.test(href);
}

export function UnifiedButton({
  tier,
  size = 'md',
  children,
  href,
  onClick,
  fullWidth,
  disabled,
  external,
  loading,
  className,
  type = 'button',
  ariaLabel,
}: UnifiedButtonProps) {
  const label = loading ? 'Loading…' : children;
  const isDisabled = disabled || loading;
  const dataProps = {
    'data-tier': tier,
    'data-size': size,
    'data-fullwidth': fullWidth || undefined,
    'aria-disabled': isDisabled || undefined,
    'aria-label': ariaLabel,
    className: ['ub-root', className].filter(Boolean).join(' '),
  } as const;

  if (href && isSafeHref(href)) {
    const isExt = external ?? isExternalProtocol(href);
    if (isExt) {
      return (
        <a
          {...dataProps}
          href={isDisabled ? undefined : href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={isDisabled ? (e) => e.preventDefault() : onClick}
        >
          {label}
        </a>
      );
    }
    return (
      <Link
        {...dataProps}
        href={isDisabled ? '#' : href}
        onClick={isDisabled ? (e) => e.preventDefault() : onClick}
      >
        {label}
      </Link>
    );
  }

  // Render a <button> when there's an action OR when the consumer needs a submit button.
  if (onClick || type === 'submit') {
    return (
      <button {...dataProps} type={type} disabled={isDisabled} onClick={onClick}>
        {label}
      </button>
    );
  }

  // No action and no submit intent: span (used in preview mode).
  return <span {...dataProps}>{label}</span>;
}
