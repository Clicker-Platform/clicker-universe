import { describe, it, expect } from 'vitest';
import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import TextStyle from '@tiptap/extension-text-style';
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

    it('sets a freeform hex via setCustomColor and renders inline style', () => {
        const editor = makeEditor();
        editor.commands.selectAll();
        editor.commands.setCustomColor('#a1b2c3');
        const html = editor.getHTML();
        expect(html).toContain('class="rt-color-custom"');
        // JSDOM normalizes hex color in inline style to rgb(); accept either form.
        expect(html).toMatch(/style="color:\s*(#a1b2c3|rgb\(161,\s*178,\s*195\));?"/i);
    });

    it('unsetColor removes both class and style', () => {
        const editor = makeEditor();
        editor.commands.selectAll();
        editor.commands.setTokenColor('primary');
        editor.commands.unsetTokenColor();
        expect(editor.getHTML()).not.toContain('rt-color-');
    });

    it('round-trips through getHTML/setContent', () => {
        const editor = makeEditor();
        editor.commands.selectAll();
        editor.commands.setTokenColor('accent');
        const html = editor.getHTML();
        const editor2 = makeEditor();
        editor2.commands.setContent(html);
        expect(editor2.getHTML()).toContain('class="rt-color-accent"');
    });
});
