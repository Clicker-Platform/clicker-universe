/**
 * Warranty card PDF download.
 *
 * Uses @react-pdf/renderer to generate a PDF that mirrors the public
 * WarrantyCardView layout. The PDF is streamed as a download attachment.
 */

import { NextRequest, NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { createElement } from 'react';
import { db } from '@/lib/firebase';
import { collectionGroup, query, where, limit, getDocs, Timestamp } from 'firebase/firestore';
import type { WarrantyCard, SerializedWarrantyCard } from '@/lib/modules/service-records/types';
import WarrantyCardPdf from '@/lib/modules/service-records/public/WarrantyCardPdf';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ warrantyCode: string }> }
) {
    const { warrantyCode } = await params;
    const code = warrantyCode.toUpperCase();

    // Look up warranty card via collectionGroup query
    const q = query(
        collectionGroup(db, 'warrantyCards'),
        where('warrantyCode', '==', code),
        limit(1)
    );
    const snap = await getDocs(q);

    if (snap.empty) {
        return NextResponse.json({ error: 'Warranty card not found' }, { status: 404 });
    }

    const docSnap = snap.docs[0];
    const data = docSnap.data() as Omit<WarrantyCard, 'id'>;

    // Serialize Timestamps to ISO strings
    const card: SerializedWarrantyCard = {
        ...data,
        id: docSnap.id,
        serviceDate: (data.serviceDate as Timestamp).toDate().toISOString(),
        expiryDate: (data.expiryDate as Timestamp).toDate().toISOString(),
        createdAt: (data.createdAt as Timestamp).toDate().toISOString(),
    };

    // Build the public warranty URL for the PDF
    const origin = request.nextUrl.origin;
    const warrantyUrl = `${origin}/warranty/${code}`;

    // Render PDF to buffer
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buffer = await renderToBuffer(
        createElement(WarrantyCardPdf, { card, warrantyUrl }) as any
    );

    return new NextResponse(new Uint8Array(buffer), {
        status: 200,
        headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="warranty-${code}.pdf"`,
        },
    });
}
