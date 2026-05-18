/**
 * Visual selection chrome shared by SelectableBlock (block selection) and
 * Canvas Studio's chrome slots (header/footer/bottomnav selection).
 *
 * Renders nothing on its own — call it inside a `relative` container.
 * - `selected`: full 2px border + 8 corner/edge handles
 * - `hoverGuide`: 1px dashed-style outline shown when not selected (guides on)
 */

interface SelectionChromeProps {
    selected: boolean;
    hoverGuide?: boolean;
}

export function SelectionChrome({ selected, hoverGuide = false }: SelectionChromeProps) {
    if (selected) {
        return (
            <div className="absolute pointer-events-none z-10" style={{ inset: -1 }}>
                <div className="absolute inset-0 border-2 border-blue-500" style={{ borderRadius: 0 }} />
                <div className="absolute -top-[4px] -left-[4px] w-[8px] h-[8px] bg-white border-[1.5px] border-blue-500" />
                <div className="absolute -top-[4px] left-1/2 -translate-x-1/2 w-[8px] h-[8px] bg-white border-[1.5px] border-blue-500" />
                <div className="absolute -top-[4px] -right-[4px] w-[8px] h-[8px] bg-white border-[1.5px] border-blue-500" />
                <div className="absolute top-1/2 -translate-y-1/2 -left-[4px] w-[8px] h-[8px] bg-white border-[1.5px] border-blue-500" />
                <div className="absolute top-1/2 -translate-y-1/2 -right-[4px] w-[8px] h-[8px] bg-white border-[1.5px] border-blue-500" />
                <div className="absolute -bottom-[4px] -left-[4px] w-[8px] h-[8px] bg-white border-[1.5px] border-blue-500" />
                <div className="absolute -bottom-[4px] left-1/2 -translate-x-1/2 w-[8px] h-[8px] bg-white border-[1.5px] border-blue-500" />
                <div className="absolute -bottom-[4px] -right-[4px] w-[8px] h-[8px] bg-white border-[1.5px] border-blue-500" />
            </div>
        );
    }

    if (hoverGuide) {
        return (
            <div className="absolute inset-0 pointer-events-none z-10 outline outline-1 outline-blue-400/40 outline-offset-0 hover:outline-blue-400/60" />
        );
    }

    return null;
}
