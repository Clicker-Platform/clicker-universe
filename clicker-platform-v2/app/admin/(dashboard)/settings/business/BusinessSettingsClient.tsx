'use client';

import { useState, useEffect, useCallback } from 'react';
import { db } from '@/lib/firebase';
import { doc, setDoc, collection, addDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { BusinessHours, BusinessContact, Branch, defaultBusinessSchedule } from '@/data/mockData';
import { SubmitButton } from '@/components/admin/SubmitButton';
import { ConfirmationDialog } from '@/components/common/ConfirmationDialog';
import { ScheduleEditor } from './components/ScheduleEditor';
import { SettingsSubNav } from '@/components/admin/SettingsSubNav';
import { Map, Clock, Eye, EyeOff, Tag, Phone, Mail, MapPin, ExternalLink, Plus, Trash2, Edit2, Save, GitBranch } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useSite } from '@/lib/site-context';

interface BusinessSettingsClientProps {
    initialHours: BusinessHours;
    initialContact: BusinessContact;
    initialBranches: Branch[];
    initialHasBranches: boolean;
}

type Tab = 'contact' | 'hours' | 'branches';

export default function BusinessSettingsClient({ initialHours, initialContact, initialBranches, initialHasBranches }: BusinessSettingsClientProps) {
    const { siteId } = useSite();
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<Tab>('contact');

    const [hours, setHours] = useState<BusinessHours>({
        ...initialHours,
        schedule: initialHours.schedule || defaultBusinessSchedule
    });
    const [contact, setContact] = useState<BusinessContact>(initialContact);
    const [hasBranches, setHasBranches] = useState(initialHasBranches);

    const [branches, setBranches] = useState<Branch[]>(initialBranches);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
    const [isBranchModalOpen, setIsBranchModalOpen] = useState(false);

    const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; branchId: string | null }>({
        isOpen: false,
        branchId: null
    });

    const [validationErrors, setValidationErrors] = useState<{ [key: string]: string }>({});

    useEffect(() => {
        setBranches(initialBranches);
    }, [initialBranches]);

    // --- Main Settings Save (Contact + Hours + hasBranches) ---
    const handleSaveSettings = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const mergedData = {
                ...hours,
                ...contact,
                hasBranches
            };
            if (!siteId) return;
            await setDoc(doc(db, 'sites', siteId, 'content', 'business'), mergedData);
            toast.success('Settings saved successfully!');
            router.refresh();
        } catch (error) {
            console.error('Error updating business settings:', error);
            toast.error('Failed to update settings. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    }, [siteId, hours, contact, hasBranches, router]);

    const handleToggleHasBranches = useCallback(async (value: boolean) => {
        setHasBranches(value);
        if (!siteId) return;
        try {
            await setDoc(doc(db, 'sites', siteId, 'content', 'business'), { hasBranches: value }, { merge: true });
            toast.success(value ? 'Branches enabled.' : 'Branches hidden.');
        } catch {
            toast.error('Failed to update branch setting.');
            setHasBranches(!value);
        }
    }, [siteId]);

    // --- Branch CRUD ---
    const validateBranch = useCallback((branch: Branch): boolean => {
        const errors: { [key: string]: string } = {};

        if (!branch.name || branch.name.length < 2) {
            errors.name = 'Name must be at least 2 characters.';
        }

        if (!branch.address || branch.address.length < 5) {
            errors.address = 'Address must be at least 5 characters.';
        }

        if (branch.phone && branch.phone.trim() !== '' && !/^[\d\s\-+]+$/.test(branch.phone)) {
            errors.phone = 'Invalid phone format (digits, spaces, -, + only).';
        }

        if (branch.mapUrl && branch.mapUrl.trim() !== '' && !/^https?:\/\/.+/.test(branch.mapUrl)) {
            errors.mapUrl = 'URL must start with http:// or https://';
        }

        setValidationErrors(errors);
        return Object.keys(errors).length === 0;
    }, []);

    const handleSaveBranch = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingBranch) return;

        if (!validateBranch(editingBranch)) return;

        setIsSubmitting(true);
        try {
            if (!siteId) return;
            let updatedBranches = [...branches];

            if (editingBranch.id === 'new') {
                const { id, ...data } = editingBranch;
                const docRef = await addDoc(collection(db, 'sites', siteId, 'branches'), data);
                const newBranch: Branch = { ...editingBranch, id: docRef.id };
                updatedBranches.push(newBranch);
            } else {
                const { id, ...data } = editingBranch;
                await updateDoc(doc(db, 'sites', siteId, 'branches', id), data);
                updatedBranches = updatedBranches.map(b =>
                    b.id === editingBranch.id ? editingBranch : b
                );
            }

            setBranches(updatedBranches);
            router.refresh();
            setEditingBranch(null);
            setIsBranchModalOpen(false);
            setValidationErrors({});
            toast.success('Branch saved successfully!');
        } catch (error) {
            console.error('Error saving branch:', error);
            toast.error('Failed to save branch.');
        } finally {
            setIsSubmitting(false);
        }
    }, [siteId, editingBranch, branches, validateBranch, router]);

    const confirmDeleteBranch = useCallback((id: string) => {
        setDeleteConfirm({ isOpen: true, branchId: id });
    }, []);

    const executeDeleteBranch = useCallback(async () => {
        const id = deleteConfirm.branchId;
        if (!id || !siteId) return;

        setIsSubmitting(true);
        try {
            setBranches(branches.filter(b => b.id !== id));
            await deleteDoc(doc(db, 'sites', siteId, 'branches', id));
            toast.success('Branch deleted.');
            router.refresh();
        } catch (error) {
            console.error('Error deleting branch:', error);
            toast.error('Failed to delete branch.');
            router.refresh();
        } finally {
            setIsSubmitting(false);
            setDeleteConfirm({ isOpen: false, branchId: null });
        }
    }, [siteId, deleteConfirm.branchId, branches, router]);

    const openNewBranchModal = useCallback(() => {
        setEditingBranch({
            id: 'new',
            name: '',
            address: '',
            mapUrl: '',
            phone: '',
            isActive: true,
            order: branches.length
        });
        setIsBranchModalOpen(true);
    }, [branches.length]);

    const openEditBranchModal = useCallback((branch: Branch) => {
        setEditingBranch({ ...branch });
        setIsBranchModalOpen(true);
    }, []);

    return (
        <div className="max-w-2xl pb-20">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-neutral-100 mb-2">Business Information</h1>
            <p className="text-gray-500 dark:text-neutral-500 text-sm mb-8">Contact details, operating hours, and branch locations.</p>

            <SettingsSubNav />

            {/* Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-4 mb-4">
                <button
                    onClick={() => setActiveTab('contact')}
                    className={`px-6 py-2.5 rounded-full font-bold whitespace-nowrap transition-all flex items-center gap-2 ${activeTab === 'contact'
                        ? 'bg-studio-blue text-white shadow-md'
                        : 'bg-white dark:bg-neutral-900 text-gray-500 dark:text-neutral-500 border border-gray-200 dark:border-neutral-800 hover:bg-gray-50 dark:hover:bg-neutral-800'
                        }`}
                >
                    <MapPin size={18} />
                    Contact & Location
                </button>
                <button
                    onClick={() => setActiveTab('hours')}
                    className={`px-6 py-2.5 rounded-full font-bold whitespace-nowrap transition-all flex items-center gap-2 ${activeTab === 'hours'
                        ? 'bg-studio-blue text-white shadow-md'
                        : 'bg-white dark:bg-neutral-900 text-gray-500 dark:text-neutral-500 border border-gray-200 dark:border-neutral-800 hover:bg-gray-50 dark:hover:bg-neutral-800'
                        }`}
                >
                    <Clock size={18} />
                    Operating Hours
                </button>
                <button
                    onClick={() => setActiveTab('branches')}
                    className={`px-6 py-2.5 rounded-full font-bold whitespace-nowrap transition-all flex items-center gap-2 ${activeTab === 'branches'
                        ? 'bg-studio-blue text-white shadow-md'
                        : 'bg-white dark:bg-neutral-900 text-gray-500 dark:text-neutral-500 border border-gray-200 dark:border-neutral-800 hover:bg-gray-50 dark:hover:bg-neutral-800'
                        }`}
                >
                    <GitBranch size={18} />
                    Branches {hasBranches && branches.length > 0 && `(${branches.length})`}
                </button>
            </div>

            {/* Content Area */}
            <div className="bg-white dark:bg-neutral-900 p-6 md:px-8 rounded-2xl border border-gray-200 dark:border-neutral-800 shadow-sm min-h-[400px]">

                {/* --- CONTACT TAB --- */}
                {activeTab === 'contact' && (
                    <form onSubmit={handleSaveSettings} className="space-y-6">
                        <div className="flex items-center gap-3 mb-6 p-4 bg-blue-50 dark:bg-blue-950/30 text-blue-800 dark:text-blue-400 rounded-xl border border-blue-100 dark:border-blue-800">
                            <MapPin size={24} />
                            <div>
                                <h3 className="font-bold">Main Location</h3>
                                <p className="text-sm opacity-80">This address is shown on your public page as the main location.</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-6">
                            <div>
                                <label className="block text-sm font-bold text-brand-dark dark:text-neutral-200 mb-2 flex items-center gap-2">
                                    <MapPin size={16} /> Address
                                </label>
                                <textarea
                                    value={contact.address}
                                    onChange={(e) => setContact({ ...contact, address: e.target.value })}
                                    className="w-full px-4 py-3 rounded-lg border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-brand-green focus:border-transparent min-h-[80px]"
                                    placeholder="Enter your full address..."
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-bold text-brand-dark dark:text-neutral-200 mb-2 flex items-center gap-2">
                                        <Phone size={16} /> WhatsApp Number
                                    </label>
                                    <input
                                        type="tel"
                                        value={contact.whatsapp}
                                        onChange={(e) => setContact({ ...contact, whatsapp: e.target.value })}
                                        className="w-full px-4 py-3 rounded-lg border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-brand-green focus:border-transparent"
                                        placeholder="e.g. 628123456789"
                                    />
                                    <p className="text-xs text-gray-400 dark:text-neutral-600 mt-1">Include country code, no +. Used for notifications and direct customer chat.</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-brand-dark dark:text-neutral-200 mb-2 flex items-center gap-2">
                                        <Mail size={16} /> Email Address
                                    </label>
                                    <input
                                        type="email"
                                        value={contact.email}
                                        onChange={(e) => setContact({ ...contact, email: e.target.value })}
                                        className="w-full px-4 py-3 rounded-lg border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-brand-green focus:border-transparent"
                                        placeholder="contact@example.com"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-brand-dark dark:text-neutral-200 mb-2 flex items-center gap-2">
                                    <Map size={16} /> Google Maps Link
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        value={contact.mapUrl}
                                        onChange={(e) => setContact({ ...contact, mapUrl: e.target.value })}
                                        className="w-full px-4 py-3 rounded-lg border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-brand-green focus:border-transparent"
                                        placeholder="https://maps.google.com/..."
                                    />
                                    {contact.mapUrl && (
                                        <a
                                            href={contact.mapUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="p-3 bg-gray-100 dark:bg-neutral-800 rounded-lg hover:bg-gray-200 dark:hover:bg-neutral-700 text-gray-700 dark:text-neutral-300"
                                        >
                                            <ExternalLink size={20} />
                                        </a>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="pt-6 border-t border-gray-100 dark:border-neutral-800/50">
                            <SubmitButton
                                isLoading={isSubmitting}
                                label="Save Contact Info"
                                loadingLabel="Saving..."
                                className="bg-studio-blue text-white px-8 py-3 rounded-xl font-bold hover:bg-studio-blue/85 transition-all shadow-lg"
                            />
                        </div>
                    </form>
                )}

                {/* --- HOURS TAB --- */}
                {activeTab === 'hours' && (
                    <form onSubmit={handleSaveSettings} className="space-y-6">
                        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-neutral-800/50 rounded-xl border border-gray-200 dark:border-neutral-700">
                            <div>
                                <h3 className="font-bold text-lg text-brand-dark dark:text-neutral-100">Display Widget</h3>
                                <p className="text-sm text-gray-500 dark:text-neutral-500">Show/Hide hours on public page</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setHours({ ...hours, enabled: !hours.enabled })}
                                className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-green focus:ring-offset-2 ${hours.enabled ? 'bg-brand-dark' : 'bg-gray-200 dark:bg-neutral-700'}`}
                            >
                                <span className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${hours.enabled ? 'translate-x-7' : 'translate-x-1'}`} />
                            </button>
                        </div>

                        <div className={`space-y-6 ${!hours.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
                            <div>
                                <label className="block text-sm font-bold text-brand-dark dark:text-neutral-200 mb-2 flex items-center gap-2">
                                    <Tag size={16} /> Widget Label
                                </label>
                                <input
                                    value={hours.label}
                                    onChange={(e) => setHours({ ...hours, label: e.target.value })}
                                    className="w-full px-4 py-3 rounded-lg border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-brand-green focus:border-transparent"
                                    placeholder="Opening Hours"
                                />
                                <p className="text-xs text-gray-400 dark:text-neutral-600 mt-1">e.g. "Jam Buka" or "Opening Hours" — displayed above the schedule on your public page.</p>
                            </div>
                        </div>

                        <hr className="border-gray-100 dark:border-neutral-800" />

                        <ScheduleEditor
                            schedule={hours.schedule || defaultBusinessSchedule}
                            onChange={(newSchedule) => setHours({ ...hours, schedule: newSchedule })}
                        />

                        <div className="pt-6 border-t border-gray-100 dark:border-neutral-800/50">
                            <SubmitButton
                                isLoading={isSubmitting}
                                label="Save Hours"
                                loadingLabel="Saving..."
                                className="bg-studio-blue text-white px-8 py-3 rounded-xl font-bold hover:bg-studio-blue/85 transition-all shadow-lg"
                            />
                        </div>
                    </form>
                )}

                {/* --- BRANCHES TAB --- */}
                {activeTab === 'branches' && (
                    <div className="space-y-6">
                        {/* Has Branches Toggle */}
                        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-neutral-800/50 rounded-xl border border-gray-200 dark:border-neutral-700">
                            <div>
                                <h3 className="font-bold text-lg text-brand-dark dark:text-neutral-100">Has Branches</h3>
                                <p className="text-sm text-gray-500 dark:text-neutral-500">Enable to manage and display multiple locations</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => handleToggleHasBranches(!hasBranches)}
                                className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-green focus:ring-offset-2 ${hasBranches ? 'bg-brand-dark' : 'bg-gray-200 dark:bg-neutral-700'}`}
                            >
                                <span className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${hasBranches ? 'translate-x-7' : 'translate-x-1'}`} />
                            </button>
                        </div>

                        {hasBranches && (
                            <div>
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="font-bold text-xl text-brand-dark dark:text-neutral-100">Branch List</h3>
                                    <button
                                        onClick={openNewBranchModal}
                                        className="flex items-center gap-2 bg-studio-blue text-white px-4 py-2 rounded-lg font-bold hover:bg-studio-blue/85 transition-colors"
                                    >
                                        <Plus size={18} /> Add Branch
                                    </button>
                                </div>

                                {branches.length === 0 ? (
                                    <div className="text-center py-12 bg-gray-50 dark:bg-neutral-800/50 rounded-xl border border-dashed border-gray-200 dark:border-neutral-700">
                                        <GitBranch size={48} className="mx-auto text-gray-300 dark:text-neutral-600 mb-3" />
                                        <p className="text-gray-500 dark:text-neutral-500 font-medium">No branches added yet.</p>
                                        <p className="text-sm text-gray-400 dark:text-neutral-600 mt-1">Add your first branch location above.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {branches.map((branch) => (
                                            <div key={branch.id} className="bg-gray-50 dark:bg-neutral-800/50 p-4 rounded-xl border border-gray-200 dark:border-neutral-700 flex items-start justify-between group hover:border-brand-dark/50 transition-colors">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <h4 className="font-bold text-lg text-brand-dark dark:text-neutral-100">{branch.name}</h4>
                                                        {!branch.isActive && (
                                                            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-gray-200 dark:bg-neutral-700 text-gray-500 dark:text-neutral-400">Inactive</span>
                                                        )}
                                                    </div>
                                                    <p className="text-gray-600 dark:text-neutral-400 text-sm whitespace-pre-line">{branch.address}</p>

                                                    <div className="flex gap-4 mt-3">
                                                        {branch.phone && (
                                                            <span className="flex items-center gap-1.5 text-xs font-bold text-gray-500 dark:text-neutral-500 bg-white dark:bg-neutral-900 px-2 py-1 rounded-md border border-gray-200 dark:border-neutral-700">
                                                                <Phone size={12} /> {branch.phone}
                                                            </span>
                                                        )}
                                                        {branch.mapUrl && (
                                                            <a href={branch.mapUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:underline bg-blue-50 dark:bg-blue-950/30 px-2 py-1 rounded-md border border-blue-100 dark:border-blue-800">
                                                                <ExternalLink size={12} /> Map
                                                            </a>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => openEditBranchModal(branch)}
                                                        className="p-2 bg-white dark:bg-neutral-900 text-gray-600 dark:text-neutral-400 hover:text-brand-dark border border-gray-200 dark:border-neutral-700 rounded-lg hover:border-brand-dark transition-colors"
                                                    >
                                                        <Edit2 size={18} />
                                                    </button>
                                                    <button
                                                        onClick={() => confirmDeleteBranch(branch.id)}
                                                        className="p-2 bg-white dark:bg-neutral-900 text-red-400 hover:text-red-500 border border-gray-200 dark:border-neutral-700 rounded-lg hover:border-red-200 dark:hover:border-red-800 transition-colors"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Branch Modal */}
            {isBranchModalOpen && editingBranch && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white dark:bg-neutral-900 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-gray-100 dark:border-neutral-800/50 flex justify-between items-center sticky top-0 bg-white dark:bg-neutral-900 z-10">
                            <h3 className="text-xl font-bold text-brand-dark dark:text-neutral-100">
                                {editingBranch.id === 'new' ? 'Add New Branch' : 'Edit Branch'}
                            </h3>
                            <button onClick={() => setIsBranchModalOpen(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-neutral-700 rounded-full">
                                <Plus size={24} className="rotate-45" />
                            </button>
                        </div>

                        <form onSubmit={handleSaveBranch} className="p-6 space-y-6">
                            <div>
                                <label className="block text-sm font-bold text-brand-dark dark:text-neutral-200 mb-2">Branch Name</label>
                                <input
                                    required
                                    value={editingBranch.name}
                                    onChange={(e) => setEditingBranch({ ...editingBranch, name: e.target.value })}
                                    className={`w-full px-4 py-3 rounded-lg border focus:outline-none focus:ring-2 dark:bg-neutral-800 dark:text-neutral-200 ${validationErrors.name ? 'border-red-500 focus:ring-red-200' : 'border-gray-200 dark:border-neutral-700 focus:ring-brand-green'}`}
                                    placeholder="e.g. Downtown"
                                />
                                {validationErrors.name && <p className="text-red-500 text-xs mt-1">{validationErrors.name}</p>}
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-brand-dark dark:text-neutral-200 mb-2">Address</label>
                                <textarea
                                    required
                                    value={editingBranch.address}
                                    onChange={(e) => setEditingBranch({ ...editingBranch, address: e.target.value })}
                                    className={`w-full px-4 py-3 rounded-lg border focus:outline-none focus:ring-2 min-h-[80px] dark:bg-neutral-800 dark:text-neutral-200 ${validationErrors.address ? 'border-red-500 focus:ring-red-200' : 'border-gray-200 dark:border-neutral-700 focus:ring-brand-green'}`}
                                    placeholder="Full address..."
                                />
                                {validationErrors.address && <p className="text-red-500 text-xs mt-1">{validationErrors.address}</p>}
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-brand-dark dark:text-neutral-200 mb-2">Phone Number (Optional)</label>
                                <input
                                    value={editingBranch.phone || ''}
                                    onChange={(e) => setEditingBranch({ ...editingBranch, phone: e.target.value })}
                                    className={`w-full px-4 py-3 rounded-lg border focus:outline-none focus:ring-2 dark:bg-neutral-800 dark:text-neutral-200 ${validationErrors.phone ? 'border-red-500 focus:ring-red-200' : 'border-gray-200 dark:border-neutral-700 focus:ring-brand-green'}`}
                                    placeholder="e.g. 021-555555"
                                />
                                {validationErrors.phone && <p className="text-red-500 text-xs mt-1">{validationErrors.phone}</p>}
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-brand-dark dark:text-neutral-200 mb-2">Google Maps URL (Optional)</label>
                                <input
                                    value={editingBranch.mapUrl}
                                    onChange={(e) => setEditingBranch({ ...editingBranch, mapUrl: e.target.value })}
                                    className={`w-full px-4 py-3 rounded-lg border focus:outline-none focus:ring-2 dark:bg-neutral-800 dark:text-neutral-200 ${validationErrors.mapUrl ? 'border-red-500 focus:ring-red-200' : 'border-gray-200 dark:border-neutral-700 focus:ring-brand-green'}`}
                                    placeholder="https://maps.google.com/..."
                                />
                                {validationErrors.mapUrl && <p className="text-red-500 text-xs mt-1">{validationErrors.mapUrl}</p>}
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsBranchModalOpen(false)}
                                    className="flex-1 px-4 py-3 font-bold text-gray-600 dark:text-neutral-400 bg-gray-100 dark:bg-neutral-800 hover:bg-gray-200 dark:hover:bg-neutral-700 rounded-xl transition-colors"
                                >
                                    Cancel
                                </button>
                                <SubmitButton
                                    isLoading={isSubmitting}
                                    label="Save Branch"
                                    loadingLabel="Saving..."
                                    className="flex-1 bg-studio-blue text-white px-4 py-3 rounded-xl font-bold hover:bg-studio-blue/85 transition-all"
                                />
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <ConfirmationDialog
                isOpen={deleteConfirm.isOpen}
                title="Delete Branch"
                message="Are you sure you want to delete this branch? This action cannot be undone."
                onConfirm={executeDeleteBranch}
                onCancel={() => setDeleteConfirm({ isOpen: false, branchId: null })}
                isLoading={isSubmitting}
                confirmLabel="Delete"
                isDestructive={true}
            />
        </div>
    );
}
