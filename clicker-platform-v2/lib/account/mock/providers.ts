import type { MockMember, MockSurfaceNavItem, MockLibraryItem } from './types';

// 1a mock providers. Signatures mirror the real lib/account APIs that Plan 1b
// will supply. Wiring later = replace these bodies, components stay unchanged.

export function getMockMember(): MockMember {
  return { uid: 'mock-jane', email: 'jane@email.com', fullName: 'Jane', accentPreset: 'coral' };
}

export function getMockSurfaces(_member: MockMember): MockSurfaceNavItem[] {
  // To preview the empty-Home state during dev, return [] here temporarily.
  return [{ id: 'library', label: 'My Library', href: 'library', icon: 'library' }];
}

export function getMockLibrary(_member: MockMember): MockLibraryItem[] {
  return [
    { id: '1', title: 'Bebas Utang 90 Hari', kind: 'pdf' },
    { id: '2', title: 'Investasi Pemula', kind: 'youtube' },
    { id: '3', title: 'Budgeting 101', kind: 'pdf' },
  ];
}
