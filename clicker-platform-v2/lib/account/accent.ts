export type AccentPresetId = 'yellow' | 'green' | 'coral' | 'indigo';

export const ACCENT_PRESETS: Record<AccentPresetId, { accent: string; fg: string; soft: string }> = {
  yellow: { accent: '#FFD93D', fg: '#1a1a1a', soft: '#FFF7D6' },
  green: { accent: '#22C55E', fg: '#ffffff', soft: '#DCFCE7' },
  coral: { accent: '#FF6B5E', fg: '#ffffff', soft: '#FFE7E3' },
  indigo: { accent: '#6366F1', fg: '#ffffff', soft: '#EEF0FF' },
};

export const DEFAULT_ACCENT_PRESET: AccentPresetId = 'coral';

export function resolveAccentVars(preset: AccentPresetId | undefined): Record<string, string> {
  const p = ACCENT_PRESETS[preset ?? DEFAULT_ACCENT_PRESET];
  return {
    '--member-accent': p.accent,
    '--member-accent-fg': p.fg,
    '--member-accent-soft': p.soft,
  };
}
