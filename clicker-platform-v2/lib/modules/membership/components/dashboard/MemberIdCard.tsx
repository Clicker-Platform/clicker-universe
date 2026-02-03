import React from 'react';
import { QrCode, Sparkles } from 'lucide-react';
import { Member } from '../../types';

interface MemberIdCardProps {
    member: Member;
}

export default function MemberIdCard({ member }: MemberIdCardProps) {
    return (
        <div className="bg-gradient-to-br from-indigo-600 to-purple-700 text-white p-6 rounded-b-3xl shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-10"><QrCode size={120} /></div>

            <div className="relative z-10 flex flex-col items-center text-center">
                <div className="w-20 h-20 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center mb-4 border-2 border-white/30">
                    <span className="text-3xl font-bold">{member.fullName.charAt(0)}</span>
                </div>
                <h1 className="text-2xl font-bold mb-1">{member.fullName}</h1>
                <p className="text-indigo-200 text-sm mb-6">{member.phoneNumber}</p>

                <div className="grid grid-cols-2 gap-4 w-full">
                    <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 flex flex-col items-center">
                        <span className="text-xs text-indigo-200 uppercase tracking-wider mb-1">Points</span>
                        <span className="text-2xl font-bold flex items-center gap-2">
                            <Sparkles size={18} className="text-yellow-300" />
                            {member.currentPoints.toLocaleString()}
                        </span>
                    </div>
                    <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 flex flex-col items-center">
                        <span className="text-xs text-indigo-200 uppercase tracking-wider mb-1">Tier</span>
                        <span className="text-xl font-bold">Gold</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
