import type { ReactNode } from 'react';
import { EmailContextProvider } from '../email-context-provider';
import type { EmailContext } from '../types';

export const PREVIEW_CONTEXT: EmailContext = {
  fromName: 'Acme Coffee',
  fromAddress: 'noreply@clicker.id',
  replyTo: 'owner@acme.com',
  brand: {
    businessName: 'Acme Coffee',
    logoUrl: null,
    primaryColor: '#ff6600',
    siteUrl: 'https://acme.clicker.id',
  },
};

export function PreviewWrap({ children }: { children: ReactNode }) {
  return <EmailContextProvider context={PREVIEW_CONTEXT}>{children}</EmailContextProvider>;
}
