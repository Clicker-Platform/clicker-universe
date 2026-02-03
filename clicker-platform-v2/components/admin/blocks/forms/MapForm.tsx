import React from 'react';
import { MapPin } from 'lucide-react';

interface MapFormProps {
    data: {
        address?: string;
    };
    onChange: (data: any) => void;
}

export const MapForm = ({ data, onChange }: MapFormProps) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onChange({ ...data, address: e.target.value });
    };

    return (
        <div className="space-y-4">
            <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Address</label>
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                        <MapPin size={18} />
                    </div>
                    <input
                        type="text"
                        value={data.address || ''}
                        onChange={handleChange}
                        className="w-full pl-10 pr-4 py-2 bg-gray-50 border-2 border-gray-200 rounded-xl focus:border-brand-dark focus:ring-0 transition-all outline-none"
                        placeholder="e.g. 1600 Amphitheatre Parkway, Mountain View, CA"
                    />
                </div>
                <p className="text-xs text-gray-500 mt-2">
                    Enter the full address to display on the map.
                </p>
            </div>

            {data.address && (
                <div className="rounded-xl overflow-hidden border border-gray-200 h-[200px] bg-gray-100 mt-4">
                    <iframe
                        width="100%"
                        height="100%"
                        style={{ border: 0 }}
                        loading="lazy"
                        allowFullScreen
                        referrerPolicy="no-referrer-when-downgrade"
                        src={`https://maps.google.com/maps?q=${encodeURIComponent(data.address)}&t=&z=13&ie=UTF8&iwloc=&output=embed`}
                    ></iframe>
                </div>
            )}
        </div>
    );
};
