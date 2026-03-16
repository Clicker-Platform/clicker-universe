'use client';
// Force HMR update

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { doc, setDoc, collection, addDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { BusinessHours, BusinessContact, Branch, defaultBusinessSchedule } from '@/data/mockData';
import { SubmitButton } from '@/components/admin/SubmitButton';
import { ConfirmationDialog } from '@/components/common/ConfirmationDialog';
import { ScheduleEditor } from './components/ScheduleEditor';
import { Map, Clock, Eye, EyeOff, Tag, Phone, Mail, MapPin, ExternalLink, Plus, Trash2, Edit2, Save, Store, User } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useSite } from '@/lib/site-context';

interface BusinessSettingsClientProps {
    initialHours: BusinessHours;
    initialContact: BusinessContact;
    initialBranches: Branch[];
}

type Tab = 'contact' | 'hours' | 'branches';

export default function BusinessSettingsClient({ initialHours, initialContact, initialBranches }: BusinessSettingsClientProps) {
    const { siteId } = useSite();
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<Tab>('contact');

    // State for Contact & Hours (Single Button Save)
    const [hours, setHours] = useState<BusinessHours>({
        ...initialHours,
        schedule: initialHours.schedule || defaultBusinessSchedule
    });
    const [contact, setContact] = useState<BusinessContact>(initialContact);

    // State for Branches (Immediate CRUD)
    const [branches, setBranches] = useState<Branch[]>(initialBranches);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Branch Editing State
    const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
    const [isBranchModalOpen, setIsBranchModalOpen] = useState(false);

    // Delete Confirmation State
    const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; branchId: string | null }>({
        isOpen: false,
        branchId: null
    });

    // Validation State
    const [validationErrors, setValidationErrors] = useState<{ [key: string]: string }>({});


    // Sync branches when initialBranches changes (e.g. after router.refresh)
    useEffect(() => {
        setBranches(initialBranches);
    }, [initialBranches]);

    // --- Main Settings Save (Contact + Hours) ---
    const handleSaveSettings = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            // Merge data into one document 'content/business'
            const mergedData = {
                ...hours,
                ...contact
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
    };

    // --- Branch CRUD ---
    const validateBranch = (branch: Branch): boolean => {
        const errors: { [key: string]: string } = {};

        if (!branch.name || branch.name.length < 2) {
            errors.name = 'Name must be at least 2 characters.';
        }

        if (!branch.address || branch.address.length < 5) {
            errors.address = 'Address must be at least 5 characters.';
        }

        // Phone: Optional, digits/spaces/dash/+ only
        if (branch.phone && branch.phone.trim() !== '' && !/^[\d\s\-+]+$/.test(branch.phone)) {
            errors.phone = 'Invalid phone format (digits, spaces, -, + only).';
        }

        // Map URL: Optional, must start with http/https
        if (branch.mapUrl && branch.mapUrl.trim() !== '' && !/^https?:\/\/.+/.test(branch.mapUrl)) {
            errors.mapUrl = 'URL must start with http:// or https://';
        }

        setValidationErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSaveBranch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingBranch) return;

        // Run validation
        if (!validateBranch(editingBranch)) {
            return;
        }

        setIsSubmitting(true);
        try {
            if (!siteId) return;
            let updatedBranches = [...branches];

            if (editingBranch.id === 'new') {
                // Create
                const { id, ...data } = editingBranch;
                const docRef = await addDoc(collection(db, 'sites', siteId, 'branches'), data);

                // Add to local state immediately
                const newBranch: Branch = { ...editingBranch, id: docRef.id };
                updatedBranches.push(newBranch);
            } else {
                // Update
                const { id, ...data } = editingBranch;
                await updateDoc(doc(db, 'sites', siteId, 'branches', id), data);

                // Update local state immediately
                updatedBranches = updatedBranches.map(b =>
                    b.id === editingBranch.id ? editingBranch : b
                );
            }

            setBranches(updatedBranches);
            // Refresh server data in background
            router.refresh();

            setEditingBranch(null);
            setValidationErrors({});
            toast.success('Branch saved successfully!');
        } catch (error) {
            console.error('Error saving branch:', error);
            toast.error('Failed to save branch.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const confirmDeleteBranch = (id: string) => {
        setDeleteConfirm({ isOpen: true, branchId: id });
    };

    const executeDeleteBranch = async () => {
        const id = deleteConfirm.branchId;
        if (!id || !siteId) return;

        setIsSubmitting(true); // Show loading on dialog button if supported, or just block
        try {
            // Optimistic update
            const previousBranches = [...branches];
            setBranches(branches.filter(b => b.id !== id));

            await deleteDoc(doc(db, 'sites', siteId, 'branches', id));
            toast.success('Branch deleted.');
            router.refresh();
        } catch (error) {
            console.error('Error deleting branch:', error);
            toast.error('Failed to delete branch.');
            // Revert could be here
            router.refresh();
        } finally {
            setIsSubmitting(false);
            setDeleteConfirm({ isOpen: false, branchId: null });
        }
    };

    const openNewBranchModal = () => {
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
    };

    const openEditBranchModal = (branch: Branch) => {
        setEditingBranch({ ...branch });
        setIsBranchModalOpen(true);
    };

    return (
        <div className="max-w-5xl mx-auto pb-20">
            <h1 className="text-3xl font-black text-brand-dark mb-8 uppercase flex items-center gap-3">
                <Store size={32} />
                Business Manager
            </h1>

            {/* Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-4 mb-4">
                <button
                    onClick={() => setActiveTab('contact')}
                    className={`px-6 py-2.5 rounded-full font-bold whitespace-nowrap transition-all flex items-center gap-2 ${activeTab === 'contact'
                        ? 'bg-brand-dark text-brand-green shadow-md'
                        : 'bg-white text-gray-500 hover:bg-gray-50'
                        }`}
                >
                    <User size={18} />
                    Profile & Contact
                </button>
                <button
                    onClick={() => setActiveTab('hours')}
                    className={`px-6 py-2.5 rounded-full font-bold whitespace-nowrap transition-all flex items-center gap-2 ${activeTab === 'hours'
                        ? 'bg-brand-dark text-brand-green shadow-md'
                        : 'bg-white text-gray-500 hover:bg-gray-50'
                        }`}
                >
                    <Clock size={18} />
                    Operating Hours
                </button>
                <button
                    onClick={() => setActiveTab('branches')}
                    className={`px-6 py-2.5 rounded-full font-bold whitespace-nowrap transition-all flex items-center gap-2 ${activeTab === 'branches'
                        ? 'bg-brand-dark text-brand-green shadow-md'
                        : 'bg-white text-gray-500 hover:bg-gray-50'
                        }`}
                >
                    <MapPin size={18} />
                    Branches ({branches.length})
                </button>
            </div>

            {/* Content Area */}
            <div className="bg-white p-6 md:px-8 rounded-2xl border border-gray-200 shadow-sm min-h-[400px]">

                {/* --- CONTACT TAB --- */}
                {activeTab === 'contact' && (
                    <form onSubmit={handleSaveSettings} className="space-y-6">
                        <div className="flex items-center gap-3 mb-6 p-4 bg-blue-50 text-blue-800 rounded-xl border border-blue-100">
                            <MapPin size={24} />
                            <div>
                                <h3 className="font-bold">Main Headquarters</h3>
                                <p className="text-sm opacity-80">This address will be shown on the home page as the main location.</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-6">
                            <div>
                                <label className="block text-sm font-bold text-brand-dark mb-2 flex items-center gap-2">
                                    <MapPin size={16} /> Business Address
                                </label>
                                <textarea
                                    value={contact.address}
                                    onChange={(e) => setContact({ ...contact, address: e.target.value })}
                                    className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-green focus:border-transparent min-h-[80px]"
                                    placeholder="Enter your full business address..."
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-bold text-brand-dark mb-2 flex items-center gap-2">
                                        <Phone size={16} /> WhatsApp Number
                                    </label>
                                    <input
                                        type="tel"
                                        value={contact.whatsapp}
                                        onChange={(e) => setContact({ ...contact, whatsapp: e.target.value })}
                                        className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-green focus:border-transparent"
                                        placeholder="e.g. 628123456789"
                                    />
                                    <p className="text-xs text-gray-400 mt-1">Used for 'Order via WhatsApp'. Include country code, no +.</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-brand-dark mb-2 flex items-center gap-2">
                                        <Mail size={16} /> Email Address
                                    </label>
                                    <input
                                        type="email"
                                        value={contact.email}
                                        onChange={(e) => setContact({ ...contact, email: e.target.value })}
                                        className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-green focus:border-transparent"
                                        placeholder="contact@example.com"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-brand-dark mb-2 flex items-center gap-2">
                                    <Map size={16} /> Google Maps Link
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        value={contact.mapUrl}
                                        onChange={(e) => setContact({ ...contact, mapUrl: e.target.value })}
                                        className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-green focus:border-transparent"
                                        placeholder="https://maps.google.com/..."
                                    />
                                    {contact.mapUrl && (
                                        <a
                                            href={contact.mapUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="p-3 bg-gray-100 rounded-lg hover:bg-gray-200 text-gray-700"
                                        >
                                            <ExternalLink size={20} />
                                        </a>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="pt-6 border-t border-gray-100">
                            <SubmitButton
                                isLoading={isSubmitting}
                                label="Save Contact Info"
                                loadingLabel="Saving..."
                                className="bg-brand-dark text-white px-8 py-3 rounded-xl font-bold hover:bg-brand-green hover:text-brand-dark transition-all shadow-lg"
                            />
                        </div>
                    </form>
                )}

                {/* --- HOURS TAB --- */}
                {activeTab === 'hours' && (
                    <form onSubmit={handleSaveSettings} className="space-y-6">
                        {/* Visibility Toggle */}
                        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200 transition-all hover:border-gray-300">
                            <div>
                                <h3 className="font-bold text-lg text-brand-dark">Display Widget</h3>
                                <p className="text-sm text-gray-500">Show/Hide hours on public page</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setHours({ ...hours, enabled: !hours.enabled })}
                                className={`
                                    relative inline-flex h-8 w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-green focus:ring-offset-2
                                    ${hours.enabled ? 'bg-brand-dark' : 'bg-gray-200'}
                                `}
                            >
                                <span
                                    className={`
                                        inline-block h-6 w-6 transform rounded-full bg-white transition-transform
                                        ${hours.enabled ? 'translate-x-7' : 'translate-x-1'}
                                    `}
                                />
                            </button>
                        </div>

                        <div className={`space-y-6 ${!hours.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
                            <div className="grid grid-cols-1 gap-6">
                                <div>
                                    <label className="block text-sm font-bold text-brand-dark mb-2 flex items-center gap-2">
                                        <Tag size={16} /> Label
                                    </label>
                                    <input
                                        value={hours.label}
                                        onChange={(e) => setHours({ ...hours, label: e.target.value })}
                                        className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-green focus:border-transparent"
                                        placeholder="Opening Hours"
                                    />
                                    <p className="text-xs text-gray-400 mt-1">This title is displayed above the schedule on the public page.</p>
                                </div>
                            </div>

                            <hr className="border-gray-100" />

                            {/* Master Schedule Editor */}
                            <ScheduleEditor
                                schedule={hours.schedule || defaultBusinessSchedule}
                                onChange={(newSchedule) => setHours({ ...hours, schedule: newSchedule })}
                            />
                        </div>

                        <div className="pt-6 border-t border-gray-100">
                            <SubmitButton
                                isLoading={isSubmitting}
                                label="Save Hours"
                                loadingLabel="Saving..."
                                className="bg-brand-dark text-white px-8 py-3 rounded-xl font-bold hover:bg-brand-green hover:text-brand-dark transition-all shadow-lg"
                            />
                        </div>
                    </form>
                )}

                {/* --- BRANCHES TAB --- */}
                {activeTab === 'branches' && (
                    <div>
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-bold text-xl text-brand-dark">Locations List</h3>
                            <button
                                onClick={openNewBranchModal}
                                className="flex items-center gap-2 bg-brand-dark text-white px-4 py-2 rounded-lg font-bold hover:bg-brand-green hover:text-brand-dark transition-colors"
                            >
                                <Plus size={18} /> Add Branch
                            </button>
                        </div>

                        {branches.length === 0 ? (
                            <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                                <MapPin size={48} className="mx-auto text-gray-300 mb-3" />
                                <p className="text-gray-500 font-medium">No branches added yet.</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {branches.map((branch) => (
                                    <div key={branch.id} className="bg-gray-50 p-4 rounded-xl border border-gray-200 flex items-start justify-between group hover:border-brand-dark/50 transition-colors">
                                        <div className="flex-1">
                                            <h4 className="font-bold text-lg text-brand-dark">{branch.name}</h4>
                                            <p className="text-gray-600 text-sm whitespace-pre-line mt-1">{branch.address}</p>

                                            <div className="flex gap-4 mt-3">
                                                {branch.phone && (
                                                    <span className="flex items-center gap-1.5 text-xs font-bold text-gray-500 bg-white px-2 py-1 rounded-md border border-gray-200">
                                                        <Phone size={12} /> {branch.phone}
                                                    </span>
                                                )}
                                                {branch.mapUrl && (
                                                    <a href={branch.mapUrl} target="_blank" className="flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:underline bg-blue-50 px-2 py-1 rounded-md border border-blue-100">
                                                        <ExternalLink size={12} /> Map Data
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => openEditBranchModal(branch)}
                                                className="p-2 bg-white text-gray-600 hover:text-brand-dark border border-gray-200 rounded-lg hover:border-brand-dark transition-colors"
                                            >
                                                <Edit2 size={18} />
                                            </button>
                                            <button
                                                onClick={() => confirmDeleteBranch(branch.id)}
                                                className="p-2 bg-white text-red-400 hover:text-red-500 border border-gray-200 rounded-lg hover:border-red-200 transition-colors"
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

            {/* Branch Modal */}
            {isBranchModalOpen && editingBranch && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white z-10">
                            <h3 className="text-xl font-bold text-brand-dark">
                                {editingBranch.id === 'new' ? 'Add New Branch' : 'Edit Branch'}
                            </h3>
                            <button onClick={() => setIsBranchModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full">
                                <Plus size={24} className="rotate-45" />
                            </button>
                        </div>

                        <form onSubmit={handleSaveBranch} className="p-6 space-y-6">
                            <div>
                                <label className="block text-sm font-bold text-brand-dark mb-2">Branch Name</label>
                                <input
                                    required
                                    value={editingBranch.name}
                                    onChange={(e) => setEditingBranch({ ...editingBranch, name: e.target.value })}
                                    className={`w-full px-4 py-3 rounded-lg border focus:outline-none focus:ring-2 ${validationErrors.name ? 'border-red-500 focus:ring-red-200' : 'border-gray-200 focus:ring-brand-green'}`}
                                    placeholder="e.g. SunnySide Downtown"
                                />
                                {validationErrors.name && <p className="text-red-500 text-xs mt-1">{validationErrors.name}</p>}
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-brand-dark mb-2">Address</label>
                                <textarea
                                    required
                                    value={editingBranch.address}
                                    onChange={(e) => setEditingBranch({ ...editingBranch, address: e.target.value })}
                                    className={`w-full px-4 py-3 rounded-lg border focus:outline-none focus:ring-2 min-h-[80px] ${validationErrors.address ? 'border-red-500 focus:ring-red-200' : 'border-gray-200 focus:ring-brand-green'}`}
                                    placeholder="Full address..."
                                />
                                {validationErrors.address && <p className="text-red-500 text-xs mt-1">{validationErrors.address}</p>}
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-brand-dark mb-2">Phone Number (Optional)</label>
                                <input
                                    value={editingBranch.phone || ''}
                                    onChange={(e) => setEditingBranch({ ...editingBranch, phone: e.target.value })}
                                    className={`w-full px-4 py-3 rounded-lg border focus:outline-none focus:ring-2 ${validationErrors.phone ? 'border-red-500 focus:ring-red-200' : 'border-gray-200 focus:ring-brand-green'}`}
                                    placeholder="e.g. 021-555555"
                                />
                                {validationErrors.phone && <p className="text-red-500 text-xs mt-1">{validationErrors.phone}</p>}
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-brand-dark mb-2">Google Maps URL</label>
                                <input
                                    value={editingBranch.mapUrl}
                                    onChange={(e) => setEditingBranch({ ...editingBranch, mapUrl: e.target.value })}
                                    className={`w-full px-4 py-3 rounded-lg border focus:outline-none focus:ring-2 ${validationErrors.mapUrl ? 'border-red-500 focus:ring-red-200' : 'border-gray-200 focus:ring-brand-green'}`}
                                    placeholder="https://maps.google.com/..."
                                />
                                {validationErrors.mapUrl && <p className="text-red-500 text-xs mt-1">{validationErrors.mapUrl}</p>}
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsBranchModalOpen(false)}
                                    className="flex-1 px-4 py-3 font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
                                >
                                    Cancel
                                </button>
                                <SubmitButton
                                    isLoading={isSubmitting}
                                    label="Save Branch"
                                    loadingLabel="Saving..."
                                    className="flex-1 bg-brand-dark text-white px-4 py-3 rounded-xl font-bold hover:bg-brand-green hover:text-brand-dark transition-all"
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
