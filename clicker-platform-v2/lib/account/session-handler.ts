import { ensureAccount, markAccountActive } from './server-api';

// Magic-link login = an account-holder arriving on their own. If no doc exists
// yet (register-first never finished, or buyer whose account was made at purchase),
// ensureAccount safely creates it; then flip status to active.
export async function applyAccountSession(input: { siteId: string; uid: string; email: string }): Promise<void> {
  await ensureAccount(input.siteId, input.uid, { email: input.email, createdVia: 'register' });
  await markAccountActive(input.siteId, input.uid);
}
