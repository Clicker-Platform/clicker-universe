
import { useCallback } from 'react';
import { POSOrder, POSSettings } from '../types';
import { generateReceiptHtml } from '../receipt-generator';
import { toast } from 'sonner';

export function useReceiptPrinter() {
    const printReceipt = useCallback((order: POSOrder, settings?: POSSettings) => {
        try {
            const html = generateReceiptHtml(order, settings);

            // Open a new window
            const printWindow = window.open('', '_blank', 'width=400,height=600');
            if (printWindow) {
                printWindow.document.write(html);
                printWindow.document.close(); // Finish writing
                printWindow.focus();

                // Wait for content to load then print
                // Use setTimeout to ensure styles are applied
                setTimeout(() => {
                    printWindow.print();
                    // Optional: Close after print? 
                    // printWindow.close(); 
                }, 500);
            } else {
                toast.error("Popup blocked. Please allow popups to print receipts.");
            }
        } catch (e) {
            console.error("Print failed", e);
            toast.error("Failed to generate receipt");
        }
    }, []);

    return { printReceipt };
}
