import { Staff } from '../../types';
import { User } from 'lucide-react';

interface StaffStepProps {
    staffList: Staff[];
    onSelect: (staff: Staff | null) => void;
}

export default function StaffStep({ staffList, onSelect }: StaffStepProps) {
    return (
        <div className="space-y-3">
            <button
                onClick={() => onSelect(null)}
                className="w-full text-left p-4 rounded-xl border border-gray-100 hover:border-brand-dark hover:shadow-md transition-all flex items-center gap-4"
            >
                <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-400">
                    <User size={20} />
                </div>
                <div>
                    <h3 className="font-bold text-brand-dark">Any Available Staff</h3>
                    <p className="text-xs text-gray-500">Maximum flexibility</p>
                </div>
            </button>

            {staffList.filter(s => s.isActive).map(staff => (
                <button
                    key={staff.id}
                    onClick={() => onSelect(staff)}
                    className="w-full text-left p-4 rounded-xl border border-gray-100 hover:border-brand-dark hover:shadow-md transition-all flex items-center gap-4"
                >
                    <div className="w-10 h-10 bg-brand-blue/10 text-brand-blue rounded-full flex items-center justify-center font-bold">
                        {staff.name.charAt(0)}
                    </div>
                    <div>
                        <h3 className="font-bold text-brand-dark">{staff.name}</h3>
                        <div className="flex flex-wrap gap-1 mt-0.5">
                            {(staff.label || 'Staff').split(',').map((tag, i) => (
                                <span key={i} className="text-[10px] uppercase font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
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
