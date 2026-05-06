import { Button as REButton } from '@react-email/components';
import type { ReactNode } from 'react';

type Props = {
  href: string;
  primaryColor?: string | null;
  children: ReactNode;
};

export function Button({ href, primaryColor, children }: Props) {
  const bg = primaryColor ?? '#0a0a0a';
  return (
    <REButton
      href={href}
      style={{
        backgroundColor: bg,
        color: '#ffffff',
        padding: '12px 24px',
        borderRadius: '8px',
        fontWeight: 600,
        textDecoration: 'none',
        display: 'inline-block',
      }}
    >
      {children}
    </REButton>
  );
}
