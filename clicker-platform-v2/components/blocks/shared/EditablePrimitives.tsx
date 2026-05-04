'use client';

import { useCallback, useEffect, useRef } from 'react';
import { toolbarMouseDownRef } from '@/components/admin/blocks/InlineEditToolbar';

export function FieldSelectionChrome() {
    return (
        <div className="absolute pointer-events-none z-10" style={{ inset: -2 }}>
            <div className="absolute inset-0 border-[1.5px] border-blue-500" style={{ borderRadius: 0 }} />
            <div className="absolute -top-[3.5px] -left-[3.5px] w-[7px] h-[7px] bg-white border-[1.5px] border-blue-500" />
            <div className="absolute -top-[3.5px] left-1/2 -translate-x-1/2 w-[7px] h-[7px] bg-white border-[1.5px] border-blue-500" />
            <div className="absolute -top-[3.5px] -right-[3.5px] w-[7px] h-[7px] bg-white border-[1.5px] border-blue-500" />
            <div className="absolute top-1/2 -translate-y-1/2 -left-[3.5px] w-[7px] h-[7px] bg-white border-[1.5px] border-blue-500" />
            <div className="absolute top-1/2 -translate-y-1/2 -right-[3.5px] w-[7px] h-[7px] bg-white border-[1.5px] border-blue-500" />
            <div className="absolute -bottom-[3.5px] -left-[3.5px] w-[7px] h-[7px] bg-white border-[1.5px] border-blue-500" />
            <div className="absolute -bottom-[3.5px] left-1/2 -translate-x-1/2 w-[7px] h-[7px] bg-white border-[1.5px] border-blue-500" />
            <div className="absolute -bottom-[3.5px] -right-[3.5px] w-[7px] h-[7px] bg-white border-[1.5px] border-blue-500" />
        </div>
    );
}

export function EditableText({
    value,
    field,
    tag: Tag = 'span',
    className,
    style,
    placeholder,
    onInlineChange,
    onFieldFocus,
    onFieldBlur,
}: {
    value?: string;
    field: string;
    tag?: keyof React.JSX.IntrinsicElements;
    className?: string;
    style?: React.CSSProperties;
    placeholder?: string;
    onInlineChange?: (field: string, value: string) => void;
    onFieldFocus?: (field: string, rect: DOMRect) => void;
    onFieldBlur?: () => void;
}) {
    const elRef = useRef<HTMLElement | null>(null);
    const chromeRef = useRef<HTMLDivElement>(null);
    const valueRef = useRef(value);
    valueRef.current = value;

    // Ref callback: fires whenever the contentEditable element mounts/unmounts.
    // Populates initial textContent on every (re)mount — covers the case where
    // EditableText switches between read-only and editable branches.
    const setEl = useCallback((node: HTMLElement | null) => {
        elRef.current = node;
        if (node && document.activeElement !== node) {
            node.textContent = valueRef.current || '';
        }
    }, []);

    // Sync external value updates (e.g. toolbar) when not focused.
    useEffect(() => {
        const node = elRef.current;
        if (node && document.activeElement !== node) {
            node.textContent = value || '';
        }
    }, [value]);

    if (!onInlineChange) {
        const El = Tag as any;
        return <El className={className} style={style}>{value}</El>;
    }

    const El = Tag as any;
    return (
        <div className="relative w-full">
            <El
                ref={setEl}
                contentEditable
                suppressContentEditableWarning
                data-placeholder={placeholder}
                data-field={field}
                className={`${className ?? ''} outline-none cursor-text relative
                    before:content-[attr(data-placeholder)] before:absolute before:inset-0 before:opacity-40 before:pointer-events-none
                    [&:not(:empty)]:before:hidden`}
                style={style}
                onFocus={() => {
                    if (chromeRef.current) chromeRef.current.style.display = 'block';
                    if (onFieldFocus && elRef.current) {
                        onFieldFocus(field, elRef.current.getBoundingClientRect());
                    }
                }}
                onBlur={(e: React.FocusEvent<HTMLElement>) => {
                    if (!toolbarMouseDownRef.current) {
                        if (chromeRef.current) chromeRef.current.style.display = 'none';
                        onInlineChange(field, e.currentTarget.textContent || '');
                        onFieldBlur?.();
                    }
                }}
                onKeyDown={(e: React.KeyboardEvent<HTMLElement>) => {
                    if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLElement).blur(); }
                    if (e.key === 'v' && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault();
                        const text = (e.nativeEvent as any).clipboardData?.getData('text/plain') ?? '';
                        document.execCommand('insertText', false, text);
                    }
                }}
            />
            <div ref={chromeRef} style={{ display: 'none' }}>
                <FieldSelectionChrome />
            </div>
        </div>
    );
}
