'use client';

import { useState } from 'react';
import { SocialLinkItem } from '@/data/mockData';
import {
    Instagram,
    Facebook,
    Twitter,
    Linkedin,
    Globe,
    Trash2,
    Plus,
    Video // As TikTok replacement
} from 'lucide-react';

interface SocialMediaManagerProps {
    links: SocialLinkItem[];
    onChange: (links: SocialLinkItem[]) => void;
}

const PLATFORMS = [
    { name: 'Instagram', icon: Instagram, placeholder: 'https://instagram.com/username' },
    { name: 'Tiktok', icon: Video, placeholder: 'https://tiktok.com/@username' },
    { name: 'X', icon: Twitter, placeholder: 'https://x.com/username' },
    { name: 'Linkedin', icon: Linkedin, placeholder: 'https://linkedin.com/in/username' },
    { name: 'Facebook', icon: Facebook, placeholder: 'https://facebook.com/username' },
    { name: 'Custom', icon: Globe, placeholder: 'https://example.com' },
];

export function SocialMediaManager({ links, onChange }: SocialMediaManagerProps) {
    const [selectedPlatform, setSelectedPlatform] = useState(PLATFORMS[0].name);
    const [url, setUrl] = useState('');

    const handleAdd = () => {
        if (!url) return;
        const newLink: SocialLinkItem = {
            platform: selectedPlatform,
            url: url
        };
        onChange([...(links || []), newLink]);
        setUrl('');
    };

    const handleRemove = (index: number) => {
        const newLinks = [...(links || [])];
        newLinks.splice(index, 1);
        onChange(newLinks);
    };

    const currentPlatform = PLATFORMS.find(p => p.name === selectedPlatform) || PLATFORMS[0];

    return (
        <div className="space-y-6">
            <h2 className="text-xl font-bold text-brand-dark">Social Media Links</h2>

            {/* Add New Link */}
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <div className="flex flex-col gap-4">
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Platform</label>
                        <div className="flex flex-wrap gap-2">
                            {PLATFORMS.map((p) => (
                                <button
                                    key={p.name}
                                    type="button"
                                    onClick={() => setSelectedPlatform(p.name)}
                                    className={`
                                        flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold transition-all
                                        ${selectedPlatform === p.name
                                            ? 'bg-brand-dark text-white shadow-md'
                                            : 'bg-white border border-gray-200 text-gray-600 hover:border-brand-dark'
                                        }
                                    `}
                                >
                                    <p.icon size={16} />
                                    {p.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">URL or Username</label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                placeholder={currentPlatform.placeholder}
                                className="flex-1 px-4 py-2 rounded-lg border border-gray-200 focus:border-gray-400 outline-none font-medium text-sm"
                            />
                            <button
                                type="button"
                                onClick={handleAdd}
                                disabled={!url}
                                className="bg-brand-dark text-white px-4 rounded-lg font-bold hover:bg-brand-green hover:text-brand-dark transition-colors disabled:opacity-50 flex items-center gap-2"
                            >
                                <Plus size={18} />
                                Add
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* List of Links */}
            <div className="space-y-3">
                {links && links.length > 0 ? (
                    links.map((link, index) => {
                        const platformData = PLATFORMS.find(p => p.name === link.platform) || PLATFORMS[5]; // Default to Custom
                        const Icon = platformData.icon;

                        return (
                            <div key={index} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg">
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0 text-gray-600">
                                        <Icon size={20} />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="font-bold text-brand-dark text-sm">{link.platform}</div>
                                        <div className="text-xs text-gray-500 truncate">{link.url}</div>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => handleRemove(index)}
                                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        );
                    })
                ) : (
                    <div className="text-center py-6 text-gray-400 text-sm italic">
                        No social media links added yet.
                    </div>
                )}
            </div>
        </div>
    );
}
