import { describe, it, expect } from 'vitest';
import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Heading from '@tiptap/extension-heading';
import Text from '@tiptap/extension-text';
import { FontSize } from '../FontSize';

function makeEditor(content = '<p>hello</p>') {
    return new Editor({
        extensions: [Document, Paragraph, Heading.configure({ levels: [1, 2] }), Text, FontSize],
        content,
    });
}

describe('FontSize extension', () => {
    it('sets size class on paragraph node', () => {
        const editor = makeEditor();
        editor.commands.selectAll();
        editor.commands.setFontSize('l');
        expect(editor.getHTML()).toContain('class="rt-size-l"');
    });

    it('rejects unknown size tokens', () => {
        const editor = makeEditor();
        editor.commands.selectAll();
        const ok = editor.commands.setFontSize('xxl' as any);
        expect(ok).toBe(false);
        expect(editor.getHTML()).not.toContain('rt-size-');
    });

    it('does NOT set size on a heading (paragraphs only)', () => {
        const editor = makeEditor('<h1>title</h1>');
        editor.commands.selectAll();
        editor.commands.setFontSize('l');
        expect(editor.getHTML()).not.toContain('rt-size-l');
    });

    it('unsetFontSize removes the class', () => {
        const editor = makeEditor();
        editor.commands.selectAll();
        editor.commands.setFontSize('xl');
        editor.commands.unsetFontSize();
        expect(editor.getHTML()).not.toContain('rt-size-');
    });

    it('preserves size through round-trip', () => {
        const editor = makeEditor();
        editor.commands.selectAll();
        editor.commands.setFontSize('s');
        const html = editor.getHTML();
        const editor2 = makeEditor();
        editor2.commands.setContent(html);
        expect(editor2.getHTML()).toContain('rt-size-s');
    });
});
