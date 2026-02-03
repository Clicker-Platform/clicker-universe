# Public Page LCP Optimization Analysis

## Executive Summary
**Target Page**: `http://localhost:3000/interior` (Public Facing)
**Current Performance Status**:
- **Lighthouse Score**: 38/100 (Critical)
- **LCP (Largest Contentful Paint)**: 11.2s (Target: < 2.5s)
- **Overall Assessment**: Performance is currently "awful", primarily driven by slow loading of the main content (LCP) and excessive script execution.

## Problem Identification

### 1. High LCP (11.2s)
The Largest Contentful Paint is taking 11.2 seconds, which is significantly above the recommended threshold. 
**Likely Contributors**:
- **Client-Side Data Fetching**: The page likely waits for JavaScript to load, execute, and then fetch data before rendering the main hero/banner content. This creates a "waterfall" effect.
- **Image Optimization**: Large unoptimized images or lack of priority loading for the LCP element (e.g., Hero image).
- **Hydration Delays**: Heavy client-side React components blocking the main thread.

### 2. Excessive "Unused JS"
Lighthouse flagged a large amount of unused JavaScript.
**Likely Contributors**:
- Sending code for components that aren't immediately visible or needed.
- Heavy libraries included in the main bundle.
- Lack of code splitting for modular blocks.

### 3. Architecture Issues
- **Heavy Client Components**: Key UI blocks (like `HeroBlock` or `ProductsBlock`) might be implemented as Client Components (`"use client"`) unnecessarily, forcing the browser to download and execute all their logic before painting.

## Optimization Strategy

To resolve these issues and improve the Lighthouse score, we will adopt a **Server-First** approach.

### Phase 1: Architecture Shift (Server Components)
- **Goal**: Move as much logic as possible to the Server.
- **Action**: Convert `HeroBlock` and other initial viewport blocks from Client Components to **Server Components (RSC)**.
  - *Benefit*: HTML is generated on the server and sent ready-to-render. No client-side fetch waterfall for initial data.
  - *Benefit*: Reduces JS bundle size (less hydration work).

### Phase 2: Data Fetching Optimization
- **Goal**: Eliminate client-side waterfalls.
- **Action**: Move data fetching to the Page level (Server Component) or use RSC data fetching directly in blocks.
- **Action**: Implement preloading for critical assets (e.g., distinct `fetch` priorities).

### Phase 3: Asset Optimization
- **Goal**: Speed up resource loading.
- **Action**: Ensure the Hero image uses `priority` prop (Next.js Image) and has correct `sizes`.
- **Action**: Verify font loading strategy.

### Phase 4: Code Splitting
- **Action**: Use `dynamic` imports for below-the-fold components or heavy interactive elements that are not part of LCP.

## Expected Outcome
- **LCP**: Reduction from 11.2s to < 2.5s (Green zone).
- **Lighthouse Score**: Improvement to > 90.
- **UX**: Initial paint should be almost instantaneous with server-rendered HTML.
