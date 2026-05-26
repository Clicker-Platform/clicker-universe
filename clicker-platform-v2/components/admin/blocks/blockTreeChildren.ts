import { PageBlock } from '@/data/mockData';

type ColumnSlot = { id: string; label?: string; blocks: PageBlock[] };
type GridCell = { id: string; label?: string; row?: number; col?: number; block: PageBlock | null };
type FeatureCard = { id: string; headline?: string; navLabel?: string };

export type BlockChildren =
    | { kind: 'leaf' }
    | { kind: 'columns'; slots: { id: string; label: string; defaultLabel: string; blocks: PageBlock[] }[] }
    | { kind: 'grid'; slots: { id: string; label: string; defaultLabel: string; block: PageBlock | null }[] }
    | { kind: 'feature_cards'; cards: { id: string; label: string; defaultLabel: string }[] };

export function getBlockChildren(block: PageBlock): BlockChildren {
    if (block.type === 'columns' && Array.isArray(block.data?.columns)) {
        const cols = block.data.columns as ColumnSlot[];
        return {
            kind: 'columns',
            slots: cols.map((c, i) => {
                const defaultLabel = `Column ${i + 1}`;
                return {
                    id: c.id,
                    label: c.label?.trim() || defaultLabel,
                    defaultLabel,
                    blocks: c.blocks ?? [],
                };
            }),
        };
    }
    if (block.type === 'grid' && Array.isArray(block.data?.cells)) {
        const cells = block.data.cells as GridCell[];
        return {
            kind: 'grid',
            slots: cells.map(cell => {
                const defaultLabel =
                    cell.row != null && cell.col != null
                        ? `Cell ${cell.row},${cell.col}`
                        : `Cell ${cell.id.slice(0, 6)}`;
                return {
                    id: cell.id,
                    label: cell.label?.trim() || defaultLabel,
                    defaultLabel,
                    block: cell.block ?? null,
                };
            }),
        };
    }
    if (block.type === 'feature_cards' && Array.isArray(block.data?.cards)) {
        const cards = block.data.cards as FeatureCard[];
        return {
            kind: 'feature_cards',
            cards: cards.map(c => {
                const defaultLabel = c.headline?.trim() || 'Untitled Card';
                return {
                    id: c.id,
                    label: c.navLabel?.trim() || defaultLabel,
                    defaultLabel,
                };
            }),
        };
    }
    return { kind: 'leaf' };
}
