import { Mark, mergeAttributes } from '@tiptap/core';
import { isColorToken, type ColorTokenId } from '../tokens';

export interface TokenColorOptions {
    HTMLAttributes: Record<string, unknown>;
}

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        tokenColor: {
            setTokenColor: (token: ColorTokenId) => ReturnType;
            setCustomColor: (hex: string) => ReturnType;
            unsetTokenColor: () => ReturnType;
        };
    }
}

export const TokenColor = Mark.create<TokenColorOptions>({
    name: 'tokenColor',

    addOptions() {
        return { HTMLAttributes: {} };
    },

    addAttributes() {
        return {
            token: {
                default: null as string | null,
                parseHTML: el => {
                    const classes = (el.getAttribute('class') || '').split(/\s+/);
                    const tokenClass = classes.find(c => c.startsWith('rt-color-') && c !== 'rt-color-custom');
                    return tokenClass ? tokenClass.replace('rt-color-', '') : null;
                },
                renderHTML: attrs => {
                    if (!attrs.token || !isColorToken(attrs.token)) return {};
                    return { class: `rt-color-${attrs.token}` };
                },
            },
            hex: {
                default: null as string | null,
                parseHTML: el => {
                    if (!(el.getAttribute('class') || '').includes('rt-color-custom')) return null;
                    const style = el.getAttribute('style') || '';
                    const match = style.match(/color:\s*(#[0-9a-fA-F]{3,8})/);
                    return match ? match[1] : null;
                },
                renderHTML: attrs => {
                    if (!attrs.hex) return {};
                    return { class: 'rt-color-custom', style: `color: ${attrs.hex}` };
                },
            },
        };
    },

    parseHTML() {
        return [
            { tag: 'span[class*="rt-color-"]' },
        ];
    },

    renderHTML({ HTMLAttributes }) {
        return ['span', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0];
    },

    addCommands() {
        return {
            setTokenColor: (token) => ({ commands }) => {
                if (!isColorToken(token)) return false;
                return commands.setMark(this.name, { token, hex: null });
            },
            setCustomColor: (hex) => ({ commands }) => {
                if (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(hex)) return false;
                return commands.setMark(this.name, { token: null, hex });
            },
            unsetTokenColor: () => ({ commands }) => commands.unsetMark(this.name),
        };
    },
});
