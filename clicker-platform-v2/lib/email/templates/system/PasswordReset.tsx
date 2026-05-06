import { Text } from '@react-email/components';
import { EmailLayout } from '../EmailLayout';
import { Heading } from '../components/Heading';
import { Button } from '../components/Button';
import type { EmailContext } from '../../types';

type Props = {
  context: EmailContext;
  resetUrl: string;
};

export function PasswordReset({ context, resetUrl }: Props) {
  return (
    <EmailLayout context={context} preview="Reset your password">
      <Heading>Reset your password</Heading>
      <Text style={{ margin: '12px 0 20px', color: '#374151', fontSize: '14px', lineHeight: 1.6 }}>
        We received a request to reset the password for your account. Click the button below to choose a new one. If you didn&apos;t request this, you can safely ignore this email.
      </Text>
      <Button href={resetUrl} primaryColor={context.brand.primaryColor}>
        Reset password
      </Button>
      <Text style={{ margin: '20px 0 0', color: '#9ca3af', fontSize: '12px' }}>
        This link expires in 1 hour.
      </Text>
    </EmailLayout>
  );
}
