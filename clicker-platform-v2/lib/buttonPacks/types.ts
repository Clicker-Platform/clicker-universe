export type ButtonPackId = 'pill' | 'soft' | 'brutalist' | 'glass' | 'underlined';
export type ButtonTier = 'primary' | 'secondary' | 'tertiary';
export type ButtonSize = 'sm' | 'md' | 'lg';
export type TertiaryStyle = 'underline' | 'arrow' | 'plain';

export interface ButtonSizeSpec {
  padY: number;     // px
  padX: number;     // px
  fontSize: number; // px
}

export interface ButtonPack {
  id: ButtonPackId;
  displayName: string;
  radius: number;          // px
  borderWidth: number;     // px (secondary tier border)
  fontWeight: number;
  letterSpacing: string;   // e.g. '0em' | '0.08em'
  textTransform: 'none' | 'uppercase';
  sizes: Record<ButtonSize, ButtonSizeSpec>;
  tertiaryStyle: TertiaryStyle;
}

export interface ButtonColors {
  primaryFill: string;
  primaryText?: string;   // optional override; otherwise auto-contrast
  secondaryBorder: string;
  secondaryText: string;
  tertiaryText: string;
}

export const DEFAULT_BUTTON_PACK_ID: ButtonPackId = 'pill';

export const DEFAULT_BUTTON_COLORS: ButtonColors = {
  primaryFill: '#111111',
  secondaryBorder: '#111111',
  secondaryText: '#111111',
  tertiaryText: '#111111',
};
