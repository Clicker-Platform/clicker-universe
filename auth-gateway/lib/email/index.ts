export { sendEmail } from './sender';
export { getEmailContext } from './context';
export type {
  SendEmailInput,
  SendEmailResult,
  EmailContext,
  EmailLogDoc,
  EmailTag,
} from './types';
export { FormSubmission } from './templates/system/FormSubmission';
export { PasswordReset } from './templates/system/PasswordReset';
export { EmailVerification } from './templates/system/EmailVerification';
export { SystemAlert } from './templates/system/SystemAlert';
