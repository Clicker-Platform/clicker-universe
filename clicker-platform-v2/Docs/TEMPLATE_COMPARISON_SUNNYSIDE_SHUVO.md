# Template Comparison: Sunnyside vs. Shuvo

This document outlines the key differences between the **Sunnyside (Classic)** template and the **Shuvo** template.

## High-Level Overview

| Feature | Sunnyside (Classic) | Shuvo |
| :--- | :--- | :--- |
| **Vibe** | Vibrant, Playful, Brutalist | Minimalist, Architectural, High Contrast |
| **Primary Use Case** | Content Creators, Personal Brands | Real Estate, Professional Portfolios |
| **Header Style** | Center-aligned, simple avatar | Left-aligned, large avatar + decorative star |
| **Navigation** | Mobile-only (simplified) | Adaptive (Top + Bottom Bar on Mobile) |

## Detailed Breakdown

### 1. Visual Style (Theme Config)

| Property | Sunnyside | Shuvo |
| :--- | :--- | :--- |
| **Colors** | Neon Green (`#B6FF2E`) & Dark Green (`#0E3B2E`) | Stone White (`#F5F5F0`) & Sharp Black (`#1A1A1A`) |
| **Card Style** | **Brutalist** (Thick borders, heavy shadows)<br>`border-width: 3px` | **Flat / Clean** (Subtle or no borders)<br>`border-width: 1px` or `0` |
| **Typography** | **Plus Jakarta Sans** (Modern Sans) | **Playfair Display** (Serif Heading) + Jakarta (Body) |
| **Border Radius** | Extra Rounded (`1.5rem`) | Standard Rounded (`1rem`) |
| **Background** | **Decorated** (Croissant, Coffee icons floating) | **Clean** (Solid color only) |

### 2. Layout & Grid Behavior

| Property | Sunnyside | Shuvo |
| :--- | :--- | :--- |
| **Container Width** | `narrow` (~480px, mobile focused) | `tablet` (~768px, wider canvas) |
| **Desktop Grid** | **1 Column** (Stacked list) | **1 Column** (Stacked list, wide cards) |
| **Navigation** | `mobile-only` (Simple bottom list) | `adaptive` (Top bar on desktop, Bottom bar on mobile) |
| **Bottom Bar** | Standard | Explicitly Enabled (`showBottomNav: true`) |

### 3. Header Component

- **Sunnyside (`ClassicProfileHeader`)**:
    - Centered layout.
    - Avatar is moderate size.
    - Tagline is `outline` style (transparent with border).
    - Designed for quick scanning of links.

- **Shuvo (`ShuvoHeader`)**:
    - Left-aligned "Magazine" layout.
    - Large Avatar (96px+) with a decorative **Star Icon** badge.
    - Name is uppercase, heavy font weight.
    - Tagline is `contrast` style (solid block color).
    - Includes **Address/Location** display (MapPin icon).

### 4. Special Features

- **Shuvo Exclusive**: 
    - **Single Column Fix**: Explicitly overrides grid behavior to ensure wide blocks like "Hero" or "Gallery" take up full width properly without distinct "columns".
    - **Custom Config**: Has specific tweaks for `heroHeight` and `cardOpacity` to support its architectural look.

## Summary

**Sunnyside** is your "link-in-bio" powerhouse: simple, fun, and focused on clicking buttons.
**Shuvo** is a "mini-website" builder: it feels more like a landing page with a structure designed to showcase imagery and professional details (like real estate listings or portfolio items).
