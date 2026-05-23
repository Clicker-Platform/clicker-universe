import type { ButtonPack, ButtonPackId } from './types';
import { DEFAULT_BUTTON_PACK_ID } from './types';

export const BUTTON_PACKS: ReadonlyArray<ButtonPack> = Object.freeze([
  {
    id: 'pill',
    displayName: 'Pill',
    radius: 9999,
    borderWidth: 1.5,
    fontWeight: 600,
    letterSpacing: '0em',
    textTransform: 'none',
    tertiaryStyle: 'underline',
    sizes: {
      sm: { padY: 8,  padX: 16, fontSize: 12 },
      md: { padY: 11, padX: 22, fontSize: 13 },
      lg: { padY: 14, padX: 28, fontSize: 15 },
    },
  },
  {
    id: 'soft',
    displayName: 'Soft',
    radius: 6,
    borderWidth: 1.5,
    fontWeight: 600,
    letterSpacing: '0em',
    textTransform: 'none',
    tertiaryStyle: 'arrow',
    sizes: {
      sm: { padY: 8,  padX: 16, fontSize: 12 },
      md: { padY: 11, padX: 22, fontSize: 13 },
      lg: { padY: 14, padX: 28, fontSize: 15 },
    },
  },
  {
    id: 'brutalist',
    displayName: 'Brutalist',
    radius: 0,
    borderWidth: 3,
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    tertiaryStyle: 'underline',
    sizes: {
      sm: { padY: 9,  padX: 16, fontSize: 12 },
      md: { padY: 12, padX: 22, fontSize: 13 },
      lg: { padY: 15, padX: 28, fontSize: 15 },
    },
  },
  {
    id: 'glass',
    displayName: 'Glass',
    radius: 12,
    borderWidth: 1,
    fontWeight: 600,
    letterSpacing: '0em',
    textTransform: 'none',
    tertiaryStyle: 'arrow',
    sizes: {
      sm: { padY: 8,  padX: 16, fontSize: 12 },
      md: { padY: 11, padX: 22, fontSize: 13 },
      lg: { padY: 14, padX: 28, fontSize: 15 },
    },
  },
  {
    id: 'underlined',
    displayName: 'Underlined',
    radius: 0,
    borderWidth: 0,
    fontWeight: 600,
    letterSpacing: '0em',
    textTransform: 'none',
    tertiaryStyle: 'plain',
    sizes: {
      sm: { padY: 4,  padX: 0, fontSize: 12 },
      md: { padY: 6,  padX: 0, fontSize: 13 },
      lg: { padY: 8,  padX: 0, fontSize: 15 },
    },
  },
]);

export function getButtonPackById(id: ButtonPackId | string | null | undefined): ButtonPack | null {
  if (!id) return null;
  return BUTTON_PACKS.find(p => p.id === id) ?? null;
}

export function getDefaultButtonPack(): ButtonPack {
  const p = getButtonPackById(DEFAULT_BUTTON_PACK_ID);
  if (!p) throw new Error(`Default button pack '${DEFAULT_BUTTON_PACK_ID}' not in registry`);
  return p;
}
