import type { AccentPresetId } from '../accent';

export interface MockMember {
  uid: string;
  email: string;
  fullName?: string;
  accentPreset?: AccentPresetId;
}

export interface MockSurfaceNavItem {
  id: string;
  label: string;
  href: string; // relative segment under /[tenant]/account/
}

export interface MockLibraryItem {
  id: string;
  title: string;
  kind: 'pdf' | 'youtube';
  cover?: string;
}
