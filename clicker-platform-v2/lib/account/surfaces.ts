import type { ModuleDefinition, MemberSurfaceContext, MemberSurfaceDefinition } from '@/lib/modules/types';

export interface VisibleSurface {
  moduleId: string;
  surface: MemberSurfaceDefinition;
}

// Core composer. Imports NO module — operates only on registry definitions.
// Visibility: enabled module AND (isGranted() if set, else hasData()). Both unset = hidden.
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
    if (s.isGranted) visible = await s.isGranted(ctx);
    else if (s.hasData) visible = await s.hasData(ctx);
    if (visible) out.push({ moduleId: m.id, surface: s });
  }
  return out;
}
