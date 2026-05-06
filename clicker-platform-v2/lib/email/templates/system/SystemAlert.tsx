import { Text } from '@react-email/components';
import { EmailLayout } from '../EmailLayout';
import { Heading } from '../components/Heading';
import type { EmailContext } from '../../types';

type Props = {
  context: EmailContext;
  title: string;
  body: string;
};

export function SystemAlert({ context, title, body }: Props) {
  return (
    <EmailLayout context={context} preview={title}>
      <Heading>{title}</Heading>
      <Text style={{ margin: '12px 0 0', color: '#374151', fontSize: '14px', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
        {body}
      </Text>
    </EmailLayout>
  );
}
