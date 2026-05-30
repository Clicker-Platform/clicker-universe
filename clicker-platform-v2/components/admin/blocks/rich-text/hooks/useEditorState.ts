// clicker-platform-v2/components/admin/blocks/rich-text/hooks/useEditorState.ts
import { Editor } from '@tiptap/core';
import { useSyncExternalStore } from 'react';

/**
 * Re-renders the consumer on every editor transaction so toolbar buttons,
 * popover triggers, and disabled-state logic reflect the current selection.
 *
 * Wrap calls like `editor.isActive('heading', {level: 2})` in this hook to
 * get reactive updates as the caret moves.
 */
export function useEditorState<T>(
    editor: Editor | null,
    selector: (editor: Editor | null) => T,
): T {
    return useSyncExternalStore(
        (notify) => {
            if (!editor) return () => {};
            editor.on('transaction', notify);
            editor.on('selectionUpdate', notify);
            editor.on('focus', notify);
            editor.on('blur', notify);
            return () => {
                editor.off('transaction', notify);
                editor.off('selectionUpdate', notify);
                editor.off('focus', notify);
                editor.off('blur', notify);
            };
        },
        () => selector(editor),
        () => selector(editor),
    );
}
