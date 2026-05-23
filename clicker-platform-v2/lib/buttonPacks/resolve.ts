import { getButtonPackById, getDefaultButtonPack } from './packs';
import { DEFAULT_BUTTON_COLORS } from './types';
import type { ButtonPack, ButtonColors, ButtonPackId } from './types';
import { getTemplate } from '@/lib/templates/registry';

export interface AppearanceStylesForButtons {
  buttonPackId?: ButtonPackId | string | null;
  buttonColors?: Partial<ButtonColors> | Record<string, string> | null;
}

/**
 * Resolves the active ButtonPack using the priority chain:
 *   1. Site-level override (appearanceStyles.buttonPackId)
 *   2. Template default  (template.config.defaultButtonPackId — added in Task 13f)
 *   3. Registry default  (DEFAULT_BUTTON_PACK_ID = 'pill')
 */
export function resolveButtonPack(
  appearanceStyles: AppearanceStylesForButtons | null | undefined,
  templateId: string | null | undefined,
): ButtonPack {
  const sitePack = getButtonPackById(appearanceStyles?.buttonPackId ?? null);
  if (sitePack) return sitePack;

  if (templateId) {
    const template = getTemplate(templateId);
    // template.config.defaultButtonPackId is added in Task 13f; cast safely until then
    const fromTemplate = (template?.config as any)?.defaultButtonPackId ?? null;
    const templatePack = getButtonPackById(fromTemplate);
    if (templatePack) return templatePack;
  }

  return getDefaultButtonPack();
}

/**
 * Merges site button colors on top of the global defaults.
 */
export function resolveButtonColors(
  appearanceStyles: AppearanceStylesForButtons | null | undefined,
): ButtonColors {
  return { ...DEFAULT_BUTTON_COLORS, ...(appearanceStyles?.buttonColors ?? {}) };
}
