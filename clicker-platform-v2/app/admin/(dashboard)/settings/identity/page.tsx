'use client';

import { useState, useEffect, useCallback } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { BusinessProfile } from '@/data/mockData';
import { Save } from 'lucide-react';
import { FormSkeleton } from '@/components/skeletons/FormSkeleton';
import { AvatarUpload } from '@/components/common/AvatarUpload';
import { SubmitButton } from '@/components/admin/SubmitButton';
import { SettingsSubNav } from '@/components/admin/SettingsSubNav';
import { useSite } from '@/lib/site-context';

export default function IdentitySettingsPage() {
    const { siteId } = useSite();
    const [profile, setProfile] = useState<BusinessProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');

    const fetchProfile = useCallback(async () => {
        if (!siteId) return;
        try {
            const snap = await getDoc(doc(db, 'sites', siteId, 'content', 'profile'));
            if (snap.exists()) {
                setProfile(snap.data() as BusinessProfile);
            } else {
                setProfile({ name: '', tagline: '', description: '', avatarUrl: '' });
            }
        } catch (error) {
            console.error('Error fetching profile:', error);
            setProfile({ name: '', tagline: '', description: '', avatarUrl: '' });
        }
        setLoading(false);
    }, [siteId]);

    useEffect(() => {
        fetchProfile();
    }, [fetchProfile]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!profile || !siteId) return;
        setSaving(true);
        setMessage('');

        try {
            await setDoc(doc(db, 'sites', siteId, 'content', 'profile'), profile, { merge: true });
            setMessage('Identity updated successfully!');
        } catch (err) {
            console.error(err);
            setMessage('Error updating identity');
        }
        setSaving(false);
    };

    if (loading) return (
        <div className="max-w-2xl">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-neutral-100 mb-2">Identity / Profile</h1>
            <p className="text-gray-500 dark:text-neutral-500 text-sm mb-8">Your public-facing name, tagline, and avatar across all templates.</p>
            <SettingsSubNav />
            <FormSkeleton />
        </div>
    );

    if (!profile) return <div>Initializing...</div>;

    return (
        <div className="max-w-2xl">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-neutral-100 mb-2">Identity / Profile</h1>
            <p className="text-gray-500 dark:text-neutral-500 text-sm mb-8">Your public-facing name, tagline, and avatar across all templates.</p>

            <SettingsSubNav />

            {message && (
                <div className={`p-4 rounded-xl mb-6 font-bold ${message.includes('Error') ? 'bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400' : 'bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400'}`}>
                    {message}
                </div>
            )}

            <form onSubmit={handleSave} className={`space-y-6 bg-white dark:bg-neutral-900 p-8 rounded-2xl border border-gray-200 dark:border-neutral-800 shadow-sm transition-opacity duration-200 ${saving ? 'opacity-50 pointer-events-none' : ''}`}>
                <div>
                    <label className="block text-brand-dark dark:text-neutral-200 font-bold mb-2">Display Name</label>
                    <input
                        type="text"
                        value={profile.name}
                        onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 focus:border-gray-400 dark:focus:border-neutral-500 outline-none font-medium"
                        placeholder="e.g. SunnySide Sales"
                    />
                    <p className="text-xs text-gray-400 dark:text-neutral-600 mt-1">Works for individuals and businesses — shown in page headers, receipts, and notifications.</p>
                </div>

                <div>
                    <label className="block text-brand-dark dark:text-neutral-200 font-bold mb-2">Tagline</label>
                    <input
                        type="text"
                        value={profile.tagline}
                        onChange={(e) => setProfile({ ...profile, tagline: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 focus:border-gray-400 dark:focus:border-neutral-500 outline-none font-medium"
                        placeholder="e.g. Best Deals in Town"
                    />
                </div>

                <div>
                    <label className="block text-brand-dark dark:text-neutral-200 font-bold mb-2">Description</label>
                    <textarea
                        value={profile.description}
                        onChange={(e) => setProfile({ ...profile, description: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 focus:border-gray-400 outline-none font-medium h-32"
                        placeholder="Bio or about text..."
                    />
                </div>

                <div>
                    <label className="block text-brand-dark dark:text-neutral-200 font-bold mb-2">Avatar / Logo</label>
                    <AvatarUpload
                        currentAvatarUrl={profile.avatarUrl}
                        onUploadComplete={(url) => setProfile({ ...profile, avatarUrl: url })}
                    />
                </div>

                <SubmitButton
                    isLoading={saving}
                    loadingLabel="Saving..."
                    label="Save Identity"
                    className="flex items-center gap-2 bg-brand-dark text-white px-6 py-3 rounded-xl font-bold hover:bg-brand-green hover:text-brand-dark transition-colors"
                >
                    <Save size={20} /> Save Identity
                </SubmitButton>
            </form>
        </div>
    );
}
