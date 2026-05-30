import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Toolbar } from '../Toolbar';

function makeEditor() {
    return new Editor({
        extensions: [StarterKit.configure({ heading: { levels: [1, 2, 3, 4] } })],
        content: '<h3>title</h3>',
    });
}

describe('Toolbar', () => {
    it('renders without crashing when given an editor', () => {
        const editor = makeEditor();
        render(<Toolbar editor={editor} />);
        expect(screen.getByTitle('Bold')).toBeTruthy();
    });

    it('reflects current heading level in the block-type button', () => {
        const editor = makeEditor();
        // Place caret inside the <h3> so isActive('heading', {level:3}) resolves true.
        // selectAll produces an AllSelection that prosemirror won't match attrs against.
        editor.commands.setTextSelection(2);
        render(<Toolbar editor={editor} />);
        expect(screen.getByText('H3')).toBeTruthy();
    });

    it('does not render any sidebar-specific positioning class', () => {
        const editor = makeEditor();
        const { container } = render(<Toolbar editor={editor} />);
        const root = container.firstChild as HTMLElement;
        // Wrapper-agnostic — must NOT include sticky/fixed/sidebar layout classes.
        expect(root.className).not.toMatch(/\bsticky\b/);
        expect(root.className).not.toMatch(/\bfixed\b/);
        expect(root.className).not.toMatch(/\bw-80\b/);
    });
});
