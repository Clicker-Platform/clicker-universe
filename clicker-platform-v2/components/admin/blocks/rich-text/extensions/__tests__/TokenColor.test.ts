import { describe, it, expect } from 'vitest';
import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { TextStyle } from '@tiptap/extension-text-style';
import { TokenColor } from '../TokenColor';

function makeEditor() {
    return new Editor({
        extensions: [Document, Paragraph, Text, TextStyle, TokenColor],
        content: '<p>hello world</p>',
    });
}

describe('TokenColor extension', () => {
    it('sets a token color via setTokenColor command and renders rt-color-* class', () => {
        const editor = makeEditor();
        editor.commands.selectAll();
        editor.commands.setTokenColor('primary');
        expect(editor.getHTML()).toContain('class="rt-color-primary"');
    });

    it('sets a freeform hex via setCustomColor and writes data-color (canonical) + style (display)', () => {
        const editor = makeEditor();
        editor.commands.selectAll();
        editor.commands.setCustomColor('#a1b2c3');
        const html = editor.getHTML();
        expect(html).toContain('class="rt-color-custom"');
        expect(html).toContain('data-color="#a1b2c3"');
        // The browser CSSOM may rewrite the inline style to rgb() form on
        // innerHTML serialization; we only assert that *some* color style exists.
        expect(html).toMatch(/style="color:\s*(#a1b2c3|rgb\(161,\s*178,\s*195\));?"/i);
    });

    it('unsetColor removes class, data-color, and style', () => {
        const editor = makeEditor();
        editor.commands.selectAll();
        editor.commands.setTokenColor('primary');
        editor.commands.unsetTokenColor();
        const html = editor.getHTML();
        expect(html).not.toContain('rt-color-');
        expect(html).not.toContain('data-color');
    });

    it('round-trips custom hex losslessly through data-color', () => {
        const editor = makeEditor();
        editor.commands.selectAll();
        editor.commands.setCustomColor('#a1b2c3');
        const html = editor.getHTML();
        // Re-parse the serialized HTML and verify the hex survived.
        const editor2 = makeEditor();
        editor2.commands.setContent(html);
        const html2 = editor2.getHTML();
        expect(html2).toContain('data-color="#a1b2c3"');
    });

    it('round-trips token color through class', () => {
        const editor = makeEditor();
        editor.commands.selectAll();
        editor.commands.setTokenColor('accent');
        const html = editor.getHTML();
        const editor2 = makeEditor();
        editor2.commands.setContent(html);
        expect(editor2.getHTML()).toContain('class="rt-color-accent"');
    });

    it('rejects malformed hex', () => {
        const editor = makeEditor();
        editor.commands.selectAll();
        const ok = editor.commands.setCustomColor('not-a-hex');
        expect(ok).toBe(false);
        expect(editor.getHTML()).not.toContain('rt-color-custom');
    });
});
