'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc, writeBatch, setDoc, getDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { LinkItem, Form, Page } from '@/data/mockData';
import { Trash2, Plus, GripVertical, Pencil, Search, FileText, Link as LinkIcon, EyeOff, Settings, Loader2, ExternalLink, RotateCcw, ChevronDown, ChevronRight } from 'lucide-react';
import { IconSelector } from '@/components/admin/IconSelector';
import { ICON_MAP } from '@/data/icons';
import { toast } from 'sonner';
import { useSite } from '@/lib/site-context';
import { useUser } from '@/lib/user-context';
import { usePageStudio } from '@/components/admin/blocks/PageStudioContext';
import { ConfirmationDialog } from '@/components/common/ConfirmationDialog';
import { purgeTenantCache } from '@/lib/admin/purgeCache';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { SelectMenu } from '../forms/SelectMenu';

// ── Types ────────────────────────────────────────────────────────────────

interface AdminLinkItem extends Omit<LinkItem, 'icon'> {
    iconName: string;
    order?: number;
    pageId?: string;
    deletedAt?: Timestamp | null;
}

// ── Shared styles ────────────────────────────────────────────────────────

const inputClass = "w-full px-3 py-2 bg-gray-100 dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 rounded-lg text-sm text-neutral-900 dark:text-neutral-200 placeholder-neutral-400 dark:placeholder-neutral-600 focus:border-blue-500/50 focus:outline-none transition-colors";
const labelClass = "block text-xs font-medium text-neutral-400 dark:text-neutral-500 mb-1";

// ── Sortable Link Item ───────────────────────────────────────────────────

function SortableLinkItem({ link, onEdit, onDelete, canWrite }: { link: AdminLinkItem; onEdit: (l: AdminLinkItem) => void; onDelete: (id: string) => void; canWrite: boolean }) {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: link.id });
    const [confirmDelete, setConfirmDelete] = useState(false);

    const style = { transform: CSS.Transform.toString(transform), transition };

    const IconComponent = link.iconName && ICON_MAP[link.iconName] ? ICON_MAP[link.iconName] : LinkIcon;

    return (
        <div ref={setNodeRef} style={style} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 dark:hover:bg-neutral-800/50 rounded-lg group transition-colors">
            <div
                {...(canWrite && !confirmDelete ? { ...attributes, ...listeners } : {})}
                className={`p-1 text-neutral-400 dark:text-neutral-600 flex-shrink-0 ${canWrite ? 'cursor-grab active:cursor-grabbing hover:text-neutral-700 dark:hover:text-neutral-400' : 'cursor-not-allowed opacity-30'}`}
            >
                <GripVertical size={14} />
            </div>

            <div className="w-7 h-7 bg-gray-100 dark:bg-neutral-800 rounded-md flex items-center justify-center text-neutral-500 dark:text-neutral-400 flex-shrink-0">
                <IconComponent size={14} />
            </div>

            <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-neutral-900 dark:text-neutral-200 truncate">{link.title}</div>
                <div className="flex items-center gap-1.5 mt-0.5">
                    {link.type === 'form' && (
                        <span className="px-1 py-0.5 rounded text-[9px] font-bold bg-purple-500/20 text-purple-400 uppercase">Form</span>
                    )}
                    {link.type === 'page' && (
                        <span className="px-1 py-0.5 rounded text-[9px] font-bold bg-blue-500/20 text-blue-400 uppercase">Page</span>
                    )}
                    {link.hideOnHome && (
                        <span className="px-1 py-0.5 rounded text-[9px] font-bold bg-gray-200 dark:bg-neutral-700 text-neutral-500 uppercase flex items-center gap-0.5">
                            <EyeOff size={8} /> Hidden
                        </span>
                    )}
                    {link.type === 'url' && link.url && (
                        <span className="text-[10px] text-neutral-400 dark:text-neutral-600 truncate max-w-[180px]">{link.url}</span>
                    )}
                </div>
            </div>

            {canWrite && (
                confirmDelete ? (
                    <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                            onClick={() => { setConfirmDelete(false); onDelete(link.id); }}
                            className="px-2 py-1 text-[10px] font-bold text-red-400 bg-red-500/10 border border-red-500/30 rounded-md hover:bg-red-500/20 transition-colors"
                        >
                            Confirm
                        </button>
                        <button
                            onClick={() => setConfirmDelete(false)}
                            className="px-2 py-1 text-[10px] font-bold text-neutral-500 dark:text-neutral-400 bg-gray-100 dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 rounded-md hover:bg-gray-200 dark:hover:bg-neutral-700 transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                ) : (
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                        <button onClick={() => onEdit(link)} className="p-1.5 text-neutral-400 dark:text-neutral-500 hover:text-blue-400 hover:bg-gray-200 dark:hover:bg-neutral-700 rounded-md transition-colors">
                            <Pencil size={13} />
                        </button>
                        <button onClick={() => setConfirmDelete(true)} className="p-1.5 text-neutral-400 dark:text-neutral-500 hover:text-red-400 hover:bg-gray-200 dark:hover:bg-neutral-700 rounded-md transition-colors">
                            <Trash2 size={13} />
                        </button>
                    </div>
                )
            )}
        </div>
    );
}

// ── Main LinksPanel ──────────────────────────────────────────────────────

export function LinksPanel() {
    const { siteId } = useSite();
    const { canEdit } = useUser();
    const canWrite = canEdit('content', 'links');
    const { refreshHydratedData, linksVersion, bumpLinksVersion } = usePageStudio();
    const [links, setLinks] = useState<AdminLinkItem[]>([]);
    const [forms, setForms] = useState<Form[]>([]);
    const [pages, setPages] = useState<Page[]>([]);
    const [loading, setLoading] = useState(true);

    // Form state
    const [showForm, setShowForm] = useState(false);
    const [newLink, setNewLink] = useState<Partial<AdminLinkItem>>({
        title: '', subtitle: '', url: '', iconName: 'ShoppingBag', type: 'url', formId: '', pageId: '', hideOnHome: false, openInNewTab: false
    });
    const [editingId, setEditingId] = useState<string | null>(null);
    const [showIconSelector, setShowIconSelector] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Settings state
    const [showSettings, setShowSettings] = useState(false);
    const [settings, setSettings] = useState<{ sectionTitle: string; showOnHome: boolean }>({ sectionTitle: 'Quick Actions', showOnHome: true });
    const [isSavingSettings, setIsSavingSettings] = useState(false);

    // Trash state
    const [trashOpen, setTrashOpen] = useState(false);
    const [trashedLinks, setTrashedLinks] = useState<AdminLinkItem[]>([]);
    const [trashedLinksLoading, setTrashedLinksLoading] = useState(false);

    const [isTrashingId, setIsTrashingId] = useState<string | null>(null);
    const [isRestoringId, setIsRestoringId] = useState<string | null>(null);
    const [pendingPermDeleteId, setPendingPermDeleteId] = useState<string | null>(null);
    const [isDeletingPermId, setIsDeletingPermId] = useState<string | null>(null);
    const [pendingEmptyTrash, setPendingEmptyTrash] = useState(false);
    const [isEmptyingTrash, setIsEmptyingTrash] = useState(false);

    const formRef = useRef<HTMLDivElement>(null);
    const siteIdRef = useRef(siteId);
    useEffect(() => { siteIdRef.current = siteId; }, [siteId]);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    // ── Data fetching ─────────────────────────────────────────────────

    const fetchLinks = useCallback(async () => {
        if (!siteId) return;
        const snap = await getDocs(collection(db, 'sites', siteId, 'links'));
        const fetched = snap.docs
            .map(d => ({ id: d.id, ...d.data() } as AdminLinkItem))
            .filter(l => !l.deletedAt);
        fetched.sort((a, b) => (a.order || 0) - (b.order || 0));
        setLinks(fetched);
    }, [siteId]);

    const fetchTrashedLinks = useCallback(async () => {
        if (!siteId) return;
        setTrashedLinksLoading(true);
        try {
            const snap = await getDocs(collection(db, 'sites', siteId, 'links'));
            const fetched = snap.docs
                .map(d => ({ id: d.id, ...d.data() } as AdminLinkItem))
                .filter(l => !!l.deletedAt);
            fetched.sort((a, b) => {
                const aTime = a.deletedAt instanceof Timestamp ? a.deletedAt.toMillis() : 0;
                const bTime = b.deletedAt instanceof Timestamp ? b.deletedAt.toMillis() : 0;
                return bTime - aTime;
            });
            setTrashedLinks(fetched);
        } catch (error) {
            console.error('Error fetching trashed links:', error);
        } finally {
            setTrashedLinksLoading(false);
        }
    }, [siteId]);

    useEffect(() => {
        if (!siteId) return;
        const load = async () => {
            setLoading(true);
            try {
                const [linksSnap, formsSnap, pagesSnap, settingsSnap] = await Promise.all([
                    getDocs(collection(db, 'sites', siteId, 'links')),
                    getDocs(collection(db, 'sites', siteId, 'forms')),
                    getDocs(collection(db, 'sites', siteId, 'pages')),
                    getDoc(doc(db, 'sites', siteId, 'content', 'linkSettings')),
                ]);

                const fetchedLinks = linksSnap.docs
                    .map(d => ({ id: d.id, ...d.data() } as AdminLinkItem))
                    .filter(l => !l.deletedAt);
                fetchedLinks.sort((a, b) => (a.order || 0) - (b.order || 0));
                setLinks(fetchedLinks);
                setForms(formsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Form)));
                setPages(pagesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Page)));
                if (settingsSnap.exists()) setSettings(settingsSnap.data() as any);
            } catch (error) {
                console.error('Error loading links data:', error);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [siteId]);

    // Re-fetch links when another panel bumps linksVersion (e.g. QuickActions reorder)
    useEffect(() => {
        if (!siteId || linksVersion === 0) return;
        fetchLinks();
    }, [linksVersion, fetchLinks]);

    // ── CRUD ──────────────────────────────────────────────────────────

    const handleSaveLink = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!canWrite) { toast.error('View-only access', { description: 'You do not have permission to edit links.' }); return; }
        if (!siteId || !newLink.title) return;
        if (newLink.type === 'url' && !newLink.url) return;
        if (newLink.type === 'form' && !newLink.formId) return;
        if (newLink.type === 'page' && !newLink.pageId) return;

        setIsSubmitting(true);

        const selectedPage = newLink.type === 'page' ? pages.find(p => p.id === newLink.pageId) : null;
        let finalUrl = newLink.url;
        if (newLink.type === 'page' && selectedPage) finalUrl = `/${selectedPage.slug}`;

        const linkData = {
            ...newLink,
            url: finalUrl,
            formId: newLink.type === 'form' ? newLink.formId : '',
            pageId: newLink.type === 'page' ? newLink.pageId : '',
        };

        try {
            if (editingId) {
                await updateDoc(doc(db, 'sites', siteId, 'links', editingId), { ...linkData, updatedAt: serverTimestamp() });
            } else {
                const maxOrder = links.length > 0 ? Math.max(...links.map(l => l.order || 0)) : 0;
                await addDoc(collection(db, 'sites', siteId, 'links'), { ...linkData, order: maxOrder + 1, deletedAt: null, updatedAt: serverTimestamp() });
            }
            resetForm();
            fetchLinks();
            refreshHydratedData();
            bumpLinksVersion();
            purgeTenantCache(siteId);
        } catch (error) {
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEdit = (link: AdminLinkItem) => {
        setNewLink({
            title: link.title, subtitle: link.subtitle, url: link.url, iconName: link.iconName,
            type: link.type || 'url', formId: link.formId || '', pageId: link.pageId || '',
            hideOnHome: link.hideOnHome || false, openInNewTab: link.openInNewTab || false,
        });
        setEditingId(link.id);
        setShowForm(true);
        setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    };

    const resetForm = () => {
        setNewLink({ title: '', subtitle: '', url: '', iconName: 'ShoppingBag', type: 'url', formId: '', pageId: '', hideOnHome: false, openInNewTab: false });
        setEditingId(null);
        setShowForm(false);
        setShowIconSelector(false);
    };

    // Soft delete — moves to trash (called after inline row confirmation)
    const handleDeleteClick = async (id: string) => {
        if (!canWrite) { toast.error('View-only access', { description: 'You do not have permission to delete links.' }); return; }
        if (!siteId) return;
        setIsTrashingId(id);
        try {
            await updateDoc(doc(db, 'sites', siteId, 'links', id), { deletedAt: serverTimestamp() });
            setLinks(prev => prev.filter(l => l.id !== id));
            if (editingId === id) resetForm();
            refreshHydratedData();
            bumpLinksVersion();
            purgeTenantCache(siteId);
            if (trashOpen) fetchTrashedLinks();
        } catch (error) {
            console.error('Error trashing link:', error);
        } finally {
            setIsTrashingId(null);
        }
    };

    // Restore from trash
    const handleRestore = async (id: string) => {
        if (!siteId) return;
        setIsRestoringId(id);
        try {
            await updateDoc(doc(db, 'sites', siteId, 'links', id), { deletedAt: null });
            setTrashedLinks(prev => prev.filter(l => l.id !== id));
            fetchLinks();
            refreshHydratedData();
            bumpLinksVersion();
            purgeTenantCache(siteId);
        } catch (error) {
            console.error('Error restoring link:', error);
        } finally {
            setIsRestoringId(null);
        }
    };

    // Permanently delete single trashed link
    const confirmPermDelete = async () => {
        if (!pendingPermDeleteId || !siteId) return;
        setIsDeletingPermId(pendingPermDeleteId);
        setPendingPermDeleteId(null);
        try {
            await deleteDoc(doc(db, 'sites', siteId, 'links', pendingPermDeleteId));
            setTrashedLinks(prev => prev.filter(l => l.id !== pendingPermDeleteId));
            purgeTenantCache(siteId);
        } catch (error) {
            console.error('Error permanently deleting link:', error);
        } finally {
            setIsDeletingPermId(null);
        }
    };

    // Empty trash
    const confirmEmptyTrash = async () => {
        if (!siteId) return;
        setPendingEmptyTrash(false);
        setIsEmptyingTrash(true);
        try {
            const batch = writeBatch(db);
            trashedLinks.forEach(l => batch.delete(doc(db, 'sites', siteId, 'links', l.id)));
            await batch.commit();
            setTrashedLinks([]);
        } catch (error) {
            console.error('Error emptying trash:', error);
        } finally {
            setIsEmptyingTrash(false);
        }
    };

    const handleToggleTrash = () => {
        if (!trashOpen) fetchTrashedLinks();
        setTrashOpen(prev => !prev);
    };

    // ── Drag & Drop ───────────────────────────────────────────────────

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        if (!canWrite) { toast.error('View-only access', { description: 'You do not have permission to reorder links.' }); return; }
        if (!over || active.id === over.id) return;

        const dragSiteId = siteIdRef.current;

        setLinks(items => {
            const oldIndex = items.findIndex(i => i.id === active.id);
            const newIndex = items.findIndex(i => i.id === over.id);
            const reordered = arrayMove(items, oldIndex, newIndex);
            updateOrder(reordered, dragSiteId).then(() => { refreshHydratedData(); bumpLinksVersion(); });
            return reordered;
        });
    };

    const updateOrder = async (items: AdminLinkItem[], targetSiteId: string | undefined) => {
        if (!targetSiteId) return;
        if (targetSiteId !== siteIdRef.current) {
            console.warn('[LinksPanel] siteId changed mid-drag — aborting reorder write');
            return;
        }
        try {
            const batch = writeBatch(db);
            items.forEach((item, index) => {
                batch.update(doc(db, 'sites', targetSiteId, 'links', item.id), { order: index, updatedAt: serverTimestamp() });
            });
            await batch.commit();
        } catch (error) {
            console.error('Error updating order:', error);
        }
    };

    // ── Settings ──────────────────────────────────────────────────────

    const saveSettings = async () => {
        if (!siteId) return;
        setIsSavingSettings(true);
        try {
            await setDoc(doc(db, 'sites', siteId, 'content', 'linkSettings'), settings);
            purgeTenantCache(siteId);
        } catch (error) {
            console.error(error);
        } finally {
            setIsSavingSettings(false);
            setShowSettings(false);
        }
    };

    const formatDeletedAt = (deletedAt: any) => {
        if (!deletedAt) return '';
        const date = deletedAt instanceof Timestamp ? deletedAt.toDate() : new Date(deletedAt);
        const diff = Date.now() - date.getTime();
        const days = Math.floor(diff / 86400000);
        if (days === 0) return 'Today';
        if (days === 1) return 'Yesterday';
        return `${days}d ago`;
    };

    // ── Render ────────────────────────────────────────────────────────

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12 text-neutral-500">
                <Loader2 size={20} className="animate-spin" />
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            {/* Toolbar */}
            <div className="px-3 py-2 border-b border-gray-200 dark:border-neutral-800 flex items-center gap-2 flex-shrink-0">
                <button
                    onClick={() => { setShowForm(!showForm); if (showForm) resetForm(); }}
                    disabled={!canWrite}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                        showForm
                            ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                            : 'bg-gray-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-gray-300 dark:border-neutral-700 hover:bg-gray-200 dark:hover:bg-neutral-700'
                    }`}
                >
                    <Plus size={13} /> {editingId ? 'Editing' : 'Add Link'}
                </button>
                <button
                    onClick={() => setShowSettings(!showSettings)}
                    disabled={!canWrite}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                        showSettings
                            ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                            : 'bg-gray-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-gray-300 dark:border-neutral-700 hover:bg-gray-200 dark:hover:bg-neutral-700'
                    }`}
                >
                    <Settings size={13} /> Settings
                </button>
                <div className="flex-1" />
                <span className="text-[10px] text-neutral-400 dark:text-neutral-600 font-medium">{links.length} links</span>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {/* Settings panel */}
                {showSettings && (
                    <div className="p-3 border-b border-gray-200 dark:border-neutral-800 space-y-3 bg-gray-50 dark:bg-neutral-900/50">
                        <div>
                            <label className={labelClass}>Section Title</label>
                            <input
                                type="text"
                                value={settings.sectionTitle}
                                onChange={e => setSettings({ ...settings, sectionTitle: e.target.value })}
                                className={inputClass}
                                placeholder="e.g. Quick Actions"
                            />
                        </div>
                        <label className="flex items-center gap-2.5 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={settings.showOnHome}
                                onChange={e => setSettings({ ...settings, showOnHome: e.target.checked })}
                                className="rounded border-gray-300 dark:border-neutral-600 bg-gray-100 dark:bg-neutral-800 text-blue-500 focus:ring-blue-500/30"
                            />
                            <span className="text-xs text-neutral-700 dark:text-neutral-300">Show section on Home Page</span>
                        </label>
                        <div className="flex justify-end">
                            <button
                                onClick={saveSettings}
                                disabled={isSavingSettings}
                                className="px-4 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                            >
                                {isSavingSettings ? 'Saving...' : 'Save Settings'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Add/Edit form */}
                {showForm && (
                    <div ref={formRef} className="p-3 border-b border-gray-200 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-900/50">
                        <form onSubmit={handleSaveLink} className="space-y-3">
                            {/* Link type tabs */}
                            <div className="flex gap-1">
                                {[
                                    { type: 'url' as const, label: 'URL', icon: ExternalLink },
                                    { type: 'form' as const, label: 'Form', icon: FileText },
                                    { type: 'page' as const, label: 'Page', icon: FileText },
                                ].map(({ type, label, icon: TypeIcon }) => (
                                    <button
                                        key={type}
                                        type="button"
                                        onClick={() => setNewLink(prev => ({ ...prev, type }))}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${
                                            newLink.type === type
                                                ? 'bg-gray-200 dark:bg-neutral-700 text-neutral-900 dark:text-white'
                                                : 'text-neutral-400 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 hover:bg-gray-100 dark:hover:bg-neutral-800'
                                        }`}
                                    >
                                        <TypeIcon size={12} /> {label}
                                    </button>
                                ))}
                            </div>

                            <div>
                                <label className={labelClass}>Title</label>
                                <input
                                    type="text"
                                    value={newLink.title || ''}
                                    onChange={e => setNewLink({ ...newLink, title: e.target.value })}
                                    className={inputClass}
                                    placeholder="e.g. Order Online"
                                    required
                                />
                            </div>

                            {newLink.type === 'form' ? (
                                <div>
                                    <label className={labelClass}>Form</label>
                                    <SelectMenu
                                        value={newLink.formId || ''}
                                        onChange={v => setNewLink({ ...newLink, formId: v })}
                                        placeholder="Select a Form..."
                                        options={forms.map(form => ({
                                            value: form.id,
                                            label: `${form.title || 'Untitled'}${form.isPublished ? '' : ' (Draft)'}`,
                                        }))}
                                    />
                                </div>
                            ) : newLink.type === 'page' ? (
                                <div>
                                    <label className={labelClass}>Page</label>
                                    <SelectMenu
                                        value={newLink.pageId || ''}
                                        onChange={v => setNewLink({ ...newLink, pageId: v })}
                                        placeholder="Select a Page..."
                                        options={pages.map(page => ({
                                            value: page.id,
                                            label: page.title || 'Untitled',
                                            hint: `/${page.slug}`,
                                        }))}
                                    />
                                </div>
                            ) : (
                                <div>
                                    <label className={labelClass}>URL</label>
                                    <input
                                        type="text"
                                        value={newLink.url || ''}
                                        onChange={e => setNewLink({ ...newLink, url: e.target.value })}
                                        className={inputClass}
                                        placeholder="https://..."
                                        required
                                    />
                                </div>
                            )}

                            <div>
                                <label className={labelClass}>Subtitle (optional)</label>
                                <input
                                    type="text"
                                    value={newLink.subtitle || ''}
                                    onChange={e => setNewLink({ ...newLink, subtitle: e.target.value })}
                                    className={inputClass}
                                    placeholder="Short description"
                                />
                            </div>

                            {/* Icon selector */}
                            <div>
                                <label className={labelClass}>Icon</label>
                                <button
                                    type="button"
                                    onClick={() => setShowIconSelector(true)}
                                    className="w-full flex items-center gap-2.5 px-3 py-2 bg-gray-100 dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 rounded-lg hover:border-gray-400 dark:hover:border-neutral-600 transition-colors text-left"
                                >
                                    <div className="w-6 h-6 bg-gray-200 dark:bg-neutral-700 rounded-md flex items-center justify-center text-neutral-600 dark:text-neutral-300">
                                        {newLink.iconName && ICON_MAP[newLink.iconName] ? (
                                            (() => { const Icon = ICON_MAP[newLink.iconName!]; return <Icon size={14} />; })()
                                        ) : (
                                            <Search size={14} />
                                        )}
                                    </div>
                                    <span className="flex-1 text-xs font-medium text-neutral-700 dark:text-neutral-300">{newLink.iconName || 'Select Icon'}</span>
                                    <span className="text-[10px] text-blue-400 font-bold">Change</span>
                                </button>
                            </div>

                            {showIconSelector && (
                                <IconSelector
                                    selectedIcon={newLink.iconName || ''}
                                    onSelect={(iconName) => { setNewLink({ ...newLink, iconName }); setShowIconSelector(false); }}
                                    onClose={() => setShowIconSelector(false)}
                                />
                            )}

                            {/* Toggles */}
                            <div className="space-y-2">
                                <label className="flex items-center gap-2.5 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={newLink.hideOnHome || false}
                                        onChange={e => setNewLink({ ...newLink, hideOnHome: e.target.checked })}
                                        className="rounded border-gray-300 dark:border-neutral-600 bg-gray-100 dark:bg-neutral-800 text-blue-500 focus:ring-blue-500/30"
                                    />
                                    <span className="text-xs text-neutral-700 dark:text-neutral-300">Hide on Home Page</span>
                                </label>
                                <label className="flex items-center gap-2.5 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={newLink.openInNewTab || false}
                                        onChange={e => setNewLink({ ...newLink, openInNewTab: e.target.checked })}
                                        className="rounded border-gray-300 dark:border-neutral-600 bg-gray-100 dark:bg-neutral-800 text-blue-500 focus:ring-blue-500/30"
                                    />
                                    <span className="text-xs text-neutral-700 dark:text-neutral-300">Open in New Tab</span>
                                </label>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-2 pt-1">
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg transition-colors disabled:opacity-50 bg-blue-600 text-white hover:bg-blue-700"
                                >
                                    {isSubmitting ? <Loader2 size={13} className="animate-spin" /> : null}
                                    {editingId ? 'Update Link' : 'Add Link'}
                                </button>
                                <button
                                    type="button"
                                    onClick={resetForm}
                                    className="px-4 py-2 text-xs font-bold text-neutral-500 dark:text-neutral-400 bg-gray-100 dark:bg-neutral-800 rounded-lg hover:bg-gray-200 dark:hover:bg-neutral-700 transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* Links list */}
                <div className="py-1">
                    {links.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center text-neutral-500 gap-2">
                            <LinkIcon size={24} className="opacity-20" />
                            <p className="text-xs">No links yet</p>
                            <button
                                onClick={() => setShowForm(true)}
                                className="text-xs text-blue-400 hover:text-blue-300 font-bold"
                            >
                                Add your first link
                            </button>
                        </div>
                    ) : (
                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                            <SortableContext items={links.map(l => l.id)} strategy={verticalListSortingStrategy}>
                                {links.map(link => (
                                    <SortableLinkItem
                                        key={link.id}
                                        link={link}
                                        onEdit={handleEdit}
                                        onDelete={handleDeleteClick}
                                        canWrite={canWrite}
                                    />
                                ))}
                            </SortableContext>
                        </DndContext>
                    )}
                </div>
            </div>

            {/* Trash section — pinned to bottom */}
            <div className="border-t border-gray-200 dark:border-neutral-800 flex-shrink-0">
                    <button
                        onClick={handleToggleTrash}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-neutral-400 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
                    >
                        {trashOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                        <Trash2 size={12} />
                        <span className="flex-1 text-left font-medium">Trash</span>
                        {trashedLinks.length > 0 && (
                            <span className="bg-gray-200 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400 text-[10px] px-1.5 py-0.5 rounded-full">
                                {trashedLinks.length}
                            </span>
                        )}
                    </button>

                    {trashOpen && (
                        <div className="pb-2">
                            {trashedLinksLoading ? (
                                <div className="px-3 py-2 text-xs text-neutral-400 dark:text-neutral-600">Loading...</div>
                            ) : trashedLinks.length === 0 ? (
                                <div className="px-3 py-2 text-xs text-neutral-400 dark:text-neutral-600">Trash is empty</div>
                            ) : (
                                <>
                                    {/* Bulk actions */}
                                    <div className="flex gap-2 px-3 py-1.5">
                                        <button
                                            onClick={() => setPendingEmptyTrash(true)}
                                            disabled={isEmptyingTrash}
                                            className="flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded text-[10px] font-medium text-red-500/70 hover:text-red-400 bg-gray-100 dark:bg-neutral-800 hover:bg-gray-200 dark:hover:bg-neutral-700 transition-colors disabled:opacity-50"
                                        >
                                            <Trash2 size={10} />
                                            {isEmptyingTrash ? 'Emptying...' : 'Empty Trash'}
                                        </button>
                                    </div>

                                    {/* Trashed link list */}
                                    {trashedLinks.map(link => (
                                        <div key={link.id} className="group/trash px-3 py-1.5 flex items-center gap-2">
                                            <div className="flex-1 min-w-0">
                                                <div className="text-xs text-neutral-400 dark:text-neutral-500 truncate font-medium">{link.title || 'Untitled'}</div>
                                                <div className="text-[10px] text-neutral-500 dark:text-neutral-700 truncate">
                                                    {link.url || link.formId || '—'} · {formatDeletedAt(link.deletedAt)}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-0.5 opacity-0 group-hover/trash:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => handleRestore(link.id)}
                                                    disabled={isRestoringId === link.id}
                                                    className="p-1 rounded text-neutral-400 dark:text-neutral-500 hover:text-green-400 hover:bg-gray-200 dark:hover:bg-neutral-700 transition-colors disabled:opacity-50"
                                                    title="Restore"
                                                >
                                                    {isRestoringId === link.id ? <Loader2 size={11} className="animate-spin" /> : <RotateCcw size={11} />}
                                                </button>
                                                <button
                                                    onClick={() => setPendingPermDeleteId(link.id)}
                                                    disabled={isDeletingPermId === link.id}
                                                    className="p-1 rounded text-neutral-400 dark:text-neutral-500 hover:text-red-400 hover:bg-gray-200 dark:hover:bg-neutral-700 transition-colors disabled:opacity-50"
                                                    title="Delete permanently"
                                                >
                                                    <Trash2 size={11} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </>
                            )}
                        </div>
                    )}
            </div>

            {/* Confirm: permanently delete single */}
            <ConfirmationDialog
                isOpen={pendingPermDeleteId !== null}
                title="Delete Permanently?"
                message={`"${trashedLinks.find(l => l.id === pendingPermDeleteId)?.title || 'This link'}" will be permanently deleted. This cannot be undone.`}
                confirmLabel="Delete Forever"
                isLoading={isDeletingPermId !== null}
                onConfirm={confirmPermDelete}
                onCancel={() => setPendingPermDeleteId(null)}
            />

            {/* Confirm: empty trash */}
            <ConfirmationDialog
                isOpen={pendingEmptyTrash}
                title="Empty Trash?"
                message={`Permanently delete all ${trashedLinks.length} link${trashedLinks.length !== 1 ? 's' : ''} in Trash? This cannot be undone.`}
                confirmLabel="Empty Trash"
                isLoading={isEmptyingTrash}
                onConfirm={confirmEmptyTrash}
                onCancel={() => setPendingEmptyTrash(false)}
            />
        </div>
    );
}
