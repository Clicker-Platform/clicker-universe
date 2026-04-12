// Test fixtures — shared mock data for unit tests

export const mockSite = {
  siteId: 'test-site-id',
  tenantSlug: 'test-tenant',
  isSubdomain: false,
  isPending: false,
};

export const mockUser = {
  uid: 'test-user-uid',
  email: 'owner@test.com',
  role: 'owner' as const,
  isOwner: true,
};

export const mockModule = {
  id: 'byod_pos',
  name: 'Self Order POS',
  enabled: true,
};
