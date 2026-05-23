import type { ButtonPackId, ButtonColors } from '@/lib/buttonPacks/types';
import { DEFAULT_BUTTON_COLORS } from '@/lib/buttonPacks/types';

export interface AppearanceStyles {
  fontPackId: string | null;
  buttonPackId: ButtonPackId | null;
  buttonColors: ButtonColors;
}

export const DEFAULT_APPEARANCE_STYLES: AppearanceStyles = {
  fontPackId: null,
  buttonPackId: null,
  buttonColors: { ...DEFAULT_BUTTON_COLORS },
};
