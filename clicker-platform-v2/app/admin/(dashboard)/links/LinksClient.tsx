'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc, writeBatch, setDoc, getDoc } from 'firebase/firestore';
import { LinkItem, Form, Page } from '@/data/mockData';
import { Trash2, Plus, GripVertical, Save, Pencil, X, Search, FileText, Link as LinkIcon, EyeOff, Settings } from 'lucide-react';
import { TableSkeleton } from '@/components/skeletons/TableSkeleton';
import { IconSelector } from '@/components/admin/IconSelector';
import { ICON_MAP } from '@/data/icons';
import { SubmitButton } from '@/components/admin/SubmitButton';
import { ConfirmationDialog } from '@/components/common/ConfirmationDialog';
import { useSite } from '@/lib/site-context';
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

interface AdminLinkItem extends Omit<LinkItem, 'icon'> {
    iconName: string;
    order?: number;
    pageId?: string;
}

// Sortable Item Component
function SortableLinkItem({ link, onEdit, onDelete }: { link: AdminLinkItem, onEdit: (l: AdminLinkItem) => void, onDelete: (id: string) => void }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
    } = useSortable({ id: link.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <div ref={setNodeRef} style={style} className="bg-white dark:bg-neutral-900 p-4 rounded-lg border border-gray-200 dark:border-neutral-800 group relative">
            <div className="flex items-start gap-3">
                {/* Drag Handle */}
                <div {...attributes} {...listeners} className="p-2 mt-1 bg-gray-50 dark:bg-neutral-800/50 rounded-lg text-gray-400 dark:text-neutral-600 cursor-grab active:cursor-grabbing hover:bg-gray-100 dark:hover:bg-neutral-700 hover:text-brand-dark shrink-0">
                    <GripVertical size={18} />
                </div>

                <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                    <h3 className="font-bold text-brand-dark text-base truncate pr-8">{link.title}</h3>
                    {link.subtitle && (
                        <p className="text-sm text-gray-500 dark:text-neutral-500 truncate">{link.subtitle}</p>
                    )}
                    <div className="flex items-center justify-between mt-1">
                        <div className="flex items-center gap-2 flex-wrap">
                            {link.hideOnHome && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-gray-100 dark:bg-neutral-800 text-gray-500 dark:text-neutral-500 uppercase tracking-wide flex items-center gap-1">
                                    <EyeOff size={10} /> Hidden
                                </span>
                            )}
                            {link.type === 'form' && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-700 uppercase tracking-wide">
                                    FORM
                                </span>
                            )}
                            {link.type === 'page' && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700 uppercase tracking-wide">
                                    PAGE
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => onEdit(link)}
                                className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Edit Link"
                            >
                                <Pencil size={18} />
                            </button>
                            <button
                                onClick={() => onDelete(link.id)}
                                className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Delete Link"
                            >
                                <Trash2 size={18} />
                            </button>
                        </div>
                    </div>
                    <div className="mt-1">
                        {link.type === 'form' ? (
                            <span className="text-xs text-purple-500 font-medium flex items-center gap-1">
                                <FileText size={12} /> Linked to Form
                            </span>
                        ) : link.type === 'page' ? (
                            <span className="text-xs text-blue-500 font-medium flex items-center gap-1">
                                <FileText size={12} /> Linked to Page
                            </span>
                        ) : (
                            <a href={link.url} target="_blank" className="text-xs text-blue-500 hover:underline flex items-center gap-1 truncate">
                                <LinkIcon size={12} /> {link.url}
                            </a>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

interface LinksClientProps {
    initialLinks: AdminLinkItem[];
}

export default function LinksManager({ initialLinks }: LinksClientProps) {
    const { siteId } = useSite();
    const [links, setLinks] = useState<AdminLinkItem[]>(initialLinks);
    const [forms, setForms] = useState<Form[]>([]);
    const [pages, setPages] = useState<Page[]>([]);
    const [loading, setLoading] = useState(false); // Can be true if we refetch

    // Form State
    const [newLink, setNewLink] = useState<Partial<AdminLinkItem>>({
        title: '',
        subtitle: '',
        url: '',
        iconName: 'ShoppingBag',
        type: 'url',
        formId: '',
        pageId: '',
        hideOnHome: false,
        openInNewTab: false
    });

    const [editingId, setEditingId] = useState<string | null>(null);
    const [showIconSelector, setShowIconSelector] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Deletion State
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [linkToDelete, setLinkToDelete] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    useEffect(() => {
        if (siteId) {
            fetchForms();
            fetchPages();
            fetchLinks();
        }
    }, [siteId]);

    const fetchForms = async () => {
        if (!siteId) return;
        try {
            const snap = await getDocs(collection(db, 'sites', siteId, 'forms'));
            const fetchedForms = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Form));
            setForms(fetchedForms);
        } catch (error) {
            console.error("Error fetching forms:", error);
        }
    };

    const fetchPages = async () => {
        if (!siteId) return;
        try {
            const snap = await getDocs(collection(db, 'sites', siteId, 'pages'));
            const fetchedPages = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Page));
            setPages(fetchedPages);
        } catch (error) {
            console.error("Error fetching pages:", error);
        }
    }

    const fetchLinks = async () => {
        if (!siteId) return;
        try {
            const querySnapshot = await getDocs(collection(db, 'sites', siteId, 'links'));
            const fetchedLinks = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AdminLinkItem));
            fetchedLinks.sort((a, b) => (a.order || 0) - (b.order || 0));
            setLinks(fetchedLinks);
        } catch (error) {
            console.error("Error fetching links:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveLink = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!siteId) return;

        // Validation
        if (!newLink.title) return;
        if (newLink.type === 'url' && !newLink.url) return;
        if (newLink.type === 'form' && !newLink.formId) {
            alert('Please select a form to link to.');
            return;
        }
        if (newLink.type === 'page' && !newLink.pageId) {
            alert('Please select a page to link to.');
            return;
        }

        setIsSubmitting(true);

        const selectedPage = newLink.type === 'page' ? pages.find(p => p.id === newLink.pageId) : null;
        let finalUrl = newLink.url;

        // If Page, set the URL automatically to /[slug]
        if (newLink.type === 'page' && selectedPage) {
            finalUrl = `/${selectedPage.slug}`;
        }

        const linkData = {
            ...newLink,
            url: finalUrl,
            formId: newLink.type === 'form' ? newLink.formId : '',
            pageId: newLink.type === 'page' ? newLink.pageId : ''
        };

        try {
            if (editingId) {
                await updateDoc(doc(db, 'sites', siteId, 'links', editingId), linkData);
                setEditingId(null);
            } else {
                const maxOrder = links.length > 0 ? Math.max(...links.map(l => l.order || 0)) : 0;
                await addDoc(collection(db, 'sites', siteId, 'links'), { ...linkData, order: maxOrder + 1 });
            }
            setNewLink({ title: '', subtitle: '', url: '', iconName: 'ShoppingBag', type: 'url', formId: '', pageId: '', hideOnHome: false, openInNewTab: false });
            fetchLinks();
        } catch (error) {
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEdit = (link: AdminLinkItem) => {
        setNewLink({
            title: link.title,
            subtitle: link.subtitle,
            url: link.url,
            iconName: link.iconName,
            type: link.type || 'url',
            formId: link.formId || '',
            pageId: link.pageId || '',
            hideOnHome: link.hideOnHome || false,
            openInNewTab: link.openInNewTab || false
        });
        setEditingId(link.id);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleCancel = () => {
        setNewLink({ title: '', subtitle: '', url: '', iconName: 'ShoppingBag', type: 'url', formId: '', pageId: '', hideOnHome: false, openInNewTab: false });
        setEditingId(null);
        setShowIconSelector(false);
    };

    const handleDeleteClick = (id: string) => {
        setLinkToDelete(id);
        setDeleteDialogOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (!linkToDelete || !siteId) return;
        setIsDeleting(true);

        try {
            await deleteDoc(doc(db, 'sites', siteId, 'links', linkToDelete));
            setLinks(links.filter(l => l.id !== linkToDelete));
            if (editingId === linkToDelete) handleCancel();
        } catch (error) {
            console.error("Error deleting link:", error);
        } finally {
            setIsDeleting(false);
            setDeleteDialogOpen(false);
            setLinkToDelete(null);
        }
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            setLinks((items) => {
                const oldIndex = items.findIndex((item) => item.id === active.id);
                const newIndex = items.findIndex((item) => item.id === over.id);
                const newItems = arrayMove(items, oldIndex, newIndex);
                updateOrder(newItems);
                return newItems;
            });
        }
    };

    const updateOrder = async (items: AdminLinkItem[]) => {
        if (!siteId) return;
        try {
            const batch = writeBatch(db);
            items.forEach((item, index) => {
                const ref = doc(db, 'sites', siteId, 'links', item.id);
                batch.update(ref, { order: index });
            });
            await batch.commit();
        } catch (error) {
            console.error("Error updating order:", error);
        }
    };

    // Settings State
    const [settings, setSettings] = useState<{ sectionTitle: string; showOnHome: boolean }>({
        sectionTitle: 'Quick Actions',
        showOnHome: true
    });
    const [isSavingSettings, setIsSavingSettings] = useState(false);
    const [showSettings, setShowSettings] = useState(false);

    useEffect(() => {
        if (!siteId) return;
        const loadSettings = async () => {
            const snap = await getDoc(doc(db, "sites", siteId, "content", "linkSettings"));
            if (snap.exists()) {
                setSettings(snap.data() as any);
            }
        }
        loadSettings();
    }, [siteId]);

    const saveSettings = async () => {
        if (!siteId) return;
        setIsSavingSettings(true);
        try {
            await setDoc(doc(db, "sites", siteId, "content", "linkSettings"), settings);
            // Optional toast here
        } catch (error) {
            console.error(error);
        } finally {
            setIsSavingSettings(false);
            setShowSettings(false);
        }
    }

    if (loading) return <TableSkeleton />;

    return (
        <div className="max-w-4xl">
            <div className="hidden md:flex items-center justify-between mb-8">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-neutral-100">Manage Links</h1>
                <button
                    onClick={() => setShowSettings(!showSettings)}
                    className="flex items-center gap-1.5 bg-gray-100 dark:bg-neutral-800 px-3 py-2 rounded-lg text-sm font-semibold text-gray-700 dark:text-neutral-300 hover:bg-gray-200 dark:hover:bg-neutral-700 transition-colors border border-gray-200 dark:border-neutral-700"
                >
                    <Settings size={15} /> Configure
                </button>
            </div>

            {/* Settings Panel */}
            {showSettings && (
                <div className="bg-white dark:bg-neutral-900 p-6 rounded-lg border border-gray-200 dark:border-neutral-800 mb-8 animate-in slide-in-from-top-2">
                    <h2 className="text-lg font-bold text-brand-dark mb-4">Section Settings</h2>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-neutral-300 mb-1">Section Title</label>
                            <input
                                type="text"
                                value={settings.sectionTitle}
                                onChange={(e) => setSettings({ ...settings, sectionTitle: e.target.value })}
                                className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 focus:border-gray-400 focus:ring-0"
                                placeholder="e.g. Quick Actions"
                            />
                        </div>

                        <label className="flex items-center gap-3 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={settings.showOnHome}
                                onChange={(e) => setSettings({ ...settings, showOnHome: e.target.checked })}
                                className="w-5 h-5 rounded text-brand-dark focus:ring-brand-dark border-gray-300 dark:border-neutral-700"
                            />
                            <div>
                                <span className="block font-bold text-sm text-gray-900 dark:text-neutral-100">Show on Home Page</span>
                                <span className="block text-xs text-gray-500 dark:text-neutral-500">If unchecked, this section title will be hidden on the home page.</span>
                            </div>
                        </label>

                        <div className="flex justify-end pt-2">
                            <button
                                onClick={saveSettings}
                                disabled={isSavingSettings}
                                className="bg-studio-blue text-white px-6 py-2 rounded-lg font-bold hover:bg-studio-blue/85 transition-colors disabled:opacity-50"
                            >
                                {isSavingSettings ? 'Saving...' : 'Save Settings'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add/Edit Link Form */}
            <div className={`bg-white dark:bg-neutral-900 p-6 rounded-lg border mb-8 transition-colors ${editingId ? 'border-blue-500 ring-4 ring-blue-50' : 'border-gray-400 dark:border-neutral-700'}`}>
                <h2 className={`text-lg font-bold mb-4 flex items-center gap-2 ${editingId ? 'text-blue-600' : 'text-brand-dark'}`}>
                    {editingId ? <><Pencil size={20} /> Edit Link</> : <><Plus size={20} /> Add New Link</>}
                </h2>
                <form onSubmit={handleSaveLink} className={`grid grid-cols-1 md:grid-cols-2 gap-4 transition-opacity duration-200 ${isSubmitting ? 'opacity-50 pointer-events-none' : ''}`}>

                    {/* Link Type Selector */}
                    <div className="md:col-span-2 flex flex-wrap gap-4 mb-2">
                        <label className="flex items-center gap-2 cursor-pointer bg-gray-50 dark:bg-neutral-800/50 px-4 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 has-[:checked]:border-gray-400 has-[:checked]:bg-brand-green/10 transition-colors">
                            <input
                                type="radio"
                                checked={newLink.type === 'url' || !newLink.type}
                                onChange={() => setNewLink(prev => ({ ...prev, type: 'url' }))}
                                className="w-4 h-4 text-brand-dark focus:ring-brand-dark"
                            />
                            <span className="font-bold text-sm flex items-center gap-2"><LinkIcon size={16} /> External URL</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer bg-gray-50 dark:bg-neutral-800/50 px-4 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 has-[:checked]:border-gray-400 has-[:checked]:bg-brand-green/10 transition-colors">
                            <input
                                type="radio"
                                checked={newLink.type === 'form'}
                                onChange={() => setNewLink(prev => ({ ...prev, type: 'form' }))}
                                className="w-4 h-4 text-brand-dark focus:ring-brand-dark"
                            />
                            <span className="font-bold text-sm flex items-center gap-2"><FileText size={16} /> Link to Form</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer bg-gray-50 dark:bg-neutral-800/50 px-4 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 has-[:checked]:border-gray-400 has-[:checked]:bg-brand-green/10 transition-colors">
                            <input
                                type="radio"
                                checked={newLink.type === 'page'}
                                onChange={() => setNewLink(prev => ({ ...prev, type: 'page' }))}
                                className="w-4 h-4 text-brand-dark focus:ring-brand-dark"
                            />
                            <span className="font-bold text-sm flex items-center gap-2"><FileText size={16} /> Link to Page</span>
                        </label>
                    </div>

                    <input
                        placeholder="Title (e.g. Order Online)"
                        className="px-4 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"
                        value={newLink.title || ''}
                        onChange={e => setNewLink({ ...newLink, title: e.target.value })}
                        required
                    />

                    {newLink.type === 'form' ? (
                        <select
                            value={newLink.formId || ''}
                            onChange={e => setNewLink({ ...newLink, formId: e.target.value })}
                            className="px-4 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 bg-white"
                            required
                        >
                            <option value="" disabled>Select a Form...</option>
                            {forms.map(form => (
                                <option key={form.id} value={form.id}>
                                    {form.title} {form.isPublished ? '' : '(Draft)'}
                                </option>
                            ))}
                        </select>
                    ) : newLink.type === 'page' ? (
                        <select
                            value={newLink.pageId || ''}
                            onChange={e => setNewLink({ ...newLink, pageId: e.target.value })}
                            className="px-4 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 bg-white"
                            required
                        >
                            <option value="" disabled>Select a Page...</option>
                            {pages.map(page => (
                                <option key={page.id} value={page.id}>
                                    {page.title} (/{page.slug})
                                </option>
                            ))}
                        </select>
                    ) : (
                        <input
                            placeholder="URL (https://...)"
                            className="px-4 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"
                            value={newLink.url || ''}
                            onChange={e => setNewLink({ ...newLink, url: e.target.value })}
                            required
                        />
                    )}

                    <input
                        placeholder="Subtitle (Optional)"
                        className="px-4 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 md:col-span-2"
                        value={newLink.subtitle || ''}
                        onChange={e => setNewLink({ ...newLink, subtitle: e.target.value })}
                    />

                    <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <label className="flex items-center gap-2 cursor-pointer bg-gray-50 dark:bg-neutral-800/50 px-4 py-3 rounded-lg border border-gray-200 dark:border-neutral-700 has-[:checked]:border-gray-400 has-[:checked]:bg-brand-green/10 transition-colors w-full">
                            <input
                                type="checkbox"
                                checked={newLink.hideOnHome || false}
                                onChange={e => setNewLink({ ...newLink, hideOnHome: e.target.checked })}
                                className="w-5 h-5 rounded text-brand-dark focus:ring-brand-dark border-gray-300 dark:border-neutral-700"
                            />
                            <div>
                                <span className="block font-bold text-sm text-gray-900 dark:text-neutral-100">Hide on Home Page</span>
                                <span className="block text-xs text-gray-500 dark:text-neutral-500">Only visible on direct link pages.</span>
                            </div>
                        </label>

                        <label className="flex items-center gap-2 cursor-pointer bg-gray-50 dark:bg-neutral-800/50 px-4 py-3 rounded-lg border border-gray-200 dark:border-neutral-700 has-[:checked]:border-gray-400 has-[:checked]:bg-brand-green/10 transition-colors w-full">
                            <input
                                type="checkbox"
                                checked={newLink.openInNewTab || false}
                                onChange={e => setNewLink({ ...newLink, openInNewTab: e.target.checked })}
                                className="w-5 h-5 rounded text-brand-dark focus:ring-brand-dark border-gray-300 dark:border-neutral-700"
                            />
                            <div>
                                <span className="block font-bold text-sm text-gray-900 dark:text-neutral-100">Open in New Tab</span>
                                <span className="block text-xs text-gray-500 dark:text-neutral-500">Opens link in a new browser window/tab.</span>
                            </div>
                        </label>
                    </div>

                    {/* Icon Selector Button */}
                    <div className="relative md:col-span-2">
                        <label className="block text-xs font-bold text-gray-500 dark:text-neutral-500 mb-1 uppercase tracking-wider">Icon</label>
                        <button
                            type="button"
                            onClick={() => setShowIconSelector(true)}
                            className="w-full flex items-center gap-3 px-4 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 hover:border-gray-400 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-all text-left"
                        >
                            <div className="w-8 h-8 bg-brand-green/20 rounded-lg flex items-center justify-center text-brand-dark">
                                {newLink.iconName && ICON_MAP[newLink.iconName] ? (
                                    (() => {
                                        const Icon = ICON_MAP[newLink.iconName!];
                                        return <Icon size={18} />;
                                    })()
                                ) : (
                                    <Search size={18} />
                                )}
                            </div>
                            <div className="flex-1">
                                <span className="block font-bold text-sm text-gray-800 dark:text-neutral-200">{newLink.iconName || 'Select Icon'}</span>
                            </div>
                            <span className="text-xs text-blue-500 font-bold">Change</span>
                        </button>
                    </div>

                    {/* Icon Selector Modal */}
                    {showIconSelector && (
                        <IconSelector
                            selectedIcon={newLink.iconName || ''}
                            onSelect={(iconName) => {
                                setNewLink({ ...newLink, iconName });
                                setShowIconSelector(false);
                            }}
                            onClose={() => setShowIconSelector(false)}
                        />
                    )}
                    <div className="md:col-span-2 flex gap-2">
                        <SubmitButton
                            isLoading={isSubmitting}
                            loadingLabel={editingId ? 'Updating...' : 'Adding...'}
                            label={editingId ? 'Update Link' : 'Add Link'}
                            className={`flex-1 md:flex-none text-white px-6 py-2 rounded-lg font-bold transition-colors bg-studio-blue hover:bg-studio-blue/85`}
                        />
                        {editingId && (
                            <button type="button" onClick={handleCancel} className="bg-gray-200 dark:bg-neutral-700 text-gray-700 dark:text-neutral-300 px-6 py-2 rounded-lg font-bold hover:bg-gray-300 dark:hover:bg-neutral-600 transition-colors flex items-center gap-2">
                                <X size={18} /> Cancel
                            </button>
                        )}
                    </div>
                </form>
            </div>

            {/* Links List with Drag and Drop */}
            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
            >
                <SortableContext
                    items={links.map(l => l.id)}
                    strategy={verticalListSortingStrategy}
                >
                    <div className="space-y-4">
                        {links.map(link => (
                            <SortableLinkItem
                                key={link.id}
                                link={link}
                                onEdit={handleEdit}
                                onDelete={handleDeleteClick}
                            />
                        ))}
                        {links.length === 0 && <p className="text-gray-500 dark:text-neutral-500 text-center py-10">No links found. Add one above.</p>}
                    </div>
                </SortableContext>
            </DndContext>

            <ConfirmationDialog
                isOpen={deleteDialogOpen}
                title="Delete Link"
                message="Are you sure you want to delete this link? This action cannot be undone."
                onConfirm={handleConfirmDelete}
                onCancel={() => setDeleteDialogOpen(false)}
                isLoading={isDeleting}
            />
        </div>
    );
}
