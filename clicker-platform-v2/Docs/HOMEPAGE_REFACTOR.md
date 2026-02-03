# Homepage Refactor - Walkthrough

We have successfully refactored the homepage (`app/page.tsx`) to support the new Modular System and CMS-driven content (Blocks).

## Logic Overview

The homepage now follows this strict order of precedence to determine what to render:

1.  **Module Routing**
    *   **Check**: Does any active module have a public route matching `/`?
    *   **Action**: If yes, render that module using `<ModuleLoader />`.
    *   **Use Case**: A dedicated "Landing Page Module" or specialized "POS Kiosk Mode" that takes over the entire homepage.

2.  **Configured CMS Homepage**
    *   **Check**: Does `siteSettings.homepageSlug` exist? If not, default to `home`.
    *   **Action**: Look for a page with that slug. If found, render it using the Block System.
    *   **Use Case**: You can designate *any* page (e.g., `landing`, `promo`) as your homepage by configuring the **Homepage Slug** in **Admin > Settings**.

3.  **Legacy Fallback (Default)**
    *   **Check**: If neither of the above matches.
    *   **Action**: Render the existing `PublicPageRenderer`.
    *   **Use Case**: Preserves the current hardcoded layout until you are ready to switch content.

## How to Activate Custom Homepage

To switch from the Legacy Homepage to a Custom Block Homepage:

1.  Go to the **Admin Panel > Pages**.
2.  Create a New Page.
3.  Set the **Slug** to `home` (or whatever you configured in Site Settings).
4.  Add your desired blocks (Hero, Text, Products, etc.).
5.  **Publish** the page.
6.  Navigate to `/` to see your new homepage.

To revert, simply **delete** or change the slug of the page so it no longer matches the configured homepage slug.
