# FeaturedProduct Block Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate `FeaturedProduct` from a legacy component into a properly structured public block (`DefaultFeaturedProductBlock`) that lives under `components/blocks/public/`, accepts `theme` as a prop, supports `previewMode`, uses `cardStyles.ts` helpers, and removes all dead code.

**Architecture:** Extract the render logic into `DefaultFeaturedProductBlock.tsx` under `components/blocks/public/`, following the exact same prop signature and file conventions used by all other Default* blocks. Update `BlockRenderer.tsx` to import from the new location. Delete the old file and the legacy file.

**Tech Stack:** React, Next.js App Router, TypeScript, Tailwind CSS, Firebase (no new deps)

---

## Files to Create / Modify / Delete

| Action | Path | Purpose |
|--------|------|---------|
| Create | `components/blocks/public/DefaultFeaturedProductBlock.tsx` | New canonical block component |
| Modify | `components/blocks/BlockRenderer.tsx` | Swap import + pass `theme` and `previewMode` |
| Delete | `components/FeaturedProduct.tsx` | Old location — replaced by Default* |
| Delete | `legacy/components/FeaturedProduct.tsx` | Pre-theme POC, unused |

---

## Task 1: Create `DefaultFeaturedProductBlock.tsx`

**Files:**
- Create: `clicker-platform-v2/components/blocks/public/DefaultFeaturedProductBlock.tsx`

This is the core task. The new component must:
- Accept `theme`, `previewMode`, `product`, `badgeText`, `showBadge`, `buttonText`, `phoneNumber`, `whatsappSettings` as props (no context calls for theme or siteId)
- Remove the `useSite()` call entirely (siteId was never used)
- Use `useTemplate()` **only as a fallback** when `theme` prop is not provided (same pattern as `DefaultHeroBlock`)
- Use `getCardClasses()` and `getGlassStyle()` from `cardStyles.ts` for the container
- Guard `handleOrderClick` with `if (previewMode) return;` so the modal never fires in canvas
- Remove the duplicate comment on image derivation
- Use the typed `whatsappSettings` inline interface (matching `ProductDetailModal`'s interface exactly)
- Remove the `Sparkles` icon from the badge — replace with `Star` (from lucide-react, already imported in `blockDefinitions.ts`)

- [ ] **Step 1.1: Create the file**

```tsx
'use client';

import React, { useState } from 'react';
import { Product } from '@/data/mockData';
import { Star, ArrowRight, Image as ImageIcon, Maximize } from 'lucide-react';
import Image from 'next/image';
import { useTemplate } from '@/components/TemplateProvider';
import { ProductDetailModal } from '@/components/catalog/ProductDetailModal';
import { FullScreenGallery } from '@/components/common/FullScreenGallery';
import { Skeleton } from '@/components/ui/skeleton';
import { getCardClasses, getGlassStyle } from './cardStyles';

interface WhatsAppSettings {
    label?: string;
    messageTemplate?: string;
    bgColor?: string;
    textColor?: string;
    ctaMode?: 'whatsapp' | 'url' | 'both';
    ctaUrl?: string;
    ctaUrlLabel?: string;
}

interface DefaultFeaturedProductBlockProps {
    product: Product;
    theme?: any;
    previewMode?: boolean;
    badgeText?: string;
    showBadge?: boolean;
    buttonText?: string;
    phoneNumber?: string;
    whatsappSettings?: WhatsAppSettings;
}

export function DefaultFeaturedProductBlock({
    product,
    theme: themeProp,
    previewMode,
    badgeText = 'Featured',
    showBadge = true,
    buttonText = 'Ask Product',
    phoneNumber,
    whatsappSettings,
}: DefaultFeaturedProductBlockProps) {
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isFullScreenOpen, setIsFullScreenOpen] = useState(false);

    const { theme: contextTheme } = useTemplate();
    const theme = themeProp ?? contextTheme;

    const isClean = theme.cardStyle === 'clean';
    const isGlass = theme.cardStyle === 'glass';
    const isBold = !isClean && !isGlass;

    const handleOrderClick = () => {
        if (previewMode) return;
        setIsModalOpen(true);
    };

    const validImages = (product.images || []).filter(url => url && url.trim() !== '');
    const mainImage =
        product.imageUrl && product.imageUrl.trim() !== ''
            ? product.imageUrl
            : validImages.length > 0
            ? validImages[0]
            : null;
    const images = validImages.length > 0 ? validImages : mainImage ? [mainImage] : [];
    const showGallery = images.length > 1;

    const primaryContrastColor =
        theme.colors.accent && theme.colors.accent !== theme.colors.primary
            ? theme.colors.accent
            : theme.colors.background;

    const badgeStyle = isBold
        ? {
              backgroundColor: theme.colors.primary,
              borderColor: theme.colors.foreground,
              color: theme.colors.foreground,
          }
        : {
              backgroundColor: theme.colors.primary,
              color: primaryContrastColor,
          };

    const imageContainerStyle = {
        borderRadius: `calc(var(--theme-radius) * 0.75)`,
        backgroundColor: isGlass
            ? `${theme.colors.surface || theme.colors.background}10`
            : theme.colors.muted || theme.colors.border || '#f3f4f6',
        borderColor: isBold ? theme.colors.foreground : theme.colors.border || theme.colors.foreground,
    };

    return (
        <div className="relative">
            {/* Badge */}
            {showBadge && (
                <div className={isGlass ? 'mb-4' : 'absolute -top-5 left-1/2 -translate-x-1/2 z-20 w-max'}>
                    {isGlass ? (
                        <span
                            className="text-xs font-bold uppercase tracking-[0.2em]"
                            style={{
                                color: theme.colors.muted || theme.colors.foreground,
                                opacity: theme.colors.muted ? 1 : 0.5,
                            }}
                        >
                            {badgeText}
                        </span>
                    ) : !isBold ? (
                        <div
                            className="px-4 py-1 rounded-full shadow-sm flex items-center gap-2"
                            style={{ ...badgeStyle, fontFamily: theme.fonts.body }}
                        >
                            <Star size={14} className="fill-current" />
                            <span className="font-bold uppercase tracking-wider text-xs">{badgeText}</span>
                        </div>
                    ) : (
                        <div
                            className="border-[3px] px-6 py-2 rounded-full rotate-[-2deg] flex items-center gap-2 animate-bounce"
                            style={{
                                ...badgeStyle,
                                boxShadow: `2px 2px 0px 0px ${theme.colors.foreground}`,
                                fontFamily: theme.fonts.body,
                            }}
                        >
                            <Star size={20} className="fill-current" />
                            <span className="font-black uppercase tracking-wider text-sm">{badgeText}</span>
                            <Star size={20} className="fill-current" />
                        </div>
                    )}
                </div>
            )}

            {/* Card */}
            <div
                className={[
                    'group relative transition-all duration-300 p-4',
                    !isBold ? 'hover:shadow-md' : 'hover:-translate-y-1',
                    isGlass ? 'backdrop-blur-md' : '',
                    isBold ? 'border-[3px]' : 'border',
                    getCardClasses(theme.cardStyle),
                ].join(' ')}
                style={
                    isGlass
                        ? {
                              ...getGlassStyle(theme.colors.surface),
                              borderRadius: 'var(--theme-radius)',
                              borderColor: theme.colors.border || theme.colors.foreground,
                          }
                        : {
                              borderRadius: 'var(--theme-radius)',
                              backgroundColor: theme.colors.surface || theme.colors.background,
                              borderColor: isBold
                                  ? theme.colors.foreground
                                  : theme.colors.border || theme.colors.foreground,
                              boxShadow: isBold
                                  ? `4px 4px 0px 0px ${theme.colors.border}`
                                  : '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
                          }
                }
            >
                {/* Image */}
                <div
                    className={[
                        'w-full aspect-[4/3] overflow-hidden mb-5 relative',
                        isBold ? 'border-[3px]' : '',
                    ].join(' ')}
                    style={imageContainerStyle}
                >
                    {isLoading && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center">
                            <Skeleton className="absolute inset-0 w-full h-full rounded-none" />
                            <ImageIcon
                                className="w-16 h-16 relative z-20"
                                strokeWidth={2}
                                style={{ color: theme.colors.border || theme.colors.foreground, opacity: 0.4 }}
                            />
                        </div>
                    )}

                    {showGallery && (
                        <button
                            onClick={e => {
                                e.stopPropagation();
                                if (!previewMode) setIsFullScreenOpen(true);
                            }}
                            className="absolute top-4 right-4 z-20 bg-black/30 hover:bg-black/50 text-white p-2 rounded-full transition-colors backdrop-blur-md flex items-center gap-1 group/fs"
                            title="View Fullscreen"
                        >
                            <Maximize size={20} />
                            <span className="max-w-0 overflow-hidden group-hover/fs:max-w-xs transition-all duration-300 ease-out text-sm font-medium whitespace-nowrap pl-0 group-hover/fs:pl-1">
                                Fullscreen
                            </span>
                        </button>
                    )}

                    {mainImage ? (
                        <Image
                            src={mainImage}
                            alt={product.name}
                            fill
                            priority
                            sizes="(max-width: 768px) 100vw, 500px"
                            onLoad={() => setIsLoading(false)}
                            onError={() => setIsLoading(false)}
                            className={`object-cover transition-all duration-700 group-hover:scale-105 ${
                                isLoading ? 'opacity-0' : 'opacity-100'
                            }`}
                        />
                    ) : (
                        <div
                            className="flex items-center justify-center w-full h-full"
                            style={{ color: theme.colors.border || theme.colors.foreground, opacity: 0.4 }}
                        >
                            <ImageIcon className="w-16 h-16" />
                        </div>
                    )}

                    {/* Price Tag */}
                    {product.showPrice !== false && (
                        <div
                            className={[
                                'absolute bottom-4 right-4 z-20',
                                isBold
                                    ? 'px-4 py-2 rounded-xl border-2 font-black text-xl rotate-[-3deg] group-hover:rotate-0 transition-transform'
                                    : '',
                            ].join(' ')}
                            style={
                                isBold
                                    ? {
                                          backgroundColor: theme.colors.foreground,
                                          color: theme.colors.primary,
                                          borderColor: theme.colors.primary,
                                          boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                                          fontFamily: theme.fonts.heading,
                                      }
                                    : { fontFamily: theme.fonts.body }
                            }
                        >
                            {!isBold ? (
                                <div
                                    className="px-3 py-1.5 rounded-lg font-bold text-lg border shadow-sm backdrop-blur-md"
                                    style={{
                                        backgroundColor: `${theme.colors.surface || theme.colors.background}E6`,
                                        color: theme.colors.foreground,
                                        borderColor: theme.colors.border || theme.colors.foreground,
                                    }}
                                >
                                    {product.price}
                                </div>
                            ) : (
                                product.price
                            )}
                        </div>
                    )}
                </div>

                {/* Content */}
                <div className="text-center px-2 pb-2">
                    <h3
                        className={`mb-3 uppercase leading-none tracking-tight ${
                            !isBold ? 'font-bold text-2xl' : 'font-black text-3xl'
                        }`}
                        style={{ color: theme.colors.foreground, fontFamily: theme.fonts.heading }}
                    >
                        {product.name}
                    </h3>

                    <button
                        onClick={handleOrderClick}
                        className="w-full py-4 rounded-xl flex items-center justify-center gap-2 transition-all duration-300"
                        style={{
                            borderRadius: 'calc(var(--theme-radius) * 0.6)',
                            backgroundColor: isBold ? theme.colors.foreground : theme.colors.primary,
                            color: isBold ? theme.colors.background : primaryContrastColor,
                            border: isBold
                                ? `3px solid ${theme.colors.foreground}`
                                : `1px solid ${theme.colors.border || theme.colors.primary}`,
                            boxShadow: isBold
                                ? `4px 4px 0px 0px ${theme.colors.border}`
                                : '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                            fontWeight: isBold ? 800 : 700,
                            textTransform: isBold ? 'uppercase' : 'none',
                            letterSpacing: isBold ? '0.05em' : 'normal',
                            fontFamily: theme.fonts.heading,
                        }}
                    >
                        {buttonText} <ArrowRight size={24} strokeWidth={isBold ? 3 : 2} />
                    </button>
                </div>
            </div>

            {!previewMode && (
                <>
                    <ProductDetailModal
                        product={product}
                        isOpen={isModalOpen}
                        onClose={() => setIsModalOpen(false)}
                        phoneNumber={phoneNumber}
                        whatsappSettings={whatsappSettings}
                    />
                    <FullScreenGallery
                        isOpen={isFullScreenOpen}
                        images={images}
                        initialIndex={0}
                        onClose={() => setIsFullScreenOpen(false)}
                    />
                </>
            )}
        </div>
    );
}
```

- [ ] **Step 1.2: Verify TypeScript compiles**

```bash
cd clicker-platform-v2 && pnpm tsc --noEmit 2>&1 | grep -i "featuredproduct\|DefaultFeaturedProduct" | head -20
```

Expected: no errors referencing the new file.

- [ ] **Step 1.3: Commit**

```bash
git add clicker-platform-v2/components/blocks/public/DefaultFeaturedProductBlock.tsx
git commit -m "feat(blocks): add DefaultFeaturedProductBlock — typed, previewMode-safe, cardStyles-compliant"
```

---

## Task 2: Update `BlockRenderer.tsx`

**Files:**
- Modify: `clicker-platform-v2/components/blocks/BlockRenderer.tsx` lines 27 and 152–183

Replace the old import and the `featured_product` switch case to use the new component.

- [ ] **Step 2.1: Swap the import**

In `BlockRenderer.tsx`, find:
```typescript
const FeaturedProduct = dynamic(() => import('@/components/FeaturedProduct').then(mod => mod.FeaturedProduct));
```

Replace with:
```typescript
const FeaturedProductBlock = dynamic(() => import('./public/DefaultFeaturedProductBlock').then(mod => mod.DefaultFeaturedProductBlock));
```

- [ ] **Step 2.2: Update the switch case**

Find the entire `case 'featured_product':` block (lines 152–183):
```typescript
case 'featured_product':
    if (!featuredProduct) return null;
    const featuredSettings = productSettings || {};
    
    return customBlocks?.FeaturedProduct ? 
        React.createElement(customBlocks.FeaturedProduct, { 
            product: featuredProduct,
            badgeText: featuredSettings.featuredTitle || "Star Pick",
            showBadge: featuredSettings.showFeaturedTitle !== false,
            buttonText: featuredSettings.featuredBtnText || "Order This Now",
            phoneNumber: contact?.whatsapp,
            whatsappSettings: {
                label: featuredSettings.whatsappBtnLabel,
                messageTemplate: featuredSettings.whatsappMessageTemplate,
                bgColor: featuredSettings.whatsappBtnColor,
                textColor: featuredSettings.whatsappBtnTextColor
            }
        }) : (
        <FeaturedProduct
            product={featuredProduct}
            badgeText={featuredSettings.featuredTitle || "Star Pick"}
            showBadge={featuredSettings.showFeaturedTitle !== false}
            buttonText={featuredSettings.featuredBtnText || "Order This Now"}
            phoneNumber={contact?.whatsapp}
            whatsappSettings={{
                label: featuredSettings.whatsappBtnLabel,
                messageTemplate: featuredSettings.whatsappMessageTemplate,
                bgColor: featuredSettings.whatsappBtnColor,
                textColor: featuredSettings.whatsappBtnTextColor
            }}
        />
    );
```

Replace with:
```typescript
case 'featured_product': {
    if (!featuredProduct) return null;
    const featuredSettings = productSettings || {};
    const featuredProps = {
        product: featuredProduct,
        theme,
        previewMode,
        badgeText: featuredSettings.featuredTitle || 'Star Pick',
        showBadge: featuredSettings.showFeaturedTitle !== false,
        buttonText: featuredSettings.featuredBtnText || 'Order This Now',
        phoneNumber: contact?.whatsapp,
        whatsappSettings: {
            label: featuredSettings.whatsappBtnLabel,
            messageTemplate: featuredSettings.whatsappMessageTemplate,
            bgColor: featuredSettings.whatsappBtnColor,
            textColor: featuredSettings.whatsappBtnTextColor,
        },
    };
    return customBlocks?.FeaturedProduct
        ? React.createElement(customBlocks.FeaturedProduct, featuredProps)
        : <FeaturedProductBlock {...featuredProps} />;
}
```

- [ ] **Step 2.3: Verify TypeScript compiles**

```bash
cd clicker-platform-v2 && pnpm tsc --noEmit 2>&1 | grep -i "BlockRenderer\|featuredproduct" | head -20
```

Expected: no errors.

- [ ] **Step 2.4: Commit**

```bash
git add clicker-platform-v2/components/blocks/BlockRenderer.tsx
git commit -m "feat(blocks): wire DefaultFeaturedProductBlock into BlockRenderer with theme + previewMode"
```

---

## Task 3: Delete legacy files

**Files:**
- Delete: `clicker-platform-v2/components/FeaturedProduct.tsx`
- Delete: `clicker-platform-v2/legacy/components/FeaturedProduct.tsx`

- [ ] **Step 3.1: Confirm no remaining imports of the old path**

```bash
grep -rn "components/FeaturedProduct\|legacy/components/FeaturedProduct" /Users/andre/Repository/clicker-universe/dev/clicker-platform-v2 --include="*.tsx" --include="*.ts" | grep -v node_modules | grep -v .next
```

Expected: zero results (only if Task 2 is complete).

- [ ] **Step 3.2: Delete both files**

```bash
rm clicker-platform-v2/components/FeaturedProduct.tsx
rm clicker-platform-v2/legacy/components/FeaturedProduct.tsx
```

- [ ] **Step 3.3: Verify TypeScript still compiles cleanly**

```bash
cd clicker-platform-v2 && pnpm tsc --noEmit 2>&1 | head -30
```

Expected: no errors (or only pre-existing unrelated errors).

- [ ] **Step 3.4: Commit**

```bash
git add -u clicker-platform-v2/components/FeaturedProduct.tsx clicker-platform-v2/legacy/components/FeaturedProduct.tsx
git commit -m "chore: delete legacy FeaturedProduct — replaced by DefaultFeaturedProductBlock"
```

---

## Self-Review

**Spec coverage check:**

| Audit issue | Addressed in |
|-------------|-------------|
| Wrong file location | Task 1 (new file), Task 3 (delete old) |
| Missing `previewMode` guard | Task 1 — `if (previewMode) return;` in handler, modals gated |
| `useSite()` unused import | Task 1 — removed entirely |
| `useTemplate()` instead of prop | Task 1 — accepts `theme` prop, falls back to context |
| Not following `Default*` convention | Task 1 — named `DefaultFeaturedProductBlock` |
| `Sparkles` icon | Task 1 — replaced with `Star` |
| Duplicate comment | Task 1 — single clean comment |
| `(product as any).showPrice` cast | Task 1 — uses typed `product.showPrice` (field exists on `Product`) |
| `whatsappSettings?: any` | Task 1 — inline typed `WhatsAppSettings` interface |
| Duplicates `cardStyles.ts` | Task 1 — uses `getCardClasses()` + `getGlassStyle()` |
| `theme` + `previewMode` not passed from BlockRenderer | Task 2 — both wired |
| Legacy file deletion | Task 3 |

**Placeholder scan:** No TBDs, no "similar to Task N" references, all code blocks are complete.

**Type consistency:** `WhatsAppSettings` interface defined in Task 1 and used in the same file only. `BlockRenderer` passes an anonymous object matching that shape — no mismatch.
