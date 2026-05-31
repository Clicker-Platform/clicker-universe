import type { ModuleDefinition, MemberSurfaceContext, MemberSurfaceDefinition } from '@/lib/modules/types';
import { libraryHasDataAdmin } from '@/lib/modules/digital_goods/surface-admin';

export interface VisibleSurface {
  moduleId: string;
  surface: MemberSurfaceDefinition;
}

// Server-only registry of `dataCheck` keys → admin-SDK predicates. A surface that
// needs the admin SDK for its data check declares a string key (in the client-safe
// definitions.ts) instead of an inline function; this module — imported ONLY by the
// server-only /api/account/surfaces route — resolves the key here. This keeps
// firebase-admin out of the client bundle while still letting the surfaces route
// read rules-gated collections (e.g. the buyer's library).
const DATA_CHECKS: Record<string, (ctx: MemberSurfaceContext) => Promise<boolean>> = {
  'digital_goods:library': (ctx) => libraryHasDataAdmin(ctx.siteId, ctx.uid),
};

// Core composer. Operates on registry definitions plus the server-only DATA_CHECKS map.
// Visibility: enabled module AND (isGranted() ?? hasData() ?? dataCheck()). All unset = hidden.
export async function resolveVisibleSurfaces(
  modules: ModuleDefinition[],
  ctx: MemberSurfaceContext,
): Promise<VisibleSurface[]> {
  const out: VisibleSurface[] = [];
  for (const m of modules) {
    if (!m.enabled) continue;
    const s = m.memberSurface;
    if (!s) continue;
    let visible = false;
    if (s.isGranted) {
      visible = await s.isGranted(ctx);
    } else if (s.hasData) {
      visible = await s.hasData(ctx);
    } else if (s.dataCheck) {
      const check = DATA_CHECKS[s.dataCheck];
      visible = check ? await check(ctx) : false;
    }
    if (visible) out.push({ moduleId: m.id, surface: s });
  }
  return out;
}
