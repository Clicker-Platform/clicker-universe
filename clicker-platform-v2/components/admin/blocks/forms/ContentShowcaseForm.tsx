'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { Plus, Trash2, ChevronDown, ChevronUp, GripVertical, Loader2 } from 'lucide-react';
import {
    ContentShowcaseData,
    DEFAULT_SHOWCASE_DATA,
    ShowcaseRow,
    ShowcaseMaxWidth,
    ShowcaseRowGap,
    ShowcaseVerticalAlign,
    ShowcaseLayout,
    RowLayout,
    CtaVariant,
    newRow,
} from '@/components/blocks/content-showcase/types';
import { MediaField } from '@/components/admin/blocks/media-field/MediaField';
import { ConfirmationDialog } from '@/components/common/ConfirmationDialog';

const RichTextEditor = dynamic(
    () => import('../rich-text/RichTextEditor').then((m) => m.RichTextEditor),
    {
        ssr: false,
        loading: () => (
            <div className="h-[160px] w-full bg-gray-100/50 dark:bg-neutral-900/50 flex items-center justify-center rounded-lg border border-dashed border-gray-200 dark:border-neutral-800 text-neutral-400 gap-2">
                <Loader2 size={16} className="animate-spin text-blue-500" />
                <span className="text-xs font-bold">Loading editor…</span>
            </div>
        ),
    }
);

interface Props {
    data: unknown;
    onChange: (data: ContentShowcaseData) => void;
}

const labelClass = 'block text-[11px] font-medium text-neutral-400 dark:text-neutral-500 mb-1 uppercase tracking-wider';
const inputClass = 'w-full px-3 py-2 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-lg text-sm text-neutral-900 dark:text-neutral-200 placeholder-neutral-400 dark:placeholder-neutral-600 focus:border-blue-500/50 focus:outline-none transition-colors';
const WIDTH_PRESETS = [30, 40, 50, 60, 70];

function normalize(data: unknown): ContentShowcaseData {
    const d = (data as Partial<ContentShowcaseData>) || {};
    return {
        ...DEFAULT_SHOWCASE_DATA,
        ...d,
        rowBackgrounds: { ...DEFAULT_SHOWCASE_DATA.rowBackgrounds, ...(d.rowBackgrounds || {}) },
        rows: Array.isArray(d.rows) ? d.rows : [],
    };
}

export function ContentShowcaseForm({ data, onChange }: Props) {
    const safe = normalize(data);
    const [expandedRow, setExpandedRow] = useState<string | null>(safe.rows[0]?.id || null);

    const update = (patch: Partial<ContentShowcaseData>) => {
        onChange({ ...safe, ...patch });
    };

    const updateRow = (id: string, patch: Partial<ShowcaseRow>) => {
        onChange({
            ...safe,
            rows: safe.rows.map((r) => {
                if (r.id !== id) return r;
                const merged = { ...r, ...patch } as Record<string, unknown>;
                for (const k of Object.keys(patch)) {
                    if (merged[k] === undefined) delete merged[k];
                }
                return merged as unknown as ShowcaseRow;
            }),
        });
    };

    const addRow = () => {
        const row = newRow();
        onChange({ ...safe, rows: [...safe.rows, row] });
        setExpandedRow(row.id);
    };

    const removeRow = (id: string) => {
        if (safe.rows.length <= 1) return; // enforce min 1
        onChange({ ...safe, rows: safe.rows.filter((r) => r.id !== id) });
    };

    const moveRow = (id: string, dir: -1 | 1) => {
        const idx = safe.rows.findIndex((r) => r.id === id);
        if (idx < 0) return;
        const next = idx + dir;
        if (next < 0 || next >= safe.rows.length) return;
        const rows = [...safe.rows];
        [rows[idx], rows[next]] = [rows[next], rows[idx]];
        onChange({ ...safe, rows });
    };

    return (
        <div className="space-y-6">
            {/* Block settings */}
            <section className="space-y-3 p-4 bg-gray-50 dark:bg-neutral-900 rounded-lg border border-gray-200 dark:border-neutral-800">
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Block Settings</h3>

                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className={labelClass}>Max Width</label>
                        <select value={safe.maxWidth} onChange={(e) => update({ maxWidth: e.target.value as ShowcaseMaxWidth })} className={inputClass}>
                            <option value="sm">Small</option>
                            <option value="md">Medium</option>
                            <option value="lg">Large</option>
                            <option value="xl">Extra Large</option>
                            <option value="full">Full Width</option>
                        </select>
                    </div>
                    <div>
                        <label className={labelClass}>Row Gap</label>
                        <select value={safe.rowGap} onChange={(e) => update({ rowGap: e.target.value as ShowcaseRowGap })} className={inputClass}>
                            <option value="sm">Small</option>
                            <option value="md">Medium</option>
                            <option value="lg">Large</option>
                            <option value="xl">Extra Large</option>
                        </select>
                    </div>
                    <div>
                        <label className={labelClass}>Vertical Align</label>
                        <select value={safe.verticalAlign} onChange={(e) => update({ verticalAlign: e.target.value as ShowcaseVerticalAlign })} className={inputClass}>
                            <option value="top">Top</option>
                            <option value="center">Center</option>
                            <option value="bottom">Bottom</option>
                        </select>
                    </div>
                    <div>
                        <label className={labelClass}>Default Layout</label>
                        <select value={safe.defaultLayout} onChange={(e) => update({ defaultLayout: e.target.value as ShowcaseLayout })} className={inputClass}>
                            <option value="alternate">Alternate</option>
                            <option value="image-left">Image Left</option>
                            <option value="image-right">Image Right</option>
                        </select>
                    </div>
                </div>

                <ColumnWidthControl
                    value={safe.mediaColumnWidth}
                    onChange={(v) => update({ mediaColumnWidth: v })}
                />

                <div className="pt-3 border-t border-gray-200 dark:border-neutral-800">
                    <label className="flex items-center gap-2 text-xs font-bold text-neutral-700 dark:text-neutral-300">
                        <input
                            type="checkbox"
                            checked={safe.rowBackgrounds.enabled}
                            onChange={(e) => update({ rowBackgrounds: { ...safe.rowBackgrounds, enabled: e.target.checked } })}
                        />
                        Alternating row backgrounds
                    </label>
                    {safe.rowBackgrounds.enabled && (
                        <div className="grid grid-cols-2 gap-3 mt-3">
                            <div>
                                <label className={labelClass}>Odd rows</label>
                                <input
                                    type="color"
                                    value={safe.rowBackgrounds.oddColor || '#ffffff'}
                                    onChange={(e) => update({ rowBackgrounds: { ...safe.rowBackgrounds, oddColor: e.target.value } })}
                                    className="w-full h-10 rounded cursor-pointer border border-gray-200 dark:border-neutral-700"
                                />
                            </div>
                            <div>
                                <label className={labelClass}>Even rows</label>
                                <input
                                    type="color"
                                    value={safe.rowBackgrounds.evenColor || '#f5f5f5'}
                                    onChange={(e) => update({ rowBackgrounds: { ...safe.rowBackgrounds, evenColor: e.target.value } })}
                                    className="w-full h-10 rounded cursor-pointer border border-gray-200 dark:border-neutral-700"
                                />
                            </div>
                        </div>
                    )}
                </div>
            </section>

            {/* Rows */}
            <section className="space-y-3">
                <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Rows ({safe.rows.length})</h3>
                    <button
                        type="button"
                        onClick={addRow}
                        className="text-xs font-bold text-blue-500 flex items-center gap-1.5 hover:text-blue-400 bg-blue-500/10 px-3 py-1.5 rounded-full border border-blue-500/20"
                    >
                        <Plus size={14} /> Add Row
                    </button>
                </div>

                {safe.rows.length >= 10 && (
                    <p className="text-[11px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/40 rounded-lg px-3 py-2">
                        Many rows can hurt readability and page speed. Consider splitting into multiple blocks.
                    </p>
                )}

                <div className="space-y-2">
                    {safe.rows.map((row, i) => (
                        <RowCard
                            key={row.id}
                            row={row}
                            index={i}
                            totalRows={safe.rows.length}
                            expanded={expandedRow === row.id}
                            onToggle={() => setExpandedRow(expandedRow === row.id ? null : row.id)}
                            onChange={(patch) => updateRow(row.id, patch)}
                            onDelete={() => removeRow(row.id)}
                            onMoveUp={() => moveRow(row.id, -1)}
                            onMoveDown={() => moveRow(row.id, 1)}
                        />
                    ))}
                </div>
            </section>
        </div>
    );
}

function ColumnWidthControl({ value, onChange, compact = false }: { value: number; onChange: (v: number) => void; compact?: boolean }) {
    const label = compact ? 'Media Width Override' : 'Media Column Width';
    return (
        <div>
            <label className={labelClass}>{label}: <span className="text-neutral-700 dark:text-neutral-300">{value}%</span></label>
            <div className="flex items-center gap-2 flex-wrap">
                <div className="flex gap-1">
                    {WIDTH_PRESETS.map((p) => (
                        <button
                            key={p}
                            type="button"
                            onClick={() => onChange(p)}
                            className={`px-2 py-1 text-[11px] font-bold rounded border transition-colors ${
                                value === p
                                    ? 'bg-blue-500 border-blue-500 text-white'
                                    : 'bg-white dark:bg-neutral-900 border-gray-200 dark:border-neutral-800 text-neutral-500 hover:border-blue-500/50'
                            }`}
                        >
                            {p}%
                        </button>
                    ))}
                </div>
                <input
                    type="range"
                    min={25}
                    max={75}
                    step={1}
                    value={value}
                    onChange={(e) => onChange(parseInt(e.target.value, 10))}
                    className="flex-1 min-w-[120px] accent-blue-500"
                />
            </div>
        </div>
    );
}

interface RowCardProps {
    row: ShowcaseRow;
    index: number;
    totalRows: number;
    expanded: boolean;
    onToggle: () => void;
    onChange: (patch: Partial<ShowcaseRow>) => void;
    onDelete: () => void;
    onMoveUp: () => void;
    onMoveDown: () => void;
}

function RowCard({ row, index, totalRows, expanded, onToggle, onChange, onDelete, onMoveUp, onMoveDown }: RowCardProps) {
    const cta = row.cta;
    const [confirmOpen, setConfirmOpen] = useState(false);

    return (
        <>
        <ConfirmationDialog
            isOpen={confirmOpen}
            title="Delete Row"
            message={`Delete "${row.heading.text || 'Untitled row'}"? This cannot be undone.`}
            confirmLabel="Delete Row"
            onConfirm={() => { setConfirmOpen(false); onDelete(); }}
            onCancel={() => setConfirmOpen(false)}
        />
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-lg overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-neutral-800/50">
                <GripVertical size={14} className="text-neutral-400 shrink-0" />
                <button type="button" onClick={onToggle} className="flex-1 text-left flex items-center gap-2 min-w-0">
                    <span className="text-[11px] font-bold text-neutral-400 shrink-0">{index + 1}</span>
                    <span className="text-sm font-bold text-neutral-900 dark:text-neutral-200 truncate">
                        {row.heading.text || 'Untitled row'}
                    </span>
                </button>
                <div className="flex items-center gap-1 shrink-0">
                    <button type="button" onClick={onMoveUp} disabled={index === 0} className="p-1 text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 disabled:opacity-30 disabled:cursor-not-allowed"><ChevronUp size={14} /></button>
                    <button type="button" onClick={onMoveDown} disabled={index === totalRows - 1} className="p-1 text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 disabled:opacity-30 disabled:cursor-not-allowed"><ChevronDown size={14} /></button>
                    <button
                        type="button"
                        onClick={() => setConfirmOpen(true)}
                        disabled={totalRows <= 1}
                        className="p-1 text-neutral-400 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed"
                        title={totalRows <= 1 ? 'At least 1 row is required' : 'Delete row'}
                    >
                        <Trash2 size={14} />
                    </button>
                </div>
            </div>

            {expanded && (
                <div className="p-4 space-y-4 border-t border-gray-200 dark:border-neutral-800">
                    {/* Heading */}
                    <div>
                        <label className={labelClass}>Heading</label>
                        <input
                            type="text"
                            value={row.heading.text}
                            onChange={(e) => onChange({ heading: { ...row.heading, text: e.target.value } })}
                            className={inputClass}
                            placeholder="Section heading"
                        />
                    </div>

                    {/* Media */}
                    <div>
                        <label className={labelClass}>Media</label>
                        <MediaField value={row.media} onChange={(media) => onChange({ media })} />
                    </div>

                    {/* Content */}
                    <div>
                        <label className={labelClass}>Content</label>
                        <div className="rounded-lg overflow-hidden border border-gray-200 dark:border-neutral-800">
                            <RichTextEditor
                                value={row.content}
                                onChange={(html) => onChange({ content: html })}
                                placeholder="Row body — rich text, supports images and video embeds"
                            />
                        </div>
                    </div>

                    {/* Layout override */}
                    <div className="grid grid-cols-1 gap-3 pt-3 border-t border-gray-200 dark:border-neutral-800">
                        <div>
                            <label className={labelClass}>Layout (this row)</label>
                            <select
                                value={row.layout}
                                onChange={(e) => onChange({ layout: e.target.value as RowLayout })}
                                className={inputClass}
                            >
                                <option value="inherit">Inherit block default</option>
                                <option value="image-left">Image Left</option>
                                <option value="image-right">Image Right</option>
                            </select>
                        </div>

                        <div className="flex items-center justify-between gap-2">
                            <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300 flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={typeof row.mediaColumnWidth === 'number'}
                                    onChange={(e) => onChange({ mediaColumnWidth: e.target.checked ? 50 : undefined })}
                                />
                                Override media column width
                            </label>
                        </div>
                        {typeof row.mediaColumnWidth === 'number' && (
                            <ColumnWidthControl
                                value={row.mediaColumnWidth}
                                onChange={(v) => onChange({ mediaColumnWidth: v })}
                                compact
                            />
                        )}
                    </div>

                    {/* CTA */}
                    <div className="pt-3 border-t border-gray-200 dark:border-neutral-800">
                        <label className="flex items-center gap-2 text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-3">
                            <input
                                type="checkbox"
                                checked={!!cta?.enabled}
                                onChange={(e) =>
                                    onChange({
                                        cta: e.target.checked
                                            ? { enabled: true, label: cta?.label || 'Learn more', href: cta?.href || '#', variant: cta?.variant || 'primary' }
                                            : { ...(cta || { label: '', href: '', variant: 'primary' }), enabled: false },
                                    })
                                }
                            />
                            Add Call-to-Action
                        </label>
                        {cta?.enabled && (
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className={labelClass}>Label</label>
                                    <input
                                        type="text"
                                        value={cta.label}
                                        onChange={(e) => onChange({ cta: { ...cta, label: e.target.value } })}
                                        className={inputClass}
                                    />
                                </div>
                                <div>
                                    <label className={labelClass}>URL</label>
                                    <input
                                        type="text"
                                        value={cta.href}
                                        onChange={(e) => onChange({ cta: { ...cta, href: e.target.value } })}
                                        className={inputClass}
                                        placeholder="https://…"
                                    />
                                </div>
                                <div className="col-span-2">
                                    <label className={labelClass}>Style</label>
                                    <select
                                        value={cta.variant}
                                        onChange={(e) => onChange({ cta: { ...cta, variant: e.target.value as CtaVariant } })}
                                        className={inputClass}
                                    >
                                        <option value="primary">Primary</option>
                                        <option value="secondary">Secondary</option>
                                        <option value="ghost">Ghost</option>
                                        <option value="link">Link</option>
                                    </select>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
        </>
    );
}
