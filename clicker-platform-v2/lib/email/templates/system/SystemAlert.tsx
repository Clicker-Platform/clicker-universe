import { Text } from '@react-email/components';
import { PreviewWrap } from '../_preview-context';
import { EmailLayout } from '../EmailLayout';
import { Heading } from '../components/Heading';

type Props = {
  title: string;
  body: string;
};

export function SystemAlert({ title, body }: Props) {
  return (
    <EmailLayout preview={title}>
      <Heading>{title}</Heading>
      <Text style={{ margin: '12px 0 0', color: '#374151', fontSize: '14px', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
        {body}
      </Text>
    </EmailLayout>
  );
}

export default function SystemAlertPreview() {
  return (
    <PreviewWrap>
      <SystemAlert title="Scheduled maintenance" body="The platform will be undergoing maintenance on Sunday from 2am to 4am UTC." />
    </PreviewWrap>
  );
}
