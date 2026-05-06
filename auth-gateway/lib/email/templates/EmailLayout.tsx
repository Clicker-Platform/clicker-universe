import {
  Html,
  Head,
  Preview,
  Body,
  Container,
  Section,
  Text,
  Img,
  Link,
} from '@react-email/components';
import type { ReactNode } from 'react';
import { useEmailContext } from '../email-context-provider';

type Props = {
  preview: string;
  children: ReactNode;
};

export function EmailLayout({ preview, children }: Props) {
  const context = useEmailContext();
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body
        style={{
          backgroundColor: '#f9fafb',
          fontFamily:
            "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif",
          margin: 0,
          padding: '24px 0',
        }}
      >
        <Container style={{ maxWidth: '520px', margin: '0 auto' }}>
          <Section
            style={{
              backgroundColor: '#0a0a0a',
              padding: '24px 28px',
              borderRadius: '12px 12px 0 0',
            }}
          >
            {context.brand.logoUrl ? (
              <Img
                src={context.brand.logoUrl}
                alt={context.brand.businessName}
                height="24"
                style={{ display: 'block' }}
              />
            ) : (
              <Text
                style={{ margin: 0, color: '#f8fafc', fontSize: '16px', fontWeight: 600 }}
              >
                {context.brand.businessName}
              </Text>
            )}
          </Section>
          <Section
            style={{
              backgroundColor: '#ffffff',
              padding: '28px',
              border: '1px solid #e5e7eb',
              borderTop: 'none',
              borderRadius: '0 0 12px 12px',
            }}
          >
            {children}
          </Section>
          <Text
            style={{
              margin: '20px 0 0',
              color: '#9ca3af',
              fontSize: '11px',
              textAlign: 'center',
            }}
          >
            Sent by{' '}
            <Link
              href={context.brand.siteUrl}
              style={{ color: '#9ca3af', textDecoration: 'underline' }}
            >
              {context.brand.businessName}
            </Link>{' '}
            via Clicker Platform
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
