import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.mock is hoisted above module scope, so the factory cannot close over
// plain consts (they're in the TDZ at factory-eval time). Use vi.hoisted so the
// mock fns exist when the factory runs and remain referenceable in assertions.
const { ensureAccount, markAccountActive } = vi.hoisted(() => ({
  ensureAccount: vi.fn(),
  markAccountActive: vi.fn(),
}));

vi.mock('../server-api', () => ({ ensureAccount, markAccountActive, getAccount: vi.fn() }));

import { applyAccountSession } from '../session-handler';

beforeEach(() => { ensureAccount.mockReset(); markAccountActive.mockReset(); });

describe('applyAccountSession', () => {
  it('ensures account (register) then marks active', async () => {
    await applyAccountSession({ siteId: 's1', uid: 'u1', email: 'a@b.com' });
    expect(ensureAccount).toHaveBeenCalledWith('s1', 'u1', { email: 'a@b.com', createdVia: 'register' });
    expect(markAccountActive).toHaveBeenCalledWith('s1', 'u1');
  });
});
