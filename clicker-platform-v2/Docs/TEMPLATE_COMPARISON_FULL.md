# Clicker App Template Comparison Matrix

This document provides a comprehensive comparison of all four system templates, detailing their visual identities, layout behaviors, and intended use cases.

| Feature | ☀️ Sunnyside (Classic) | 🧊 Modern | 🌍 Sojourner | 🏗️ Shuvo |
| :--- | :--- | :--- | :--- | :--- |
| **Vibe** | Vibrant, Playful, Brutalist | Clean, Structured, Tech | Professional, Soft, Trustworthy | Architectural, Minimalist, High Contrast |
| **Primary Use Case** | Content Creators, Personal Brands | Agencies, SaaS, Tech Portfolios | Travel, Hospitality, Corporate | Real Estate, Architects, High-End Portfolio |
| **Layout Width** | **Narrow** (Mobile-First) | **Boxed** (Web App Style) | **Full Width** (Immersive) | **Tablet** (Wide Canvas) |
| **Nav Mode** | Mobile Only | Adaptive | Adaptive | Adaptive (with Bottom Nav) |

## 1. Visual Identity

| Property | Sunnyside | Modern | Sojourner | Shuvo |
| :--- | :--- | :--- | :--- | :--- |
| **Primary Color** | Neon Green (`#B6FF2E`) | Bright Yellow (`#FFD400`) | Tripadvisor Green (`#00AA6C`) | Sharp Black (`#1A1A1A`) |
| **Background** | Green (`#B6FF2E`) + **Decorations** | White (`#FFFFFF`) | Soft Gray (`#F5F7FA`) | Stone White (`#F5F5F0`) |
| **Card Style** | **Brutalist** (Thick borders) | **Shadow** (Clean lift) | **Outlined** (Subtle border) | **Flat** (Zero elevation) |
| **Typography** | Jakarta Sans (Modern) | Space Mono (Monospace) | Inter (Standard) | Playfair Display (Serif) |
| **Border Radius** | Extra Round (`1.5rem`) | Standard (`1rem`) | Standard (`1rem`) | Standard (`1rem`) |

## 2. Grid & Layout System
*How content blocks flow on different screens.*

| Breakpoint | Sunnyside | Modern | Sojourner | Shuvo |
| :--- | :--- | :--- | :--- | :--- |
| **Desktop** | **1 Column** (Stacked) | **3 Columns** (Grid) | **4 Columns** (Dense) | **1 Column** (Wide) |
| **Tablet** | 1 Column | 2 Columns | 2 Columns | 1 Column |
| **Mobile** | 1 Column | 1 Column | 1 Column | 1 Column |
| **Gap** | `gap-4` (Standard) | `gap-6` (Airy) | `gap-8` (Spacious) | `gap-4` (Standard) |

> **Note on Shuvo**: While technically a "1 Column" grid on desktop, Shuvo uses a "Single Column Fix" to ensure blocks like Heroes stretch full width, mimicking a website landing page rather than a grid of cards.

## 3. Header & Navigation

### Components
- **Sunnyside**: `ClassicProfileHeader` (Centered, Avatar focused)
- **Modern**: `ModernProfileHeader` (Left-aligned, clean, banner supported)
- **Sojourner**: `ModernProfileHeader` (Reused, clean layout)
- **Shuvo**: `ShuvoHeader` (Magazine style, large text, star badge)

### Navigation Behavior
- **Sunnyside**: Simple list at the bottom of the profile. No top bar.
- **Modern & Sojourner**: "Adaptive" - Top bar on Desktop, standard mobile view.
- **Shuvo**: "Adaptive" + **Bottom Bar** (App-like persistent validation).

## Summary & Recommendations

- Choose **Sunnyside** if you want high energy and a "Linktree" feel.
- Choose **Modern** if you have a lot of content and want a structured dashboard look.
- Choose **Sojourner** if you need a safe, professional look for a business.
- Choose **Shuvo** if you want to impress with a specialized, design-forward landing page (e.g. for selling a property or a luxury service).
