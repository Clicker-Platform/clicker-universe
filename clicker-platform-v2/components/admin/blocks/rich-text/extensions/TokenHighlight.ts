import { Mark, mergeAttributes } from '@tiptap/core';
import { isHighlightToken, type HighlightTokenId } from '../tokens';

export interface TokenHighlightOptions {
    HTMLAttributes: Record<string, unknown>;
}

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        tokenHighlight: {
            setTokenHighlight: (token: HighlightTokenId) => ReturnType;
            setCustomHighlight: (hex: string) => ReturnType;
            unsetTokenHighlight: () => ReturnType;
        };
    }
}

const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

export const TokenHighlight = Mark.create<TokenHighlightOptions>({
    name: 'tokenHighlight',

    addOptions() {
        return { HTMLAttributes: {} };
    },

    addAttributes() {
        return {
            token: {
                default: null as string | null,
                parseHTML: el => {
                    const classes = (el.getAttribute('class') || '').split(/\s+/);
                    const tokenClass = classes.find(c => c.startsWith('rt-bg-') && c !== 'rt-bg-custom');
                    return tokenClass ? tokenClass.replace('rt-bg-', '') : null;
                },
                renderHTML: attrs => {
                    if (!attrs.token || !isHighlightToken(attrs.token)) return {};
                    return { class: `rt-bg-${attrs.token}` };
                },
            },
            hex: {
                default: null as string | null,
                // Read from data-bg-color (canonical, immune to CSSOM).
                // See TokenColor for the architectural rationale.
                parseHTML: el => {
                    if (!(el.getAttribute('class') || '').includes('rt-bg-custom')) return null;
                    const dataBg = el.getAttribute('data-bg-color') || '';
                    return HEX_RE.test(dataBg) ? dataBg : null;
                },
                // Write both data-bg-color (canonical) and style (display).
                renderHTML: attrs => {
                    if (!attrs.hex) return {};
                    return {
                        class: 'rt-bg-custom',
                        'data-bg-color': attrs.hex,
                        style: `background-color: ${attrs.hex}`,
                    };
                },
            },
        };
    },

    parseHTML() {
        return [{ tag: 'span[class*="rt-bg-"]' }];
    },

    renderHTML({ HTMLAttributes }) {
        return ['span', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0];
    },

    addCommands() {
        return {
            setTokenHighlight: (token) => ({ commands }) => {
                if (!isHighlightToken(token)) return false;
                return commands.setMark(this.name, { token, hex: null });
            },
            setCustomHighlight: (hex) => ({ commands }) => {
                if (!HEX_RE.test(hex)) return false;
                return commands.setMark(this.name, { token: null, hex });
            },
            unsetTokenHighlight: () => ({ commands }) => commands.unsetMark(this.name),
        };
    },
});
