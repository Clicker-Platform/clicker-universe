import { describe, it, expect } from 'vitest';
import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { TextStyle } from '@tiptap/extension-text-style';
import { TokenHighlight } from '../TokenHighlight';

function makeEditor() {
    return new Editor({
        extensions: [Document, Paragraph, Text, TextStyle, TokenHighlight],
        content: '<p>hello world</p>',
    });
}

describe('TokenHighlight extension', () => {
    it('sets a token highlight and renders rt-bg-* class', () => {
        const editor = makeEditor();
        editor.commands.selectAll();
        editor.commands.setTokenHighlight('yellow');
        expect(editor.getHTML()).toContain('class="rt-bg-yellow"');
    });

    it('sets a freeform hex via setCustomHighlight and writes data-bg-color (canonical) + style (display)', () => {
        const editor = makeEditor();
        editor.commands.selectAll();
        editor.commands.setCustomHighlight('#fde047');
        const html = editor.getHTML();
        expect(html).toContain('class="rt-bg-custom"');
        expect(html).toContain('data-bg-color="#fde047"');
        // Browser CSSOM may rewrite the inline style to rgb() — accept either.
        expect(html).toMatch(/style="background-color:\s*(#fde047|rgb\(253,\s*224,\s*71\));?"/i);
    });

    it('unsetHighlight removes class, data-bg-color, and style', () => {
        const editor = makeEditor();
        editor.commands.selectAll();
        editor.commands.setTokenHighlight('yellow');
        editor.commands.unsetTokenHighlight();
        const html = editor.getHTML();
        expect(html).not.toContain('rt-bg-');
        expect(html).not.toContain('data-bg-color');
    });

    it('round-trips custom hex losslessly through data-bg-color', () => {
        const editor = makeEditor();
        editor.commands.selectAll();
        editor.commands.setCustomHighlight('#fde047');
        const html = editor.getHTML();
        const editor2 = makeEditor();
        editor2.commands.setContent(html);
        expect(editor2.getHTML()).toContain('data-bg-color="#fde047"');
    });

    it('rejects malformed hex', () => {
        const editor = makeEditor();
        editor.commands.selectAll();
        const ok = editor.commands.setCustomHighlight('not-a-hex');
        expect(ok).toBe(false);
        expect(editor.getHTML()).not.toContain('rt-bg-custom');
    });
});
