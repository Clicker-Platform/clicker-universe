'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2, AlertCircle } from 'lucide-react';
import { PageStudioProvider, usePageStudio } from '@/components/admin/blocks/PageStudioContext';
import { EditorProvider } from '@/components/admin/blocks/EditorContext';
import { CanvasStudio } from '@/components/admin/blocks/CanvasStudio';
import { StudioTopBar } from '@/components/admin/blocks/StudioTopBar';
import { ConfirmationDialog } from '@/components/common/ConfirmationDialog';
import { useState } from 'react';


function PageStudioInner() {
    const {
        formData,
        setBlocks,
        globalSettings,
        pagesLoading,
        error,
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

    return (
        <div className="-m-4 md:-m-8">
            {error && (
                <div className="mx-4 md:mx-8 mt-4 md:mt-8 mb-0 p-4 bg-red-50 text-red-700 rounded-xl flex items-center gap-2 border border-red-200">
                    <AlertCircle size={20} />
                    {error}
                </div>
            )}

            {/* Legacy HTML warning */}
            {activePageId && formData.content && formData.blocks.length === 0 && (
                <div className="mx-4 md:mx-8 mt-4 md:mt-8 bg-amber-50 p-4 rounded-xl border border-amber-200">
                    <h3 className="font-bold text-amber-800 mb-2">Legacy HTML Content Detected</h3>
                    <p className="text-sm text-amber-700 mb-4">This page was built with the old editor. You can clear it to start using the new Block Builder.</p>
                    <button type="button" onClick={() => setContent('')} className="text-xs font-bold text-red-600 hover:underline">
                        Clear Legacy Content & Use Blocks
                    </button>
                </div>
            )}

            <EditorProvider blocks={formData.blocks} onChange={setBlocks}>
                <div className="flex flex-col h-screen">
                    <StudioTopBar />
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

function PageStudioWithParams() {
    const searchParams = useSearchParams();
    const pageId = searchParams.get('pageId');

    return (
        <PageStudioProvider initialPageId={pageId}>
            <PageStudioInner />
        </PageStudioProvider>
    );
}

export default function PageStudioPage() {
    return (
        <Suspense fallback={
            <div className="flex h-64 items-center justify-center">
                <Loader2 className="animate-spin text-brand-dark" size={32} />
            </div>
        }>
            <PageStudioWithParams />
        </Suspense>
    );
}
