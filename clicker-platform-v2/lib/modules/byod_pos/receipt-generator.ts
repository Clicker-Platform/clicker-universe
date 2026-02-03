
import { POSOrder, POSSettings } from './types';

export function generateReceiptHtml(order: POSOrder, settings?: POSSettings): string {
    const date = order.createdAt ? new Date(order.createdAt.seconds * 1000) : new Date();
    const dateStr = date.toLocaleString('en-US', {
        day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });

    // Determine ID to show
    const displayId = order.id.slice(-4).toUpperCase();
    const tableInfo = order.tableNumber ? `Table: ${order.tableNumber}` : 'Takeaway';

    // Format currency helper
    const fmt = (n: number) => new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(n);

    // Items HTML
    const itemsHtml = order.items.map(item => `
        <div class="item-row">
            <div class="qty">${item.quantity}x</div>
            <div class="name">
                ${item.name}
                ${item.variantName ? `<br><span class="variant">(${item.variantName})</span>` : ''}
            </div>
            <div class="price">${fmt(item.price * item.quantity)}</div>
        </div>
    `).join('');

    const businessName = settings?.businessName || 'CLICKER CAFE';
    const businessAddress = settings?.businessAddress || '';

    // Tax/Total HTML
    let subtotal = order.taxBreakdown?.subtotal || order.total;
    let service = order.taxBreakdown?.serviceCharge || 0;
    let tax = order.taxBreakdown?.restaurantTax || 0;
    let total = order.total;

    // Robustness: If tax values are 0 but rates exist (e.g. Open Bill tickets or legacy data), recalculate for display
    if (service === 0 && (order.taxBreakdown?.serviceChargeRate || 0) > 0) {
        service = Math.round(subtotal * (order.taxBreakdown!.serviceChargeRate / 100));
    }
    if (tax === 0 && (order.taxBreakdown?.restaurantTaxRate || 0) > 0) {
        // Tax is usually on (Subtotal + Service) or just Subtotal? 
        // Standard is (Subtotal + Service) * TaxRate? Or just Subtotal * TaxRate?
        // Let's assume on taxable base (Subtotal + Service) as per common practice in ID, 
        // OR strictly follow what the calculator does.
        // Calculator usually: (Subtotal + Service) * TaxRate if tax is inclusive/exclusive logic...
        // Let's stick to simple: Subtotal * Rate if stored is 0? 
        // No, let's look at `POSWidget` logic or calculator. 
        // Usually: Service = Subtotal * S_Rate. Tax = (Subtotal + Service) * T_Rate.
        const taxable = subtotal + service;
        tax = Math.round(taxable * (order.taxBreakdown!.restaurantTaxRate / 100));
    }

    // If we recalculated, we must update Total too for the receipt to balance
    if (total === subtotal && (service > 0 || tax > 0)) {
        total = subtotal + service + tax;
    }

    return `
<!DOCTYPE html>
<html>
<head>
    <title>Receipt #${displayId}</title>
    <style>
        @page { margin: 0; size: 80mm auto; }
        body {
            font-family: 'Courier New', Courier, monospace;
            width: 72mm; /* Safe width for 80mm printers */
            margin: 0 auto;
            padding: 10px 0;
            color: #000;
            font-size: 12px;
            line-height: 1.4;
        }
        .header { text-align: center; margin-bottom: 15px; border-bottom: 1px dashed #000; padding-bottom: 10px; }
        .title { font-size: 16px; font-weight: bold; margin-bottom: 5px; }
        .meta { font-size: 10px; }
        .divider { border-top: 1px dashed #000; margin: 10px 0; }
        
        .item-row { display: flex; margin-bottom: 5px; }
        .qty { width: 25px; font-weight: bold; }
        .name { flex: 1; }
        .variant { font-size: 10px; font-style: italic; }
        .price { text-align: right; width: 60px; }

        .totals { margin-top: 10px; }
        .row { display: flex; justify-content: space-between; }
        .grand-total { font-weight: bold; font-size: 14px; margin-top: 5px; }
        
        .footer { text-align: center; margin-top: 20px; font-size: 10px; }
        
        @media print {
            .no-print { display: none; }
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="title">${businessName}</div>
        ${businessAddress ? `<div class="meta">${businessAddress}</div>` : ''}
        <div class="meta">POS Receipt</div>
        <div class="meta">${dateStr}</div>
        <div class="meta">Order #${displayId}</div>
        <div class="meta">${tableInfo}</div>
    </div>

    <div class="items">
        ${itemsHtml}
    </div>

    <div class="divider"></div>

    <div class="totals">
        <div class="row">
            <span>Subtotal</span>
            <span>${fmt(subtotal)}</span>
        </div>
        ${service > 0 ? `
        <div class="row" style="margin-top:2px;">
            <span>Service Charge (${order.taxBreakdown?.serviceChargeRate}%)</span>
            <span>${fmt(service)}</span>
        </div>` : ''}
        ${tax > 0 ? `
        <div class="row" style="margin-top:2px;">
            <span>Tax (${order.taxBreakdown?.restaurantTaxRate}%)</span>
            <span>${fmt(tax)}</span>
        </div>` : ''}
        
        <div class="divider"></div>
        
        <div class="row grand-total">
            <span>TOTAL</span>
            <span>${fmt(total)}</span>
        </div>
         <div class="row" style="margin-top:5px; font-size:10px;">
            <span>Payment</span>
            <span>${order.paymentMethod || 'Unpaid'}</span>
        </div>
    </div>

    <div class="footer">
        Thank you for visiting!<br>
        Please come again.
    </div>

    <script>
        // Auto print if opened directly, but allow caller to handle too
        // window.onload = () => window.print();
    </script>
</body>
</html>
    `;
}
