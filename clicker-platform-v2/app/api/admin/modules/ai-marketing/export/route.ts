// GET /api/admin/modules/ai-marketing/export?campaignId=xxx
// Exports a campaign and its saved content as markdown

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireAuthedMember } from '@/lib/api-auth';
import { COLLECTION_CAMPAIGNS, COLLECTION_SAVED } from '@/lib/modules/ai-marketing/constants';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireAuthedMember(req);
  if (!auth.ok) return auth.res;

  const { siteId } = auth.session;
  const campaignId = req.nextUrl.searchParams.get('campaignId');
  if (!campaignId) return NextResponse.json({ error: 'campaignId required' }, { status: 400 });

  const campaignDoc = await adminDb.doc(`sites/${siteId}/${COLLECTION_CAMPAIGNS}/${campaignId}`).get();
  if (!campaignDoc.exists) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });

  const campaign = campaignDoc.data()!;
  const savedContentIds: string[] = campaign.savedContentIds ?? [];

  // Fetch linked saved content
  const contentItems: Array<Record<string, unknown>> = [];
  for (const contentId of savedContentIds) {
    const snap = await adminDb.doc(`sites/${siteId}/${COLLECTION_SAVED}/${contentId}`).get();
    if (snap.exists) contentItems.push({ id: snap.id, ...snap.data() });
  }

  // Build markdown export
  const lines = [
    `# ${campaign.name}`,
    ``,
    `**Platform:** ${campaign.platform || 'Not specified'}`,
    `**Objective:** ${campaign.objective || 'Not specified'}`,
    `**Status:** ${campaign.status}`,
    ``,
    `---`,
    ``,
    `## Saved Content`,
    ``,
  ];

  for (const item of contentItems) {
    lines.push(`### ${(item.type as string | undefined)?.replace(/_/g, ' ').toUpperCase()}`);
    if (item.platform) lines.push(`*Platform: ${item.platform}*`);
    lines.push(``);
    lines.push(item.content as string);
    lines.push(``);
    lines.push(`---`);
    lines.push(``);
  }

  const markdown = lines.join('\n');

  return new NextResponse(markdown, {
    headers: {
      'Content-Type': 'text/markdown',
      'Content-Disposition': `attachment; filename="${campaign.name.replace(/[^a-z0-9]/gi, '_')}.md"`,
    },
  });
}
