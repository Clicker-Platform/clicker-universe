import React from 'react';
import { MapPin } from 'lucide-react';

interface MapFormProps {
    data: {
        address?: string;
    };
    onChange: (data: any) => void;
}

export const MapForm = ({ data, onChange }: MapFormProps) => {
    const safeData = data || {};

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onChange({ ...safeData, address: e.target.value });
    };

    return (
        <div className="space-y-4">
            <div>
                <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">Address</label>
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-neutral-500">
                        <MapPin size={18} />
                    </div>
                    <input
                        type="text"
                        value={safeData.address || ''}
                        onChange={handleChange}
                        className="w-full pl-11 pr-4 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-sm font-bold text-neutral-200 placeholder-neutral-600 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
                        placeholder="e.g. 1600 Amphitheatre Parkway, Mountain View, CA"
                    />
                </div>
                <p className="text-xs text-neutral-500 mt-2 font-medium">
                    Enter the full address to display on the map.
                </p>
            </div>

            {safeData.address && (
                <div className="rounded-2xl overflow-hidden border border-neutral-700 h-[220px] bg-neutral-900 mt-4 shadow-inner ring-1 ring-white/5">
                    <iframe
                        width="100%"
                        height="100%"
                        style={{ border: 0, filter: 'invert(90%) hue-rotate(180deg)' }} // Quick trick for dark map if API doesn't support theme
                        loading="lazy"
                        allowFullScreen
                        referrerPolicy="no-referrer-when-downgrade"
                        src={`https://maps.google.com/maps?q=${encodeURIComponent(safeData.address)}&t=&z=13&ie=UTF8&iwloc=&output=embed`}
                    ></iframe>
                </div>
            )}
        </div>
    );
};
