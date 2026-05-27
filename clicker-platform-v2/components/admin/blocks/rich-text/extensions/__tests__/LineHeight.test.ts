import { describe, it, expect } from 'vitest';
import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Heading from '@tiptap/extension-heading';
import Text from '@tiptap/extension-text';
import BulletList from '@tiptap/extension-bullet-list';
import ListItem from '@tiptap/extension-list-item';
import { LineHeight } from '../LineHeight';

function makeEditor(content = '<p>hello</p>') {
    return new Editor({
        extensions: [Document, Paragraph, Heading.configure({ levels: [1, 2] }), Text, BulletList, ListItem, LineHeight],
        content,
    });
}

describe('LineHeight extension', () => {
    it('sets line-height class on a paragraph', () => {
        const editor = makeEditor();
        editor.commands.selectAll();
        editor.commands.setLineHeight('tight');
        expect(editor.getHTML()).toContain('class="rt-lh-tight"');
    });

    it('sets line-height class on a heading', () => {
        const editor = makeEditor('<h1>title</h1>');
        editor.commands.selectAll();
        editor.commands.setLineHeight('loose');
        expect(editor.getHTML()).toContain('rt-lh-loose');
    });

    it('sets line-height class on list items', () => {
        const editor = makeEditor('<ul><li>one</li><li>two</li></ul>');
        editor.commands.selectAll();
        editor.commands.setLineHeight('tight');
        const html = editor.getHTML();
        expect(html).toContain('rt-lh-tight');
    });

    it('rejects unknown tokens', () => {
        const editor = makeEditor();
        editor.commands.selectAll();
        expect(editor.commands.setLineHeight('extra-tight' as any)).toBe(false);
    });

    it('unsetLineHeight removes the class', () => {
        const editor = makeEditor();
        editor.commands.selectAll();
        editor.commands.setLineHeight('relaxed');
        editor.commands.unsetLineHeight();
        expect(editor.getHTML()).not.toContain('rt-lh-');
    });
});
