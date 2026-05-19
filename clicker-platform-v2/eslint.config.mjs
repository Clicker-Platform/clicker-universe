import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// ─── Typography system enforcement ────────────────────────────────────────────
//
// Scoped to public block components. Forbids the patterns the typography
// migration eliminated:
//   1. Hardcoded Tailwind text colors (must route through cardStyles helpers).
//   2. Inline fontFamily from theme.fonts.* (must rely on global CSS).
//
// Spec: superpowers/specs/2026-05-16-block-typography-system.md §3, §4, §11.
// Skill: .claude/commands/typography_system/SKILL.md.

const TAILWIND_COLOR_PALETTES =
    'slate|gray|neutral|zinc|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose';

// Matches `text-<palette>-<NN>` or `text-<palette>-<NN>/<NN>` and `text-white`/`text-black` (with optional /opacity)
const HARDCODED_TEXT_COLOR_REGEX =
    `text-(${TAILWIND_COLOR_PALETTES})-[0-9]+(/[0-9]+)?|text-(white|black)(/[0-9]+)?`;

const typographyEnforcement = {
    files: [
        "components/blocks/public/**/*.{ts,tsx}",
        "components/blocks/mrb/**/*.{ts,tsx}",
    ],
    // The shared helpers / config files legitimately define the strings we
    // otherwise forbid (they ARE the source of truth). Excluding them keeps
    // the rule meaningful without false positives.
    ignores: [
        "components/blocks/public/cardStyles.ts",
        "components/blocks/public/proseConfig.ts",
        "components/blocks/public/typography.ts",
    ],
    rules: {
        "no-restricted-syntax": [
            "error",
            {
                // String literals containing hardcoded Tailwind text-color classes.
                // Examples blocked: "text-slate-400", "text-white/60", "text-red-500".
                // Allowed: "text-[var(--theme-...)]", "text-theme-foreground".
                selector: `Literal[value=/(^|\\s)(${HARDCODED_TEXT_COLOR_REGEX})(\\s|$)/]`,
                message:
                    "Hardcoded Tailwind text color. Use color helpers from cardStyles.ts (getHeadingColor / getBodyColor / getMutedColor / getLabelColor / getAccentColor) or theme CSS vars (var(--theme-foreground), var(--theme-primary)). See typography_system skill.",
            },
            {
                // Template literal quasis (e.g. `text-sm ${x} text-slate-400`).
                selector: `TemplateElement[value.raw=/(^|\\s)(${HARDCODED_TEXT_COLOR_REGEX})(\\s|$)/]`,
                message:
                    "Hardcoded Tailwind text color in template literal. Use color helpers from cardStyles.ts or theme CSS vars. See typography_system skill.",
            },
            {
                // Inline style: { fontFamily: theme.fonts.heading } or fonts.body
                // The global CSS in app/globals.css already maps h1-h6 and body
                // to --font-heading / --font-body inside [data-template].
                selector:
                    "Property[key.name='fontFamily'][value.type='MemberExpression'][value.object.property.name='fonts']",
                message:
                    "Inline fontFamily from theme.fonts.* is forbidden. Global CSS maps h1-h6 and body to --font-heading / --font-body inside [data-template]. Remove the inline style. See typography_system skill.",
            },
            {
                // Same, but for destructured `fonts` (e.g. const fonts = theme.fonts; fontFamily: fonts.heading)
                selector:
                    "Property[key.name='fontFamily'][value.type='MemberExpression'][value.object.name='fonts']",
                message:
                    "Inline fontFamily from theme.fonts.* is forbidden. Global CSS maps h1-h6 and body to --font-heading / --font-body inside [data-template]. See typography_system skill.",
            },
        ],
    },
};

const eslintConfig = defineConfig([
    ...nextVitals,
    ...nextTs,
    typographyEnforcement,
    // Override default ignores of eslint-config-next.
    globalIgnores([
        // Default ignores of eslint-config-next:
        ".next/**",
        "out/**",
        "build/**",
        "next-env.d.ts",
    ]),
]);

export default eslintConfig;
