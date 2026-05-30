import { Extension } from '@tiptap/core';
import { isLineHeightToken, type LineHeightTokenId } from '../tokens';

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        lineHeight: {
            setLineHeight: (token: LineHeightTokenId) => ReturnType;
            unsetLineHeight: () => ReturnType;
        };
    }
}

const NODE_TYPES = ['paragraph', 'heading', 'listItem'] as const;

export const LineHeight = Extension.create({
    name: 'lineHeight',

    addGlobalAttributes() {
        return [
            {
                types: [...NODE_TYPES],
                attributes: {
                    lineHeight: {
                        default: null as string | null,
                        parseHTML: el => {
                            const classes = (el.getAttribute('class') || '').split(/\s+/);
                            const c = classes.find(x => x.startsWith('rt-lh-'));
                            return c ? c.replace('rt-lh-', '') : null;
                        },
                        renderHTML: attrs => {
                            if (!attrs.lineHeight) return {};
                            return { class: `rt-lh-${attrs.lineHeight}` };
                        },
                    },
                },
            },
        ];
    },

    addCommands() {
        return {
            setLineHeight: (token) => ({ chain }) => {
                if (!isLineHeightToken(token)) return false;
                const c = chain();
                for (const type of NODE_TYPES) {
                    c.updateAttributes(type, { lineHeight: token });
                }
                return c.run();
            },
            unsetLineHeight: () => ({ chain }) => {
                const c = chain();
                for (const type of NODE_TYPES) {
                    c.updateAttributes(type, { lineHeight: null });
                }
                return c.run();
            },
        };
    },
});
