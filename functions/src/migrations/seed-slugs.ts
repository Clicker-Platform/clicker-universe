/**
 * Migration Script: Seed Slugs for Existing Sites
 * 
 * Run this once to initialize slugs for all existing sites.
 * Can be executed from Firebase Functions or locally via Node.
 */

import { db } from '../lib/firebase-admin';
import { generateSlug } from '../lib/slug-utils-server';

interface SiteMigrationResult {
    siteId: string;
    slug: string;
    status: 'success' | 'error';
    error?: string;
}

/**
 * Seed slugs for all existing sites
 */
export async function seedSlugsForExistingSites(): Promise<SiteMigrationResult[]> {
    const results: SiteMigrationResult[] = [];

    try {
        console.log('[Migration] Starting slug seeding for existing sites...');

        // Get all sites
        const sitesSnapshot = await db.collection('sites').get();

        console.log(`[Migration] Found ${sitesSnapshot.size} sites`);

        for (const siteDoc of sitesSnapshot.docs) {
            const siteId = siteDoc.id;

            try {
                // Get site settings
                const settingsDoc = await siteDoc.ref.collection('settings').doc('general').get();

                if (!settingsDoc.exists) {
                    console.warn(`[Migration] No settings found for site: ${siteId}`);
                    results.push({
                        siteId,
                        slug: '',
                        status: 'error',
                        error: 'No settings document'
                    });
                    continue;
                }

                const settings = settingsDoc.data();

                // Check if slug already exists
                if (settings?.slug) {
                    console.log(`[Migration] Site ${siteId} already has slug: ${settings.slug}`);
                    results.push({
                        siteId,
                        slug: settings.slug,
                        status: 'success'
                    });
                    continue;
                }

                // Generate slug from business name or siteId
                const businessName = settings?.profile?.name;
                let slug: string;

                if (businessName) {
                    slug = generateSlug(businessName);
                } else {
                    // Fallback: use siteId as slug (sanitized)
                    slug = siteId.replace(/[^a-z0-9-]/gi, '-').toLowerCase();
                }

                // Ensure slug is unique (add suffix if needed)
                let finalSlug = slug;
                let counter = 1;
                while (await slugExists(finalSlug, siteId)) {
                    finalSlug = `${slug}-${counter}`;
                    counter++;
                }

                // Update settings document
                await settingsDoc.ref.update({
                    slug: finalSlug,
                    slugHistory: [],
                    slugUpdatedAt: new Date().toISOString()
                });

                // Create slug mapping
                await db.collection('slugMappings').doc(finalSlug).set({
                    siteId,
                    isActive: true,
                    createdAt: new Date().toISOString()
                });

                console.log(`[Migration] ✓ ${siteId} → ${finalSlug}`);

                results.push({
                    siteId,
                    slug: finalSlug,
                    status: 'success'
                });

            } catch (error: any) {
                console.error(`[Migration] Error processing site ${siteId}:`, error);
                results.push({
                    siteId,
                    slug: '',
                    status: 'error',
                    error: error.message
                });
            }
        }

        console.log('[Migration] Slug seeding completed!');
        console.log(`Success: ${results.filter(r => r.status === 'success').length}`);
        console.log(`Errors: ${results.filter(r => r.status === 'error').length}`);

        return results;

    } catch (error) {
        console.error('[Migration] Fatal error:', error);
        throw error;
    }
}

/**
 * Check if slug already exists in slugMappings
 */
async function slugExists(slug: string, excludeSiteId?: string): Promise<boolean> {
    const mappingDoc = await db.collection('slugMappings').doc(slug).get();

    if (!mappingDoc.exists) {
        return false;
    }

    // Allow if it's the same site
    return mappingDoc.data()?.siteId !== excludeSiteId;
}

/**
 * CLI runner (if executed directly)
 */
if (require.main === module) {
    seedSlugsForExistingSites()
        .then((results) => {
            console.log('\n=== Migration Results ===');
            console.table(results);
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n=== Migration Failed ===');
            console.error(error);
            process.exit(1);
        });
}
