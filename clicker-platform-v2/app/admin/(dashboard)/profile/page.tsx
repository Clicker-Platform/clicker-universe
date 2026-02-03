'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { BusinessProfile } from '@/data/mockData';
import { Save } from 'lucide-react';
import { FormSkeleton } from '@/components/skeletons/FormSkeleton';
import { AvatarUpload } from '@/components/common/AvatarUpload';
import { SubmitButton } from '@/components/admin/SubmitButton';
import { AccountSecurity } from '@/components/admin/AccountSecurity';
// ... imports
import { useSite } from '@/lib/site-context';

export default function ProfileEditor() {
    const { siteId } = useSite();
    const [profile, setProfile] = useState<BusinessProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => {
        if (!siteId) return;
        fetchProfile();
    }, [siteId]);

    const fetchProfile = async () => {
        if (!siteId) return;
        try {
            const snap = await getDoc(doc(db, 'sites', siteId, 'content', 'profile'));
            if (snap.exists()) {
                setProfile(snap.data() as BusinessProfile);
            } else {
                // Initialize default/empty profile if none exists
                setProfile({
                    name: '',
                    tagline: '',
                    description: '',
                    avatarUrl: ''
                });
            }
        } catch (error) {
            console.error('Error fetching profile:', error);
            // Fallback to empty profile on error to allow creation
            setProfile({
                name: '',
                tagline: '',
                description: '',
                avatarUrl: ''
            });
        }
        setLoading(false);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!profile || !siteId) return;
        setSaving(true);
        setMessage('');

        try {
            // Use setDoc with merge to create or update
            await setDoc(doc(db, 'sites', siteId, 'content', 'profile'), profile, { merge: true });
            setMessage('Profile updated successfully!');
        } catch (err) {
            console.error(err);
            setMessage('Error updating profile');
        }
        setSaving(false);
    };

    if (loading) return <FormSkeleton />;

    // Safety check, though fetchProfile ensures profile is set
    if (!profile) return <div>Initializing...</div>;

    return (
        <div className="max-w-2xl">
            <h1 className="text-3xl font-black text-brand-dark mb-8 uppercase">Edit Profile</h1>

            {message && (
                <div className={`p-4 rounded-xl mb-6 font-bold ${message.includes('Error') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                    {message}
                </div>
            )}

            <form onSubmit={handleSave} className={`space-y-6 bg-white p-8 rounded-3xl border-[3px] border-brand-dark shadow-sm transition-opacity duration-200 ${saving ? 'opacity-50 pointer-events-none' : ''}`}>
                <div>
                    <label className="block text-brand-dark font-bold mb-2">Business Name</label>
                    <input
                        type="text"
                        value={profile.name}
                        onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border-[2px] border-gray-200 focus:border-brand-dark outline-none font-medium"
                        placeholder="e.g. SunnySide Sales"
                    />
                </div>

                <div>
                    <label className="block text-brand-dark font-bold mb-2">Tagline</label>
                    <input
                        type="text"
                        value={profile.tagline}
                        onChange={(e) => setProfile({ ...profile, tagline: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border-[2px] border-gray-200 focus:border-brand-dark outline-none font-medium"
                        placeholder="e.g. Best Deals in Town"
                    />
                </div>

                <div>
                    <label className="block text-brand-dark font-bold mb-2">Description</label>
                    <textarea
                        value={profile.description}
                        onChange={(e) => setProfile({ ...profile, description: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border-[2px] border-gray-200 focus:border-brand-dark outline-none font-medium h-32"
                        placeholder="Tell us about your business..."
                    />
                </div>

                <div>
                    <label className="block text-brand-dark font-bold mb-2">Avatar</label>
                    <AvatarUpload
                        currentAvatarUrl={profile.avatarUrl}
                        onUploadComplete={(url) => setProfile({ ...profile, avatarUrl: url })}
                    />
                </div>

                <SubmitButton
                    isLoading={saving}
                    loadingLabel="Saving..."
                    label="Save Changes"
                    className="flex items-center gap-2 bg-brand-dark text-white px-6 py-3 rounded-xl font-bold hover:bg-brand-green hover:text-brand-dark transition-colors"
                >
                    <Save size={20} /> Save Changes
                </SubmitButton>
            </form>

            <AccountSecurity />
        </div >
    );
}
