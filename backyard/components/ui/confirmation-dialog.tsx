
'use client';

import { AlertTriangle, X } from "lucide-react";

interface ConfirmationDialogProps {
    isOpen: boolean;
    onCancel: () => void;
    onConfirm: () => void;
    title: string;
    description: string;
    variant?: 'danger' | 'primary' | 'warning';
    loading?: boolean;
}

export function ConfirmationDialog({
    isOpen,
    onCancel,
    onConfirm,
    title,
    description,
    variant = 'primary',
    loading = false
}: ConfirmationDialogProps) {
    if (!isOpen) return null;

    const variantStyles = {
        danger: {
            icon: "text-red-600 bg-red-50",
            button: "bg-red-600 hover:bg-red-700 text-white",
            border: "border-red-100"
        },
        warning: {
            icon: "text-amber-600 bg-amber-50",
            button: "bg-amber-600 hover:bg-amber-700 text-white",
            border: "border-amber-100"
        },
        primary: {
            icon: "text-blue-600 bg-blue-50",
            button: "bg-blue-600 hover:bg-blue-700 text-white",
            border: "border-blue-100"
        }
    };

    const styles = variantStyles[variant];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/30 backdrop-blur-sm transition-opacity"
                onClick={!loading ? onCancel : undefined}
            />

            {/* Modal */}
            <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="p-6">
                    <div className="flex items-start gap-4">
                        <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${styles.icon}`}>
                            <AlertTriangle className="w-6 h-6" />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-lg font-bold text-gray-900 leading-6">
                                {title}
                            </h3>
                            <div className="mt-2">
                                <p className="text-sm text-gray-500 font-medium">
                                    {description}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onCancel}
                            disabled={loading}
                            className="text-gray-400 hover:text-gray-500 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                <div className="bg-gray-50 px-6 py-4 flex flex-row-reverse gap-3">
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={loading}
                        className={`inline-flex justify-center items-center rounded-lg px-4 py-2.5 text-sm font-bold sm:w-auto w-full transition-all ${styles.button} ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
                    >
                        {loading ? 'Processing...' : 'Confirm Action'}
                    </button>
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={loading}
                        className="inline-flex justify-center items-center rounded-lg border-2 border-gray-200 bg-white px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-50 hover:border-gray-300 sm:w-auto w-full transition-all"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}
