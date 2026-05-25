'use client';

import React, { useContext, useEffect, useRef, useState } from 'react';
import { EditorContext } from '@/components/admin/blocks/EditorContext';
import { CardToolbar, type AddableField, type ToolbarPlacement } from '@/components/admin/blocks/inline/CardToolbar';
import { EditableText } from '@/components/blocks/shared/EditablePrimitives';
import { useTemplate } from '@/components/TemplateProvider';
import { useDeviceView, dv } from '@/components/DeviceViewContext';
import { MediaView } from './MediaView';
import { getCardClasses, getHeadingColor, getBodyColor, getMutedColor, getLabelColor, hexWithOpacity } from './cardStyles';
import { H3, H4, BODY_SM } from './typography';
import type { FeatureCardsData, FeatureCard } from '@/components/blocks/feature-cards/types';

function isLightColor(hex: string): boolean {
    let clean = hex.replace('#', '');
    if (clean.length === 3) {
        clean = clean.split('').map(c => c + c).join('');
    }
    if (clean.length !== 6) return true;
    const r = parseInt(clean.slice(0, 2), 16) / 255;
    const g = parseInt(clean.slice(2, 4), 16) / 255;
    const b = parseInt(clean.slice(4, 6), 16) / 255;
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return luminance > 0.5;
}

const DESKTOP_COLS_CLASS: Record<number, string> = {
    1: 'md:grid-cols-1',
    2: 'md:grid-cols-2',
    3: 'md:grid-cols-3',
    4: 'md:grid-cols-4',
};

interface InlineEditProps {
    /** Persist a field change for this card. Field is the FeatureCard key. */
    onChangeField: (field: 'label' | 'headline' | 'body', value: string) => void;
    /** Fields the user just added via toolbar; render their editor even when empty. */
    addedFields: Set<AddableField>;
    /** Clear an added field after it blurs while still empty. */
    onFieldBlurEmpty: (field: AddableField) => void;
    /** Field that should auto-focus after mount (set when user clicks "+ Field"). */
    autoFocusField: AddableField | null;
    /** Clear the auto-focus marker after applying. */
    onAutoFocusApplied: () => void;
}

interface CardItemProps {
    card: FeatureCard;
    cardStyle?: string;
    theme: any;
    edit?: InlineEditProps;
}

function CardItem({ card, cardStyle, theme, edit }: CardItemProps) {
    const d = useDeviceView();
    const hasCustomBg = !!card.bgColor;

    // Per-card bgColor override → derive contrast text color via luminance.
    // This is the spec-allowed exception in §3.1 (user-uploaded surface colors).
    const autoTextColor = card.bgColor
        ? (card.textColor || (isLightColor(card.bgColor) ? '#111111' : '#ffffff'))
        : undefined;

    const cardClass = hasCustomBg
        ? 'rounded-2xl overflow-hidden flex flex-col h-full'
        : `rounded-2xl overflow-hidden flex flex-col h-full ${getCardClasses(cardStyle)}`;

    const inlineStyle = hasCustomBg
        ? { backgroundColor: card.bgColor, color: autoTextColor }
        : undefined;

    const headingColor = hasCustomBg ? autoTextColor! : getHeadingColor(cardStyle, theme);
    const labelColor = hasCustomBg ? hexWithOpacity(autoTextColor!, 0.6) : getLabelColor(cardStyle, theme);
    const bodyColor = hasCustomBg ? hexWithOpacity(autoTextColor!, 0.8) : getMutedColor(cardStyle, theme);

    const tagBg = hasCustomBg ? 'rgba(255,255,255,0.15)' : 'var(--theme-surface)';
    const tagText = hasCustomBg ? autoTextColor : getBodyColor(cardStyle, theme);

    const labelRef = useRef<HTMLDivElement>(null);
    const bodyRef = useRef<HTMLDivElement>(null);

    const showLabel = !!card.label || (edit?.addedFields.has('label') ?? false);
    const showBody = !!card.body || (edit?.addedFields.has('body') ?? false);

    useEffect(() => {
        if (!edit?.autoFocusField) return;
        const node = edit.autoFocusField === 'label' ? labelRef.current : bodyRef.current;
        const editable = node?.querySelector<HTMLElement>('[contenteditable]');
        editable?.focus();
        edit.onAutoFocusApplied();
    }, [edit?.autoFocusField, edit]);

    return (
        <div className={cardClass} style={inlineStyle}>
            {card.media?.src && (
                <MediaView media={card.media} />
            )}
            <div className="flex flex-col gap-2 p-4 flex-1">
                {showLabel && (
                    <div ref={labelRef}>
                        {edit ? (
                            <EditableText
                                tag="div"
                                field="label"
                                value={card.label}
                                placeholder="Add label…"
                                className={`${H4(d)} block w-full`}
                                style={{ color: labelColor }}
                                onInlineChange={(_f, v) => {
                                    edit.onChangeField('label', v);
                                    if (!v) edit.onFieldBlurEmpty('label');
                                }}
                            />
                        ) : (
                            <span className={H4(d)} style={{ color: labelColor }}>
                                {card.label}
                            </span>
                        )}
                    </div>
                )}
                {edit ? (
                    <EditableText
                        tag="h3"
                        field="headline"
                        value={card.headline}
                        placeholder="Card headline"
                        className={H3(d)}
                        style={{ color: headingColor }}
                        onInlineChange={(_f, v) => edit.onChangeField('headline', v)}
                    />
                ) : (
                    <h3 className={H3(d)} style={{ color: headingColor }}>
                        {card.headline}
                    </h3>
                )}
                {showBody && (
                    <div ref={bodyRef}>
                        {edit ? (
                            <EditableText
                                tag="div"
                                field="body"
                                value={card.body}
                                placeholder="Add description…"
                                className={`${BODY_SM(d)} block w-full`}
                                style={{ color: bodyColor }}
                                onInlineChange={(_f, v) => {
                                    edit.onChangeField('body', v);
                                    if (!v) edit.onFieldBlurEmpty('body');
                                }}
                            />
                        ) : (
                            <p className={BODY_SM(d)} style={{ color: bodyColor }}>
                                {card.body}
                            </p>
                        )}
                    </div>
                )}
                {card.tags && card.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-auto pt-2">
                        {card.tags.map((tag, i) => (
                            <span
                                key={i}
                                className="px-3 py-1 rounded-full text-xs font-medium"
                                style={{ backgroundColor: tagBg, color: tagText }}
                            >
                                {tag}
                            </span>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

interface DefaultFeatureCardsBlockProps {
    data: FeatureCardsData;
    theme?: any;
    previewMode?: boolean;
    /** Set by BlockRenderer in admin canvas. Used as `selection.containerId`
     *  when a child card is selected. Undefined on the public site. */
    containerBlockId?: string;
}

export function DefaultFeatureCardsBlock({ data, theme: themeProp, previewMode, containerBlockId }: DefaultFeatureCardsBlockProps) {
    const { theme: contextTheme } = useTemplate();
    const theme = (themeProp && typeof themeProp === 'object') ? themeProp : contextTheme;
    const deviceView = useDeviceView();

    const editor = useContext(EditorContext);
    const isAdminCanvas = !!(editor && previewMode && containerBlockId);

    const selectedCardId: string | null =
        isAdminCanvas
        && editor!.selection.kind === 'slots'
        && editor!.selection.containerId === containerBlockId
        && editor!.selection.ids.length === 1
            ? editor!.selection.ids[0]
            : null;

    // Transient per-card state: fields the user opted to add via toolbar but
    // hasn't typed into yet. Not persisted — discarded on blur if still empty.
    const [addedByCard, setAddedByCard] = useState<Record<string, Set<AddableField>>>({});
    const [autoFocusByCard, setAutoFocusByCard] = useState<Record<string, AddableField | null>>({});

    if (!data) return null;

    const columns = data.columns || 3;
    const desktopCols = DESKTOP_COLS_CLASS[columns] || DESKTOP_COLS_CLASS[3];
    const cards = data.cards || [];
    const isSingle = cards.length === 1;
    // columns=1 with multiple cards: vertical stack on every viewport. The horizontal-scroll
    // carousel only makes sense when the row is meant to fit multiple cards.
    const isStack = columns === 1 && !isSingle;

    // Mobile: horizontal scroll. Desktop: grid.
    // dv() emits the right classes for canvas previews + responsive viewport.
    // CardToolbar portals out of this container, so no top padding needed in admin.
    const containerClass = isSingle
        ? `flex justify-center px-4 md:max-w-6xl md:mx-auto`
        : isStack
        ? `flex flex-col gap-4 px-4 md:max-w-6xl md:mx-auto`
        : dv(
            deviceView,
            `flex items-stretch gap-3 overflow-x-auto overflow-y-visible px-4 pt-1 pb-2 scroll-pl-4 snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`,
            `md:grid ${desktopCols} md:gap-4 md:items-stretch md:px-4 md:max-w-6xl md:mx-auto md:overflow-visible md:pt-0 md:pb-0`
        );

    const cardWrapperBase = (isSingle || isStack)
        ? 'w-full flex flex-col'
        : dv(
            deviceView,
            'snap-start shrink-0 w-[72vw] max-w-[280px] flex flex-col',
            'md:w-auto md:max-w-none flex flex-col'
        );

    // Carousel mode (mobile preview, multiple cards, not stacked) clips
    // overflow-x — render toolbar overlay-inside-card. Otherwise float above.
    const toolbarPlacement: ToolbarPlacement =
        !isSingle && !isStack && deviceView === 'mobile' ? 'overlay' : 'above';

    return (
        <section className="w-full min-w-0 py-8">
            {cards.length > 0 && (
                <div className={containerClass}>
                    {cards.map((card, index) => (
                        <CardSlot
                            key={card.id}
                            card={card}
                            index={index}
                            cards={cards}
                            theme={theme}
                            cardWrapperBase={cardWrapperBase}
                            isAdminCanvas={isAdminCanvas}
                            isSelected={selectedCardId === card.id}
                            editor={editor}
                            containerBlockId={containerBlockId}
                            addedFields={addedByCard[card.id] ?? new Set<AddableField>()}
                            autoFocusField={autoFocusByCard[card.id] ?? null}
                            setAddedByCard={setAddedByCard}
                            setAutoFocusByCard={setAutoFocusByCard}
                            toolbarPlacement={toolbarPlacement}
                        />
                    ))}
                </div>
            )}
        </section>
    );
}

interface CardSlotProps {
    card: FeatureCard;
    index: number;
    cards: FeatureCard[];
    theme: any;
    cardWrapperBase: string;
    isAdminCanvas: boolean;
    isSelected: boolean;
    editor: React.ContextType<typeof EditorContext>;
    containerBlockId?: string;
    addedFields: Set<AddableField>;
    autoFocusField: AddableField | null;
    setAddedByCard: React.Dispatch<React.SetStateAction<Record<string, Set<AddableField>>>>;
    setAutoFocusByCard: React.Dispatch<React.SetStateAction<Record<string, AddableField | null>>>;
    toolbarPlacement: ToolbarPlacement;
}

function CardSlot({
    card,
    index,
    cards,
    theme,
    cardWrapperBase,
    isAdminCanvas,
    isSelected,
    editor,
    containerBlockId,
    addedFields,
    autoFocusField,
    setAddedByCard,
    setAutoFocusByCard,
    toolbarPlacement,
}: CardSlotProps) {
    const selectionRing = isAdminCanvas && isSelected ? 'ring-2 ring-blue-500 rounded-2xl' : '';

    const handleClick = isAdminCanvas
        ? (e: React.MouseEvent) => {
            e.stopPropagation();
            editor!.setSelection({
                kind: 'slots',
                containerId: containerBlockId!,
                ids: [card.id],
            });
        }
        : undefined;

    const handleMoveUp = () => {
        const next = [...cards];
        [next[index - 1], next[index]] = [next[index], next[index - 1]];
        editor!.updateBlockData(containerBlockId!, { cards: next });
    };
    const handleMoveDown = () => {
        const next = [...cards];
        [next[index + 1], next[index]] = [next[index], next[index + 1]];
        editor!.updateBlockData(containerBlockId!, { cards: next });
    };
    const handleDelete = () => {
        const next = cards.filter((_, i) => i !== index);
        editor!.updateBlockData(containerBlockId!, { cards: next });
        editor!.setSelection({ kind: 'blocks', ids: [containerBlockId!] });
    };

    const missingFields: AddableField[] = [];
    if (!card.label && !addedFields.has('label')) missingFields.push('label');
    if (!card.body && !addedFields.has('body')) missingFields.push('body');

    const handleAddField = (field: AddableField) => {
        setAddedByCard(prev => {
            const nextSet = new Set(prev[card.id] ?? []);
            nextSet.add(field);
            return { ...prev, [card.id]: nextSet };
        });
        setAutoFocusByCard(prev => ({ ...prev, [card.id]: field }));
    };

    const handleChangeField = (field: 'label' | 'headline' | 'body', value: string) => {
        const next = cards.map((c, i) =>
            i === index ? { ...c, [field]: value || undefined } : c
        );
        editor!.updateBlockData(containerBlockId!, { cards: next });
    };

    const handleFieldBlurEmpty = (field: AddableField) => {
        setAddedByCard(prev => {
            const nextSet = new Set(prev[card.id] ?? []);
            nextSet.delete(field);
            return { ...prev, [card.id]: nextSet };
        });
    };

    const editProps = isAdminCanvas ? {
        onChangeField: handleChangeField,
        addedFields,
        onFieldBlurEmpty: handleFieldBlurEmpty,
        autoFocusField,
        onAutoFocusApplied: () =>
            setAutoFocusByCard(prev => ({ ...prev, [card.id]: null })),
    } : undefined;

    return (
        <div
            onClick={handleClick}
            className={`${cardWrapperBase} relative ${selectionRing} ${isAdminCanvas ? 'cursor-pointer' : ''}`}
        >
            {isAdminCanvas && isSelected && (
                <CardToolbar
                    label={`Card #${index + 1}`}
                    canMoveUp={index > 0}
                    canMoveDown={index < cards.length - 1}
                    onMoveUp={handleMoveUp}
                    onMoveDown={handleMoveDown}
                    onDelete={handleDelete}
                    missingFields={missingFields}
                    onAddField={handleAddField}
                    placement={toolbarPlacement}
                />
            )}
            <CardItem
                card={card}
                cardStyle={theme?.cardStyle}
                theme={theme}
                edit={editProps}
            />
        </div>
    );
}
