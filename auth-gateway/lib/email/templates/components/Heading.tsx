import { Heading as REHeading } from '@react-email/components';
import type { ReactNode } from 'react';

export function Heading({ children }: { children: ReactNode }) {
  return (
    <REHeading
      as="h2"
      style={{ margin: 0, color: '#f8fafc', fontSize: '18px', fontWeight: 600 }}
    >
      {children}
    </REHeading>
  );
}
