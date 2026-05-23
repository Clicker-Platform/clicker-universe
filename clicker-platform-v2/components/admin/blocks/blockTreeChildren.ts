import { PageBlock } from '@/data/mockData';

type ColumnSlot = { id: string; blocks: PageBlock[] };
type GridCell = { id: string; row?: number; col?: number; block: PageBlock | null };
type FeatureCard = { id: string; headline?: string };

export type BlockChildren =
    | { kind: 'leaf' }
    | { kind: 'columns'; slots: { id: string; label: string; blocks: PageBlock[] }[] }
    | { kind: 'grid'; slots: { id: string; label: string; block: PageBlock | null }[] }
    | { kind: 'feature_cards'; cards: { id: string; label: string }[] };

export function getBlockChildren(block: PageBlock): BlockChildren {
    if (block.type === 'columns' && Array.isArray(block.data?.columns)) {
        const cols = block.data.columns as ColumnSlot[];
        return {
            kind: 'columns',
            slots: cols.map((c, i) => ({
                id: c.id,
                label: `Column ${i + 1}`,
                blocks: c.blocks ?? [],
            })),
        };
    }
    if (block.type === 'grid' && Array.isArray(block.data?.cells)) {
        const cells = block.data.cells as GridCell[];
        return {
            kind: 'grid',
            slots: cells.map(cell => ({
                id: cell.id,
                label:
                    cell.row != null && cell.col != null
                        ? `Cell ${cell.row},${cell.col}`
                        : `Cell ${cell.id.slice(0, 6)}`,
                block: cell.block ?? null,
            })),
        };
    }
    if (block.type === 'feature_cards' && Array.isArray(block.data?.cards)) {
        const cards = block.data.cards as FeatureCard[];
        return {
            kind: 'feature_cards',
            cards: cards.map(c => ({
                id: c.id,
                label: c.headline?.trim() || 'Untitled Card',
            })),
        };
    }
    return { kind: 'leaf' };
}
