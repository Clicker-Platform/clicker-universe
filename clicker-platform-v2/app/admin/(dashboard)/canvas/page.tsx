'use client';

import { Loader2 } from 'lucide-react';
import { PageStudioProvider, usePageStudio } from '@/components/admin/blocks/PageStudioContext';
import { EditorProvider } from '@/components/admin/blocks/EditorContext';
import { CanvasStudio } from '@/components/admin/blocks/CanvasStudio';
import { StudioTopBarSlot } from '@/components/admin/blocks/StudioTopBarSlot';
import { ConfirmationDialog } from '@/components/common/ConfirmationDialog';
import { useState } from 'react';


function PageStudioInner() {
    const {
        formData,
        setBlocks,
        globalSettings,
        pagesLoading,
        activePageId,
        pendingSwitch,
        confirmDiscard,
        confirmSaveAndSwitch,
        cancelSwitch,
        setContent,
        deletePage,
    } = usePageStudio();

    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    if (pagesLoading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <Loader2 className="animate-spin text-brand-dark" size={32} />
            </div>
        );
    }

    // h-[calc(100dvh-57px)] accounts for the md:hidden mobile admin header on small screens.
    // On md+ we subtract the shared AdminTopBar height (h-12 = 48px).
    return (
        <div className="-m-4 md:-m-8 flex flex-col overflow-hidden h-[calc(100dvh-57px)] md:h-[calc(100dvh-48px)]">
            {/* Legacy HTML warning */}
            {activePageId && formData.content && formData.blocks.length === 0 && (
                <div className="mx-4 md:mx-8 mt-4 md:mt-8 bg-amber-50 p-4 rounded-lg border border-amber-200">
                    <h3 className="font-bold text-amber-800 mb-2">Legacy HTML Content Detected</h3>
                    <p className="text-sm text-amber-700 mb-4">This page was built with the old editor. You can clear it to start using the new Block Builder.</p>
                    <button type="button" onClick={() => setContent('')} className="text-xs font-bold text-red-600 hover:underline">
                        Clear Legacy Content & Use Blocks
                    </button>
                </div>
            )}

            <EditorProvider blocks={formData.blocks} onChange={setBlocks}>
                <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
                    <StudioTopBarSlot />
                    <div className="flex-1 min-h-0 flex">
                        <CanvasStudio
                            globalSettings={globalSettings}
                            pageSlug={formData.slug}
                            pageTitle={formData.title}
                        />
                    </div>
                </div>
            </EditorProvider>

            {/* Unsaved changes dialog */}
            <ConfirmationDialog
                isOpen={!!pendingSwitch}
                title="Unsaved Changes"
                message="You have unsaved changes. What would you like to do?"
                onConfirm={confirmSaveAndSwitch}
                onCancel={cancelSwitch}
                confirmLabel="Save & Switch"
                cancelLabel="Cancel"
                isDestructive={false}
            >
                <button
                    type="button"
                    onClick={confirmDiscard}
                    className="w-full px-4 py-2.5 rounded-lg font-bold text-red-600 hover:bg-red-50 transition-colors mb-2"
                >
                    Discard Changes
                </button>
            </ConfirmationDialog>

            {/* Delete page dialog */}
            <ConfirmationDialog
                isOpen={deleteDialogOpen}
                title="Delete Page"
                message="Are you sure you want to delete this page? This action cannot be undone."
                onConfirm={async () => {
                    setIsDeleting(true);
                    await deletePage();
                    setIsDeleting(false);
                    setDeleteDialogOpen(false);
                }}
                onCancel={() => setDeleteDialogOpen(false)}
                isLoading={isDeleting}
            />
        </div>
    );
}

// Read pageId once from the URL at mount time — avoids useSearchParams() which
// would wrap the tree in a Suspense boundary and cause full remounts on any
// state change (the root cause of blocks disappearing after being added).
function getInitialPageId(): string | null {
    if (typeof window === 'undefined') return null;
    return new URL(window.location.href).searchParams.get('pageId');
}

export default function PageStudioPage() {
    const [initialPageId] = useState(getInitialPageId);

    return (
        <PageStudioProvider initialPageId={initialPageId}>
            <PageStudioInner />
        </PageStudioProvider>
    );
}
