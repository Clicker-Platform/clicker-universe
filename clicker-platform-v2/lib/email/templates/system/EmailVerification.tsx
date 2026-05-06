import { Text } from '@react-email/components';
import { EmailLayout } from '../EmailLayout';
import { Heading } from '../components/Heading';
import { Button } from '../components/Button';
import type { EmailContext } from '../../types';

type Props = {
  context: EmailContext;
  verifyUrl: string;
};

export function EmailVerification({ context, verifyUrl }: Props) {
  return (
    <EmailLayout context={context} preview="Verify your email address">
      <Heading>Verify your email</Heading>
      <Text style={{ margin: '12px 0 20px', color: '#374151', fontSize: '14px', lineHeight: 1.6 }}>
        Please confirm your email address to activate your account.
      </Text>
      <Button href={verifyUrl} primaryColor={context.brand.primaryColor}>
        Verify email
      </Button>
    </EmailLayout>
  );
}
