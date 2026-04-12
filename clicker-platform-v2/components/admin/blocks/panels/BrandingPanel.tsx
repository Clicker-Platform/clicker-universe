'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useSite } from '@/lib/site-context';
import { usePageStudio } from '@/components/admin/blocks/PageStudioContext';
import { BusinessProfile } from '@/data/mockData';
import { AvatarUpload } from '@/components/common/AvatarUpload';
import { Loader2, Check } from 'lucide-react';

// ── Shared styles ─────────────────────────────────────────────────────────

const inputClass = "w-full px-3 py-2 bg-gray-100 dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 rounded-lg text-sm text-neutral-900 dark:text-neutral-200 placeholder-neutral-400 dark:placeholder-neutral-600 focus:border-blue-500/50 focus:outline-none transition-colors";
const labelClass = "block text-xs font-medium text-neutral-400 dark:text-neutral-500 mb-1";
const sectionClass = "px-4 py-3 border-b border-gray-200 dark:border-neutral-800/60 space-y-3";

// ── Main panel ────────────────────────────────────────────────────────────

export function BrandingPanel() {
    const { siteId } = useSite();
    const { refreshGlobalSettings } = usePageStudio();
    const [profile, setProfile] = useState<BusinessProfile>({
        name: '',
        tagline: '',
        description: '',
        avatarUrl: '',
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        if (!siteId) return;
        getDoc(doc(db, 'sites', siteId, 'content', 'profile')).then(snap => {
            if (snap.exists()) setProfile(snap.data() as BusinessProfile);
        }).finally(() => setLoading(false));
    }, [siteId]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!siteId) return;
        setSaving(true);
        try {
            await setDoc(doc(db, 'sites', siteId, 'content', 'profile'), profile, { merge: true });
            await refreshGlobalSettings();
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } catch (err) {
            console.error(err);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-32 text-neutral-600">
                <Loader2 size={20} className="animate-spin" />
            </div>
        );
    }

    return (
        <form onSubmit={handleSave} className="flex flex-col h-full overflow-y-auto custom-scrollbar">

            {/* ── Branding Identity ─────────────────────────────────────── */}
            <div className={sectionClass}>
                <div className="text-[10px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">Branding</div>

                <div>
                    <label className={labelClass}>Display Name</label>
                    <input
                        value={profile.name || ''}
                        onChange={e => setProfile(p => ({ ...p, name: e.target.value }))}
                        className={inputClass}
                        placeholder="e.g. SunnySide Sales"
                    />
                    <p className="text-[10px] text-neutral-400 dark:text-neutral-600 mt-1">Works for individuals and businesses — shown in page headers, receipts, and notifications.</p>
                </div>

                <div>
                    <label className={labelClass}>Tagline</label>
                    <input
                        value={profile.tagline || ''}
                        onChange={e => setProfile(p => ({ ...p, tagline: e.target.value }))}
                        className={inputClass}
                        placeholder="e.g. Best Deals in Town"
                    />
                </div>

                <div>
                    <label className={labelClass}>Description</label>
                    <textarea
                        value={profile.description || ''}
                        onChange={e => setProfile(p => ({ ...p, description: e.target.value }))}
                        className={`${inputClass} resize-none h-20`}
                        placeholder="Bio or about text..."
                    />
                </div>
            </div>

            {/* ── Avatar / Logo ─────────────────────────────────────────── */}
            <div className={sectionClass}>
                <div className="text-[10px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">Avatar / Logo</div>
                <AvatarUpload
                    currentAvatarUrl={profile.avatarUrl}
                    onUploadComplete={(url) => setProfile(p => ({ ...p, avatarUrl: url }))}
                />
            </div>

            {/* ── Save Button ────────────────────────────────────────────── */}
            <div className="sticky bottom-0 bg-gray-50 dark:bg-neutral-900/80 border-t border-gray-200 dark:border-neutral-800 px-4 py-3 flex items-center justify-between">
                <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-medium text-sm transition-colors"
                >
                    {saving ? 'Saving...' : 'Save'}
                </button>
                {saved && (
                    <div className="flex items-center gap-1.5 text-green-600 dark:text-green-500 text-sm font-medium">
                        <Check size={16} />
                        Saved
                    </div>
                )}
            </div>
        </form>
    );
}
