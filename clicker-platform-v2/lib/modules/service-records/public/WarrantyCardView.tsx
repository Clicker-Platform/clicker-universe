'use client';

import { useState, useEffect } from 'react';
import { Shield, CheckCircle, XCircle, Clock, QrCode } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import type { SerializedWarrantyCard } from '../types';

interface Props {
    card: SerializedWarrantyCard;
    warrantyUrl: string;
}

function StatusBanner({ status }: { status: string }) {
    if (status === 'ACTIVE') {
        return (
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                <div>
                    <p className="text-sm font-semibold text-green-800">Warranty Active</p>
                    <p className="text-xs text-green-600">This warranty card is valid.</p>
                </div>
            </div>
        );
    }
    if (status === 'EXPIRED') {
        return (
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
                <Clock className="w-5 h-5 text-gray-400 flex-shrink-0" />
                <div>
                    <p className="text-sm font-semibold text-gray-600">Warranty Expired</p>
                    <p className="text-xs text-gray-400">This warranty period has ended.</p>
                </div>
            </div>
        );
    }
    return (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <div>
                <p className="text-sm font-semibold text-red-700">Warranty Voided</p>
                <p className="text-xs text-red-500">This warranty card has been voided.</p>
            </div>
        </div>
    );
}

function formatDate(isoString: string): string {
    return new Date(isoString).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
    });
}

function DaysRemaining({ expiryDate }: { expiryDate: string }) {
    const now = new Date();
    const expiry = new Date(expiryDate);
    const diffMs = expiry.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
        return <span className="text-red-500">Expired {Math.abs(diffDays)} days ago</span>;
    }
    if (diffDays <= 30) {
        return <span className="text-amber-600">{diffDays} days remaining</span>;
    }
    return <span className="text-green-600">{diffDays} days remaining</span>;
}

export default function WarrantyCardView({ card, warrantyUrl }: Props) {
    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Card */}
                <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100">
                    {/* Header */}
                    <div className="bg-gray-900 px-6 py-5 text-white">
                        <div className="flex items-center gap-3">
                            {card.businessLogo ? (
                                <img src={card.businessLogo} alt={card.businessName} className="w-10 h-10 rounded-lg object-cover" />
                            ) : (
                                <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
                                    <Shield className="w-6 h-6 text-white" />
                                </div>
                            )}
                            <div>
                                <p className="font-bold text-lg">{card.businessName}</p>
                                <p className="text-xs text-gray-300">Service Warranty Certificate</p>
                            </div>
                        </div>
                    </div>

                    {/* Body */}
                    <div className="p-6 space-y-5">
                        {/* Status */}
                        <StatusBanner status={card.status} />

                        {/* Warranty Code */}
                        <div className="text-center py-2">
                            <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">Warranty Code</p>
                            <p className="text-3xl font-mono font-bold text-gray-900 tracking-widest">{card.warrantyCode}</p>
                        </div>

                        {/* Vehicle */}
                        <div className="bg-gray-50 rounded-2xl p-4 space-y-3">
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Vehicle</p>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                    <p className="text-xs text-gray-400">Plate Number</p>
                                    <p className="font-mono font-bold text-gray-900 mt-0.5">{card.vehiclePlate}</p>
                                </div>
                                {card.vehicleMakeModel && (
                                    <div>
                                        <p className="text-xs text-gray-400">Make / Model</p>
                                        <p className="font-medium text-gray-800 mt-0.5">{card.vehicleMakeModel}</p>
                                    </div>
                                )}
                                {card.vehicleType && (
                                    <div>
                                        <p className="text-xs text-gray-400">Type</p>
                                        <p className="text-gray-700 mt-0.5">{card.vehicleType}</p>
                                    </div>
                                )}
                                {card.ownerName && (
                                    <div>
                                        <p className="text-xs text-gray-400">Owner</p>
                                        <p className="font-medium text-gray-800 mt-0.5">{card.ownerName}</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Service */}
                        <div className="bg-gray-50 rounded-2xl p-4 space-y-3">
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Service</p>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                    <p className="text-xs text-gray-400">Service Type</p>
                                    <p className="font-medium text-gray-800 mt-0.5">{card.serviceTypeName}</p>
                                </div>
                                {card.productUsed && (
                                    <div>
                                        <p className="text-xs text-gray-400">Product</p>
                                        <p className="font-medium text-gray-800 mt-0.5">{card.productUsed}</p>
                                    </div>
                                )}
                                <div>
                                    <p className="text-xs text-gray-400">Service Date</p>
                                    <p className="text-gray-700 mt-0.5">{formatDate(card.serviceDate)}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-400">Duration</p>
                                    <p className="text-gray-700 mt-0.5">{card.warrantyMonths} months</p>
                                </div>
                            </div>
                        </div>

                        {/* Expiry */}
                        <div className="border border-gray-100 rounded-2xl p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs text-gray-400">Warranty Valid Until</p>
                                    <p className="text-lg font-bold text-gray-900 mt-0.5">{formatDate(card.expiryDate)}</p>
                                </div>
                                {card.status === 'ACTIVE' && (
                                    <div className="text-right text-sm">
                                        <DaysRemaining expiryDate={card.expiryDate} />
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* QR Code — client-only to avoid hydration mismatch */}
                        <div className="flex flex-col items-center gap-2 py-2">
                            <div className="bg-white rounded-xl p-3 border border-gray-200 w-[136px] h-[136px] flex items-center justify-center">
                                {mounted ? (
                                    <QRCodeSVG
                                        value={warrantyUrl}
                                        size={112}
                                        level="M"
                                    />
                                ) : (
                                    <QrCode className="w-16 h-16 text-gray-300" />
                                )}
                            </div>
                            <p className="text-xs text-gray-400">Scan to verify warranty</p>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="px-6 pb-6 text-center">
                        <p className="text-xs text-gray-400">
                            Issued by {card.businessName} · {new Date(card.createdAt).getFullYear()}
                        </p>
                        <p className="text-xs text-gray-300 mt-1">
                            Powered by Clicker.id
                        </p>
                    </div>
                </div>

                {/* PDF Download link */}
                <div className="text-center mt-4">
                    <a
                        href={`/api/warranty/${card.warrantyCode}/pdf`}
                        className="text-sm text-gray-500 hover:text-gray-700 underline"
                    >
                        Download PDF
                    </a>
                </div>
            </div>
        </div>
    );
}
