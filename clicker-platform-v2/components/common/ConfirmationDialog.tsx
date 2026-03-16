import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, AlertTriangle } from 'lucide-react';

interface ConfirmationDialogProps {
    isOpen: boolean;
    title: string;
    message?: string;
    onConfirm: () => void;
    onCancel: () => void;
    confirmLabel?: string;
    cancelLabel?: string;
    isDestructive?: boolean;
    isLoading?: boolean;
    children?: React.ReactNode;
    hideFooter?: boolean;
}

export const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
    isOpen,
    title,
    message,
    onConfirm,
    onCancel,
    confirmLabel = 'Delete',
    cancelLabel = 'Cancel',
    isDestructive = true,
    isLoading = false,
    children,
    hideFooter = false,
}) => {
    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);

    if (!isOpen || !mounted) return null;

    const dialog = (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div
                className="bg-white dark:bg-neutral-900 rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200"
                role="dialog"
                aria-modal="true"
                aria-labelledby="dialog-title"
            >
                <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-neutral-800 bg-white dark:bg-neutral-900">
                    <div className="flex items-center gap-2 text-gray-900 dark:text-neutral-100">
                        {isDestructive && <AlertTriangle className="text-red-500" size={20} />}
                        <h3 id="dialog-title" className="font-bold text-lg leading-none">{title}</h3>
                    </div>
                    <button
                        onClick={onCancel}
                        disabled={isLoading}
                        className="p-1 rounded-lg text-gray-400 dark:text-neutral-600 hover:bg-gray-100 dark:hover:bg-neutral-800 hover:text-gray-600 dark:hover:text-neutral-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        aria-label="Close"
                    >
                        <X size={20} />
                    </button>
                </div>
                <div className="p-6">
                    <p className="text-gray-600 dark:text-neutral-400 font-medium mb-4">{message}</p>
                    {children}
                </div>
                {!hideFooter && (
                    <div className="flex gap-3 p-4 bg-gray-50 dark:bg-neutral-800/50 border-t border-gray-100 dark:border-neutral-800">
                        <button
                            onClick={onCancel}
                            disabled={isLoading}
                            className="flex-1 px-4 py-2.5 rounded-lg font-bold text-gray-500 dark:text-neutral-400 hover:bg-gray-200 dark:hover:bg-neutral-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {cancelLabel}
                        </button>
                        <button
                            onClick={onConfirm}
                            disabled={isLoading}
                            className={`flex-1 px-4 py-2.5 rounded-lg font-bold shadow-sm transition-all hover:bg-opacity-90 active:scale-95 disabled:opacity-70 disabled:cursor-wait ${isDestructive ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-brand-dark text-white hover:bg-gray-800'}`}
                        >
                            {isLoading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Processing...
                                </span>
                            ) : confirmLabel}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );

    return createPortal(dialog, document.body);
};

