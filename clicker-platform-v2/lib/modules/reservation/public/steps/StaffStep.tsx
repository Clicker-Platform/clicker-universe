import { Staff } from '../../types';
import { User } from 'lucide-react';
import { ThemeConfig } from '@/lib/templates/types';

interface StaffStepProps {
    staffList: Staff[];
    onSelect: (staff: Staff | null) => void;
    theme: ThemeConfig;
    staffLabel?: string;
}

export default function StaffStep({ staffList, onSelect, theme, staffLabel = 'Staff' }: StaffStepProps) {
    const isGlass = theme.decorations?.surfaceStyle === 'glass' || theme.cardStyle === 'glass';
    const surfaceBg = theme.colors.surfaceElevated || theme.colors.surface || '#ffffff';
    const borderColor = isGlass ? 'rgba(255,255,255,0.1)' : (theme.colors.border || '#e5e7eb');
    const mutedText = theme.colors.textMuted || theme.colors.foreground;
    const subtleText = theme.colors.textSubtle || theme.colors.muted || theme.colors.foreground;

    const rowStyle = {
        backgroundColor: surfaceBg,
        borderColor,
        color: theme.colors.foreground,
    };

    return (
        <div className="space-y-3">
            <button
                onClick={() => onSelect(null)}
                className="w-full text-left p-4 border transition-all flex items-center gap-4 hover:shadow-md"
                style={{ ...rowStyle, borderRadius: 'calc(var(--theme-radius) * 0.75)' }}
            >
                <div className="w-10 h-10 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: surfaceBg, color: mutedText }}>
                    <User size={20} />
                </div>
                <div>
                    <h3 className="font-bold" style={{ color: theme.colors.foreground }}>Any Available {staffLabel}</h3>
                    <p className="text-xs" style={{ color: subtleText }}>Maximum flexibility</p>
                </div>
            </button>

            {staffList.filter(s => s.isActive).map(staff => (
                <button
                    key={staff.id}
                    onClick={() => onSelect(staff)}
                    className="w-full text-left p-4 border transition-all flex items-center gap-4 hover:shadow-md"
                    style={{ ...rowStyle, borderRadius: 'calc(var(--theme-radius) * 0.75)' }}
                >
                    <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold"
                        style={{ backgroundColor: `${theme.colors.primary}20`, color: theme.colors.primary }}>
                        {staff.name.charAt(0)}
                    </div>
                    <div>
                        <h3 className="font-bold" style={{ color: theme.colors.foreground }}>{staff.name}</h3>
                        <div className="flex flex-wrap gap-1 mt-0.5">
                            {(staff.label || 'Staff').split(',').map((tag, i) => (
                                <span key={i} className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded"
                                    style={{ backgroundColor: `${theme.colors.primary}15`, color: mutedText }}>
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
