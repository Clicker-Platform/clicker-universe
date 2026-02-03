'use client';

import { useState, useEffect } from 'react';
import { Staff } from '@/lib/modules/reservation/types';
import { getStaffMembers, createStaffMember, updateStaffMember, deleteStaffMember } from '@/lib/modules/reservation/staff';
import { getReservationSettings, updateReservationSettings } from '@/lib/modules/reservation/api';
import { Plus, Trash2, User, CheckCircle, XCircle, Edit2, X, Save, Settings, Loader2 } from 'lucide-react';
import { ConfirmationDialog } from '@/components/common/ConfirmationDialog';
import { toast } from 'sonner';
import { useSite } from '@/lib/site-context';

interface StaffClientProps {
    initialStaff?: Staff[];
}

export default function StaffClient({ initialStaff }: StaffClientProps) {
    const { siteId } = useSite();
    const [staffList, setStaffList] = useState<Staff[]>(initialStaff || []);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoading, setIsLoading] = useState(!initialStaff);

    // Settings State
    const [settings, setSettings] = useState({ allowStaffSelection: false });
    const [loadingSettings, setLoadingSettings] = useState(true);

    useEffect(() => {
        if (!siteId) return;

        async function loadData() {
            try {
                // Fetch Settings
                const settingsData = await getReservationSettings(siteId);
                setSettings(settingsData);

                // Fetch Staff if not provided
                if (!initialStaff) {
                    const staffData = await getStaffMembers(siteId);
                    setStaffList(staffData);
                }
            } catch (error) {
                console.error("Failed to load data:", error);
            } finally {
                setLoadingSettings(false);
                setIsLoading(false);
            }
        }
        loadData();
    }, [initialStaff, siteId]);

    const toggleSettings = async (val: boolean) => {
        const newSettings = { ...settings, allowStaffSelection: val };
        setSettings(newSettings);
        try {
            if (!siteId) return;
            await updateReservationSettings(siteId, { allowStaffSelection: val });
            toast.success("Settings updated");
        } catch (e) {
            toast.error("Failed to update settings");
            setSettings(prev => ({ ...prev, allowStaffSelection: !val })); // Revert
        }
    };

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        label: 'Staff',
        isActive: true
    });

    // Tag Input State
    const [tagInput, setTagInput] = useState('');
    const [tags, setTags] = useState<string[]>(['Staff']); // Default tag

    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [staffToDelete, setStaffToDelete] = useState<string | null>(null);

    const resetForm = () => {
        setFormData({
            name: '',
            label: 'Staff',
            isActive: true
        });
        setTags(['Staff']);
        setTagInput('');
        setEditingStaff(null);
    };

    const handleOpenModal = (staff?: Staff) => {
        if (staff) {
            setEditingStaff(staff);
            const initialLabel = staff.label || 'Staff';
            setFormData({
                name: staff.name,
                label: initialLabel,
                isActive: staff.isActive
            });
            setTags(initialLabel.split(',').map(t => t.trim()).filter(Boolean));
        } else {
            resetForm();
        }
        setIsModalOpen(true);
    };

    // Tag Handlers
    const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            const val = tagInput.trim().replace(/,$/, ''); // remove trailing comma if any
            if (val && !tags.includes(val)) {
                const newTags = [...tags, val];
                setTags(newTags);
                setFormData(prev => ({ ...prev, label: newTags.join(', ') }));
                setTagInput('');
            }
        } else if (e.key === 'Backspace' && !tagInput && tags.length > 0) {
            // Optional: remove last tag on backspace
            removeTag(tags[tags.length - 1]);
        }
    };

    const removeTag = (tagToRemove: string) => {
        const newTags = tags.filter(t => t !== tagToRemove);
        setTags(newTags);
        setFormData(prev => ({ ...prev, label: newTags.join(', ') }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name.trim()) return;

        setIsSubmitting(true);
        try {
            if (!siteId) return;
            if (editingStaff) {
                await updateStaffMember(siteId, editingStaff.id, formData);
                setStaffList(prev => prev.map(s => s.id === editingStaff.id ? { ...s, ...formData } : s));
                toast.success('Resource updated successfully');
            } else {
                const id = await createStaffMember(siteId, formData);
                setStaffList([...staffList, { id, ...formData } as Staff]);
                toast.success('Resource created successfully');
            }
            setIsModalOpen(false);
            resetForm();
        } catch (error) {
            console.error(error);
            toast.error('Operation failed');
        } finally {
            setIsSubmitting(false);
        }
    };

    const toggleStatus = async (member: Staff) => {
        const newStatus = !member.isActive;
        // Optimistic update
        setStaffList(prev => prev.map(s => s.id === member.id ? { ...s, isActive: newStatus } : s));

        try {
            if (!siteId) return;
            await updateStaffMember(siteId, member.id, { isActive: newStatus });
            toast.success(`Resource ${newStatus ? 'activated' : 'deactivated'}`);
        } catch (error) {
            console.error(error);
            toast.error('Failed to update status');
            // Revert
            setStaffList(prev => prev.map(s => s.id === member.id ? { ...s, isActive: !newStatus } : s));
        }
    };

    const confirmDelete = (id: string) => {
        setStaffToDelete(id);
        setDeleteDialogOpen(true);
    };

    const executeDelete = async () => {
        if (!staffToDelete) return;

        try {
            if (!siteId) return;
            await deleteStaffMember(siteId, staffToDelete);
            setStaffList(prev => prev.filter(s => s.id !== staffToDelete));
            setDeleteDialogOpen(false);
            setStaffToDelete(null);
            toast.success('Resource deleted');
        } catch (error) {
            console.error(error);
            toast.error('Failed to delete resource');
        }
    };

    return (
        <div>

            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-black text-brand-dark mb-2 uppercase">Staff / Resources</h1>
                    <p className="text-gray-600 font-medium">Manage available staff, rooms, or equipment.</p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="bg-brand-dark text-white px-6 py-2.5 rounded-xl font-bold hover:bg-brand-dark/90 flex items-center gap-2 shadow-lg hover:shadow-xl transition-all cursor-pointer active:scale-95"
                >
                    <Plus size={20} /> Add Resource
                </button>
            </div>

            {/* Global Settings Panel */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-8">
                <div className="flex items-center gap-2 mb-4 text-brand-dark">
                    <Settings size={20} className="stroke-[2.5px]" />
                    <h3 className="font-bold text-lg">Configuration</h3>
                </div>

                {loadingSettings ? (
                    <div className="flex items-center gap-2 text-gray-400 text-sm">
                        <Loader2 size={16} className="animate-spin" /> Loading settings...
                    </div>
                ) : (
                    <label className="flex items-center justify-between p-3 rounded-xl border border-gray-200 cursor-pointer hover:border-brand-dark transition-colors bg-gray-50/50 max-w-2xl">
                        <div>
                            <span className="block font-bold text-gray-800">Allow Staff Selection</span>
                            <span className="text-sm text-gray-500">Customers can explicitly choose a specific staff member during booking.</span>
                        </div>
                        <div className={`
                            relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none 
                            ${settings.allowStaffSelection ? 'bg-brand-dark' : 'bg-gray-300'}
                        `}>
                            <input
                                type="checkbox"
                                className="sr-only"
                                checked={settings.allowStaffSelection}
                                onChange={(e) => toggleSettings(e.target.checked)}
                            />
                            <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${settings.allowStaffSelection ? 'translate-x-5' : 'translate-x-0'}`} />
                        </div>
                    </label>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {isLoading ? (
                    <div className="col-span-full flex justify-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                    </div>
                ) : staffList.length === 0 ? (
                    <div className="col-span-full text-center py-12 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                        <p className="text-gray-500 font-medium">No resources found.</p>
                        <button onClick={() => handleOpenModal()} className="text-brand-dark font-bold mt-2 hover:underline">Add your first one</button>
                    </div>
                ) : (
                    staffList.map(member => (
                        <div key={member.id} className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all group relative">
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center text-gray-400">
                                        <User size={24} />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-lg text-brand-dark">{member.name}</h3>
                                        <div className="flex flex-wrap gap-1 mt-1">
                                            {(member.label || 'Staff').split(',').map((tag, idx) => (
                                                <span key={idx} className="inline-block px-2 py-0.5 bg-gray-100 text-gray-500 text-xs font-bold uppercase rounded-md">
                                                    {tag.trim()}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => handleOpenModal(member)}
                                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                        title="Edit"
                                    >
                                        <Edit2 size={16} />
                                    </button>
                                    <button
                                        onClick={() => confirmDelete(member.id)}
                                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                        title="Delete"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>

                            <div className="flex items-center justify-between border-t border-gray-50 pt-4 mt-2">
                                <button
                                    onClick={() => toggleStatus(member)}
                                    className={`flex items-center gap-2 text-sm font-bold px-3 py-1.5 rounded-lg transition-colors w-full justify-center ${member.isActive
                                        ? 'bg-green-50 text-green-700 hover:bg-green-100'
                                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                        }`}
                                >
                                    {member.isActive ? <CheckCircle size={16} /> : <XCircle size={16} />}
                                    {member.isActive ? 'Active Available' : 'Inactive / Unavailable'}
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Create/Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between p-6 border-b border-gray-100">
                            <h2 className="text-xl font-bold text-brand-dark">
                                {editingStaff ? 'Edit Resource' : 'Add New Resource'}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Name</label>
                                <input
                                    required
                                    type="text"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-brand-dark"
                                    placeholder="e.g. Sarah Jones"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Label (Tags)</label>
                                <div className="w-full px-2 py-2 rounded-xl border border-gray-200 focus-within:border-brand-dark bg-white flex flex-wrap gap-2 items-center">
                                    {tags.map(tag => (
                                        <span key={tag} className="px-2 py-1 bg-brand-dark/10 text-brand-dark text-xs font-bold rounded-lg flex items-center gap-1">
                                            {tag}
                                            <button
                                                type="button"
                                                onClick={() => removeTag(tag)}
                                                className="hover:text-red-500"
                                            >
                                                <X size={12} />
                                            </button>
                                        </span>
                                    ))}
                                    <input
                                        type="text"
                                        value={tagInput}
                                        onChange={e => setTagInput(e.target.value)}
                                        onKeyDown={handleTagKeyDown}
                                        className="flex-1 min-w-[120px] outline-none text-sm py-1"
                                        placeholder={tags.length === 0 ? "Type and press comma..." : ""}
                                    />
                                </div>
                                <p className="text-xs text-gray-400 mt-1">Press comma (,) or Enter to add a tag.</p>
                            </div>

                            <div className="flex items-center gap-2 pt-2">
                                <input
                                    type="checkbox"
                                    id="isActive"
                                    checked={formData.isActive}
                                    onChange={e => setFormData({ ...formData, isActive: e.target.checked })}
                                    className="w-5 h-5 rounded border-gray-300 text-brand-dark focus:ring-brand-dark"
                                />
                                <label htmlFor="isActive" className="text-sm font-medium text-gray-700">Available for booking immediately</label>
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button
                                    type="button"
                                    disabled={isSubmitting}
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 py-3 px-4 rounded-xl font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="flex-1 py-3 px-4 rounded-xl font-bold text-white bg-brand-dark hover:bg-brand-dark/90 transition-colors flex items-center justify-center gap-2"
                                >
                                    <Save size={18} />
                                    {isSubmitting ? 'Saving...' : 'Save Resource'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <ConfirmationDialog
                isOpen={deleteDialogOpen}
                title="Delete Resource"
                message="Are you sure you want to delete this resource? This action cannot be undone."
                onConfirm={executeDelete}
                onCancel={() => setDeleteDialogOpen(false)}
                confirmLabel="Delete Resource"
                isDestructive={true}
            />
        </div>
    );
}
