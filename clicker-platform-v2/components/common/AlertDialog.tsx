import React from 'react';
import { X, AlertCircle, Info, CheckCircle } from 'lucide-react';

interface AlertDialogProps {
    isOpen: boolean;
    title: string;
    message: string;
    onClose: () => void;
    buttonLabel?: string;
    variant?: 'error' | 'info' | 'success';
}

export const AlertDialog: React.FC<AlertDialogProps> = ({
    isOpen,
    title,
    message,
    onClose,
    buttonLabel = 'Understood',
    variant = 'error',
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div
                className="bg-white rounded-2xl border-[3px] border-brand-dark shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200"
                role="dialog"
                aria-modal="true"
                aria-labelledby="alert-dialog-title"
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50">
                    <div className="flex items-center gap-2 text-brand-dark">
                        {variant === 'error' && <AlertCircle className="text-red-500" size={20} />}
                        {variant === 'info' && <Info className="text-blue-500" size={20} />}
                        {variant === 'success' && <CheckCircle className="text-green-500" size={20} />}
                        <h3 id="alert-dialog-title" className="font-bold text-lg leading-none">{title}</h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 rounded-lg text-gray-400 hover:bg-gray-200 hover:text-gray-600 transition-colors"
                        aria-label="Close"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6">
                    <p className="text-gray-600 font-medium">{message}</p>
                </div>

                {/* Footer */}
                <div className="flex p-4 bg-gray-50 border-t border-gray-100">
                    <button
                        onClick={onClose}
                        className={`
                            w-full px-4 py-2.5 rounded-xl border-2 border-brand-dark font-bold shadow-sticker transition-all hover:translate-y-[1px] hover:translate-x-[1px] hover:shadow-none
                            ${variant === 'error'
                                ? 'bg-red-500 text-white hover:bg-red-600 border-red-700'
                                : variant === 'info'
                                    ? 'bg-brand-dark text-white hover:bg-brand-green hover:text-brand-dark'
                                    : 'bg-green-500 text-white hover:bg-green-600 border-green-700' // success
                            }
                        `}
                    >
                        {buttonLabel}
                    </button>
                </div>
            </div>
        </div>
    );
};
