import { Text } from '@react-email/components';
import { PreviewWrap } from '../_preview-context';
import { EmailLayout } from '../EmailLayout';
import { Heading } from '../components/Heading';
import { DataTable } from '../components/DataTable';

type Props = {
  formTitle: string;
  data: Record<string, string>;
  fieldLabels?: Record<string, string>;
};

export function FormSubmission({ formTitle, data, fieldLabels }: Props) {
  const rows = Object.entries(data).map(([key, value]) => ({
    label: fieldLabels?.[key] ?? key,
    value,
  }));

  return (
    <EmailLayout preview={`New submission: ${formTitle}`}>
      <Heading>New Submission</Heading>
      <Text style={{ margin: '6px 0 16px', color: '#6b7280', fontSize: '13px' }}>
        {formTitle}
      </Text>
      <DataTable rows={rows} />
    </EmailLayout>
  );
}

export default function FormSubmissionPreview() {
  return (
    <PreviewWrap>
      <FormSubmission
        formTitle="Contact form"
        data={{ name: 'Jane Doe', email: 'jane@example.com', message: 'Hello there!' }}
        fieldLabels={{ name: 'Name', email: 'Email', message: 'Message' }}
      />
    </PreviewWrap>
  );
}
