import { NextResponse } from 'next/server';
import { templateDefinitions } from '@/lib/templates/definitions';
import { saveTemplate } from '@/lib/templates/service';
import { TemplateDocument } from '@/lib/templates/types';
import { Timestamp } from 'firebase/firestore';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const results = [];
        for (const key in templateDefinitions) {
            const def = templateDefinitions[key];

            const doc: TemplateDocument = {
                id: def.id as string,
                name: def.name,
                description: def.description,
                type: 'system',
                tier: def.isPro ? 'premium' : 'free',
                status: 'active',
                config: def.config,
                ownerId: null, // System templates have no owner
                updatedAt: Timestamp.now()
                // createdAt will be handled by saveTemplate if new
            };

            await saveTemplate(doc);
            results.push(doc.id);
        }

        return NextResponse.json({ success: true, seeded: results });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
