import { Staff } from '../../types';
import { User } from 'lucide-react';

interface StaffStepProps {
    staffList: Staff[];
    onSelect: (staff: Staff | null) => void;
    isGlass?: boolean;
}

export default function StaffStep({ staffList, onSelect, isGlass = false }: StaffStepProps) {
    const rowClass = `w-full text-left p-4 rounded-xl border transition-all flex items-center gap-4 ${
        isGlass
            ? 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
            : 'border-gray-200 hover:border-gray-900 hover:shadow-md'
    }`;

    return (
        <div className="space-y-3">
            <button onClick={() => onSelect(null)} className={rowClass}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    isGlass ? 'bg-white/10 text-white/60' : 'bg-gray-100 text-gray-400'
                }`}>
                    <User size={20} />
                </div>
                <div>
                    <h3 className={`font-bold ${isGlass ? 'text-white' : 'text-gray-900'}`}>Any Available Staff</h3>
                    <p className={`text-xs ${isGlass ? 'text-white/50' : 'text-gray-500'}`}>Maximum flexibility</p>
                </div>
            </button>

            {staffList.filter(s => s.isActive).map(staff => (
                <button key={staff.id} onClick={() => onSelect(staff)} className={rowClass}>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                        isGlass ? 'bg-white/10 text-white' : 'bg-blue-100 text-blue-600'
                    }`}>
                        {staff.name.charAt(0)}
                    </div>
                    <div>
                        <h3 className={`font-bold ${isGlass ? 'text-white' : 'text-gray-900'}`}>{staff.name}</h3>
                        <div className="flex flex-wrap gap-1 mt-0.5">
                            {(staff.label || 'Staff').split(',').map((tag, i) => (
                                <span key={i} className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                                    isGlass ? 'text-white/50 bg-white/10' : 'text-gray-500 bg-gray-100'
                                }`}>
                                    {tag.trim()}
                                </span>
                            ))}
                        </div>
                    </div>
                </button>
            ))}
        </div>
    );
}
