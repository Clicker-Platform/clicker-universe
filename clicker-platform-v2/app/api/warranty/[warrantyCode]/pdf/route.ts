/**
 * Warranty card PDF download — v1.0 stub.
 *
 * Redirects to the public warranty card page until PDF generation is implemented.
 *
 * TODO v1.1: Implement PDF generation using Puppeteer, React PDF, or a
 * Chromium-based Cloud Function. The PDF should render the same content
 * as WarrantyCardView with a printer-friendly layout.
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ warrantyCode: string }> }
) {
    const { warrantyCode } = await params;
    return NextResponse.redirect(
        new URL(`/warranty/${warrantyCode}`, _request.url),
        { status: 302 }
    );
}
