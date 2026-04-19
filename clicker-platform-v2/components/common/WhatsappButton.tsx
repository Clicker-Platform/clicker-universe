import React from 'react';
import { MessageCircle } from 'lucide-react';

export interface WhatsappButtonProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
    phoneNumber: string;
    message?: string;
    label?: string;
    showIcon?: boolean;
}

/**
 * Generates a WhatsApp URL for the given phone number and message.
 * Strips non-digit characters from the phone number.
 */
export const getWhatsappUrl = (phoneNumber: string, message: string = ''): string => {
    const cleanNumber = phoneNumber.replace(/\D/g, '');
    const encodedMessage = encodeURIComponent(message);
    return `https://wa.me/${cleanNumber}?text=${encodedMessage}`;
};

export const WhatsappButton: React.FC<WhatsappButtonProps> = ({
    phoneNumber,
    message = "Hi! I'd like to order...",
    label = "Order on WhatsApp",
    className = "",
    style,
    showIcon = true,
    ...props
}) => {
    if (!phoneNumber) return null;

    const url = getWhatsappUrl(phoneNumber, message);

    return (
        <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex items-center justify-center gap-2 w-full text-white py-4 font-bold text-lg hover:opacity-90 transition-opacity hover:-translate-y-0.5 transform duration-200 ${className}`}
            style={{ backgroundColor: '#25D366', borderRadius: 'var(--theme-radius)', boxShadow: 'var(--theme-card-shadow)', ...style }}
            {...props}
        >
            {showIcon && <MessageCircle size={24} fill="white" />}
            {label}
        </a>
    );
};
