'use client';

import { useEffect, useRef, ReactNode } from 'react';
import { X } from 'lucide-react';

interface MobileBottomSheetProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    icon?: React.ElementType;
    children: ReactNode;
    /** Height as a tailwind class or css value. Defaults to ~65vh */
    height?: string;
}

export function MobileBottomSheet({
    isOpen,
    onClose,
    title,
    icon: Icon,
    children,
    height = '65vh',
}: MobileBottomSheetProps) {
    const startYRef = useRef<number | null>(null);
    const currentYRef = useRef<number | null>(null);
    const sheetRef = useRef<HTMLDivElement>(null);

    // Prevent body scroll when sheet is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [isOpen]);

    const handleTouchStart = (e: React.TouchEvent) => {
        startYRef.current = e.touches[0].clientY;
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (startYRef.current === null) return;
        currentYRef.current = e.touches[0].clientY;
        const delta = currentYRef.current - startYRef.current;
        if (delta > 0 && sheetRef.current) {
            sheetRef.current.style.transform = `translateY(${delta}px)`;
        }
    };

    const handleTouchEnd = () => {
        if (startYRef.current !== null && currentYRef.current !== null) {
            const delta = currentYRef.current - startYRef.current;
            if (delta > 100) {
                onClose();
            }
        }
        if (sheetRef.current) {
            sheetRef.current.style.transform = '';
        }
        startYRef.current = null;
        currentYRef.current = null;
    };

    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-40 bg-black/50"
                onClick={onClose}
            />

            {/* Sheet */}
            <div
                ref={sheetRef}
                className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-neutral-900 rounded-t-2xl flex flex-col transition-transform duration-200"
                style={{ height, maxHeight: '85vh' }}
            >
                {/* Drag handle */}
                <div
                    className="flex-shrink-0 pt-3 pb-1 cursor-grab active:cursor-grabbing"
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                >
                    <div className="w-10 h-1 bg-gray-300 dark:bg-neutral-700 rounded-full mx-auto" />
                </div>

                {/* Header */}
                <div className="flex items-center gap-2 px-4 h-11 border-b border-gray-200 dark:border-neutral-800 flex-shrink-0">
                    {Icon && <Icon size={15} className="text-neutral-500 dark:text-neutral-400" />}
                    <span className="flex-1 font-bold text-sm text-neutral-900 dark:text-neutral-200">{title}</span>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-md text-neutral-400 dark:text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Content — flex-col so children can manage their own scroll */}
                <div className="flex-1 flex flex-col min-h-0">
                    {children}
                </div>
            </div>
        </>
    );
}
