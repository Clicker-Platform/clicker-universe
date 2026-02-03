# System Features & Capabilities

## Overview
The platform is built on a **Modular Architecture** using Next.js and Firebase. It is designed to be extensible, allowing different business functions (Modules) to be enabled or disabled as needed.

## Core Capabilities

### 1. Dynamic Page Builder (CMS)
The system includes a robust Content Management System (CMS) that allows Admins to build and manage pages using "Blocks".
*   **Block Editor**: Intuitive admin interface to manage page content.
*   **Available Blocks**:
    *   **Hero**: Main banner with title, subtitle, and CTA.
    *   **Image Gallery**: Grid or carousel of images.
    *   **FAQ**: Frequently Asked Questions accordion.
    *   **Map**: Google Maps integration.
    *   **Products Grid**: Display items from the POS/Menu module.
    *   **Button / Link**: Call-to-action elements.
    *   **Text / HTML**: Rich text content.
*   **Dynamic Data**: Some blocks (like Product Grid) fetch data dynamically from active modules.

### 2. Admin Dashboard
*   **Modular Sidebar**: Navigation dynamically adjusts based on enabled modules.
*   **Unified Interface**: Consistent UI for managing different parts of the system.

## Modules

### 1. Reservation & Booking System (`reservation`)
A complete solution for service-based businesses.
*   **Detailed Booking Widget**: Public-facing widget for selecting services, staff, and time slots.
*   **Staff Management**: Manage staff members, their roles, and availability.
*   **Service Catalog**: Define services with duration and pricing.
*   **Calendar View**: Admin view to manage appointments.
*   **Waitlist**: Support for waitlisting when slots are full.

### 2. Point of Sale (POS) (`byod_pos`)
A "Bring Your Own Device" POS system.
*   **Order Management**: Admin interface to view and manage incoming orders.
*   **Menu Management**: Create and categorize menu items (products).
*   **Public Order Page**: Customer-facing page to browse the menu and place orders.
*   **Cart System**: Client-side cart management.

### 3. Inventory Management (`inventory`)
*   **Stock Tracking**: Basic tracking of item quantities.
*   **Transaction Logs**: History of inventory movements (implied by `inventory_transactions`).

## Technical Highlights
*   **Framework**: Next.js 14+ (App Router).
*   **Database**: Firebase Firestore (NoSQL).
*   **Authentication**: Integrated Firebase Auth (implied by context).
*   **State Management**: React Context + Firestore real-time listeners.
*   **Styling**: Tailwind CSS & Shadcn UI (inferred from `components/ui` references common in this stack).

## Marketing Landing Page Assets
For the marketing page you are building, you have access to:
*   **Hero Sections**: Ready-to-use components.
*   **Feature Showcases**: Using the Image Gallery or Text blocks.
*   **Live Demos**: You can embed the **Reservation Widget** or **Menu Grid** directly on the landing page to demonstrate the platform's capabilities to potential clients.
