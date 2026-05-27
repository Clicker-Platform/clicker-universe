import { Extension } from '@tiptap/core';
import { isSizeToken, type SizeTokenId } from '../tokens';

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        fontSize: {
            setFontSize: (token: SizeTokenId) => ReturnType;
            unsetFontSize: () => ReturnType;
        };
    }
}

export const FontSize = Extension.create({
    name: 'fontSize',

    addGlobalAttributes() {
        return [
            {
                types: ['paragraph'],
                attributes: {
                    fontSize: {
                        default: null as string | null,
                        parseHTML: el => {
                            const classes = (el.getAttribute('class') || '').split(/\s+/);
                            const c = classes.find(x => x.startsWith('rt-size-'));
                            return c ? c.replace('rt-size-', '') : null;
                        },
                        renderHTML: attrs => {
                            if (!attrs.fontSize) return {};
                            return { class: `rt-size-${attrs.fontSize}` };
                        },
                    },
                },
            },
        ];
    },

    addCommands() {
        return {
            setFontSize: (token) => ({ chain, state }) => {
                if (!isSizeToken(token)) return false;
                // Reject if selection touches anything other than paragraphs.
                const { from, to } = state.selection;
                let containsNonParagraph = false;
                state.doc.nodesBetween(from, to, (node) => {
                    if (node.isBlock && node.type.name !== 'paragraph') {
                        containsNonParagraph = true;
                        return false;
                    }
                });
                if (containsNonParagraph) return false;
                return chain().updateAttributes('paragraph', { fontSize: token }).run();
            },
            unsetFontSize: () => ({ chain }) =>
                chain().updateAttributes('paragraph', { fontSize: null }).run(),
        };
    },
});
