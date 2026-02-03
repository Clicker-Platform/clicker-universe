
import { db } from '../clicker-platform/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

const SITE_ID = 'quattro';
const PAGE_ID = 'home'; // Since we saw the document path was sites/quattro/pages/home, ID is likely 'home' or auto-id with slug home?
// Step 4191 showed path: sites/quattro/pages/home. So ID is 'home'.

async function fixPage() {
    console.log(`Fixing page ${PAGE_ID} for site ${SITE_ID}...`);

    // 1. Get current page
    const pageRef = doc(db, 'sites', SITE_ID, 'pages', PAGE_ID);
    const snap = await getDoc(pageRef);

    if (!snap.exists()) {
        console.error("Page not found!");
        return;
    }

    const data = snap.data();
    // Use explicit any for blocks array
    let blocks: any[] = data.blocks || [];

    console.log("Current blocks:", blocks.map(b => b.type));

    // 2. Check if blocks already exist
    const hasQuickActions = blocks.some(b => b.type === 'quick_actions');
    const hasProductGallery = blocks.some(b => b.type === 'product_gallery');

    if (hasQuickActions && hasProductGallery) {
        console.log("Blocks already exist. No changes needed.");
        return;
    }

    // 3. Add missing blocks
    const newBlocks = [...blocks];

    if (!hasQuickActions) {
        const quickActionsBlock = {
            id: 'quick-actions-auto',
            type: 'quick_actions',
            data: {}, // Valid since we use context
        };
        // Insert at index 1 (after Hero)
        newBlocks.splice(1, 0, quickActionsBlock);
        console.log("Added Quick Actions block.");
    }

    if (!hasProductGallery) {
        const galleryBlock = {
            id: 'product-gallery-auto',
            type: 'product_gallery',
            data: {
                title: "Our Menu",
                itemsToShow: 6,
                showSectionTitle: true
            }
        };
        newBlocks.push(galleryBlock);
        console.log("Added Product Gallery block.");
    }

    // 4. Update
    await updateDoc(pageRef, {
        blocks: newBlocks
    });

    console.log("Page updated successfully!");
}

fixPage().then(() => process.exit(0)).catch(e => {
    console.error(e);
    process.exit(1);
});
