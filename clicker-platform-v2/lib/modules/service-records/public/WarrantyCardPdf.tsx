// @ts-nocheck — @react-pdf/renderer types are not yet compatible with React 19 JSX
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';
import type { SerializedWarrantyCard } from '../types';

const styles = StyleSheet.create({
    page: {
        padding: 40,
        fontFamily: 'Helvetica',
        backgroundColor: '#FFFFFF',
    },
    header: {
        backgroundColor: '#111827',
        borderRadius: 8,
        padding: 20,
        marginBottom: 20,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    headerIcon: {
        width: 36,
        height: 36,
        borderRadius: 8,
        backgroundColor: 'rgba(255,255,255,0.2)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerIconText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontFamily: 'Helvetica-Bold',
    },
    businessName: {
        color: '#FFFFFF',
        fontSize: 16,
        fontFamily: 'Helvetica-Bold',
    },
    subtitle: {
        color: '#D1D5DB',
        fontSize: 9,
        marginTop: 2,
    },
    statusBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        borderRadius: 8,
        padding: 12,
        marginBottom: 16,
    },
    statusActive: {
        backgroundColor: '#F0FDF4',
        borderWidth: 1,
        borderColor: '#BBF7D0',
    },
    statusExpired: {
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    statusVoided: {
        backgroundColor: '#FEF2F2',
        borderWidth: 1,
        borderColor: '#FECACA',
    },
    statusDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    statusText: {
        fontSize: 11,
        fontFamily: 'Helvetica-Bold',
    },
    statusSubtext: {
        fontSize: 8,
    },
    codeSection: {
        textAlign: 'center',
        marginBottom: 16,
        paddingVertical: 8,
    },
    codeLabel: {
        fontSize: 8,
        color: '#9CA3AF',
        letterSpacing: 2,
        textTransform: 'uppercase',
        marginBottom: 4,
    },
    codeValue: {
        fontSize: 24,
        fontFamily: 'Courier-Bold',
        color: '#111827',
        letterSpacing: 3,
    },
    section: {
        backgroundColor: '#F9FAFB',
        borderRadius: 8,
        padding: 14,
        marginBottom: 12,
    },
    sectionLabel: {
        fontSize: 8,
        fontFamily: 'Helvetica-Bold',
        color: '#6B7280',
        letterSpacing: 1.5,
        textTransform: 'uppercase',
        marginBottom: 10,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    gridItem: {
        width: '48%',
    },
    fieldLabel: {
        fontSize: 8,
        color: '#9CA3AF',
        marginBottom: 2,
    },
    fieldValue: {
        fontSize: 10,
        color: '#111827',
        fontFamily: 'Helvetica-Bold',
    },
    fieldValueNormal: {
        fontSize: 10,
        color: '#374151',
    },
    expirySection: {
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 8,
        padding: 14,
        marginBottom: 16,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    expiryDate: {
        fontSize: 14,
        fontFamily: 'Helvetica-Bold',
        color: '#111827',
        marginTop: 2,
    },
    daysRemaining: {
        fontSize: 10,
    },
    footer: {
        textAlign: 'center',
        marginTop: 20,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
    },
    footerText: {
        fontSize: 8,
        color: '#9CA3AF',
    },
    footerPowered: {
        fontSize: 8,
        color: '#D1D5DB',
        marginTop: 4,
    },
    urlText: {
        fontSize: 9,
        color: '#6B7280',
        textAlign: 'center',
        marginTop: 12,
    },
});

function formatDate(isoString: string): string {
    return new Date(isoString).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
    });
}

function getDaysRemaining(expiryDate: string): { text: string; color: string } {
    const now = new Date();
    const expiry = new Date(expiryDate);
    const diffMs = expiry.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
        return { text: `Expired ${Math.abs(diffDays)} days ago`, color: '#EF4444' };
    }
    if (diffDays <= 30) {
        return { text: `${diffDays} days remaining`, color: '#D97706' };
    }
    return { text: `${diffDays} days remaining`, color: '#16A34A' };
}

function getStatusStyles(status: string) {
    if (status === 'ACTIVE') {
        return {
            banner: styles.statusActive,
            dotColor: '#22C55E',
            textColor: '#166534',
            subtextColor: '#16A34A',
            label: 'Warranty Active',
            sublabel: 'This warranty card is valid.',
        };
    }
    if (status === 'EXPIRED') {
        return {
            banner: styles.statusExpired,
            dotColor: '#9CA3AF',
            textColor: '#4B5563',
            subtextColor: '#9CA3AF',
            label: 'Warranty Expired',
            sublabel: 'This warranty period has ended.',
        };
    }
    return {
        banner: styles.statusVoided,
        dotColor: '#EF4444',
        textColor: '#B91C1C',
        subtextColor: '#EF4444',
        label: 'Warranty Voided',
        sublabel: 'This warranty card has been voided.',
    };
}

interface Props {
    card: SerializedWarrantyCard;
    warrantyUrl: string;
}

export default function WarrantyCardPdf({ card, warrantyUrl }: Props) {
    const statusInfo = getStatusStyles(card.status);
    const daysInfo = getDaysRemaining(card.expiryDate);

    return (
        <Document>
            <Page size="A4" style={styles.page}>
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.headerIcon}>
                        <Text style={styles.headerIconText}>&#9763;</Text>
                    </View>
                    <View>
                        <Text style={styles.businessName}>{card.businessName}</Text>
                        <Text style={styles.subtitle}>Service Warranty Certificate</Text>
                    </View>
                </View>

                {/* Status Banner */}
                <View style={[styles.statusBanner, statusInfo.banner]}>
                    <View style={[styles.statusDot, { backgroundColor: statusInfo.dotColor }]} />
                    <View>
                        <Text style={[styles.statusText, { color: statusInfo.textColor }]}>{statusInfo.label}</Text>
                        <Text style={[styles.statusSubtext, { color: statusInfo.subtextColor }]}>{statusInfo.sublabel}</Text>
                    </View>
                </View>

                {/* Warranty Code */}
                <View style={styles.codeSection}>
                    <Text style={styles.codeLabel}>Warranty Code</Text>
                    <Text style={styles.codeValue}>{card.warrantyCode}</Text>
                </View>

                {/* Vehicle */}
                <View style={styles.section}>
                    <Text style={styles.sectionLabel}>Vehicle</Text>
                    <View style={styles.grid}>
                        <View style={styles.gridItem}>
                            <Text style={styles.fieldLabel}>Plate Number</Text>
                            <Text style={styles.fieldValue}>{card.vehiclePlate}</Text>
                        </View>
                        {card.vehicleMakeModel && (
                            <View style={styles.gridItem}>
                                <Text style={styles.fieldLabel}>Make / Model</Text>
                                <Text style={styles.fieldValue}>{card.vehicleMakeModel}</Text>
                            </View>
                        )}
                        {card.vehicleType && (
                            <View style={styles.gridItem}>
                                <Text style={styles.fieldLabel}>Type</Text>
                                <Text style={styles.fieldValueNormal}>{card.vehicleType}</Text>
                            </View>
                        )}
                        {card.ownerName && (
                            <View style={styles.gridItem}>
                                <Text style={styles.fieldLabel}>Owner</Text>
                                <Text style={styles.fieldValue}>{card.ownerName}</Text>
                            </View>
                        )}
                    </View>
                </View>

                {/* Service */}
                <View style={styles.section}>
                    <Text style={styles.sectionLabel}>Service</Text>
                    <View style={styles.grid}>
                        <View style={styles.gridItem}>
                            <Text style={styles.fieldLabel}>Service Type</Text>
                            <Text style={styles.fieldValue}>{card.serviceTypeName}</Text>
                        </View>
                        {card.productUsed && (
                            <View style={styles.gridItem}>
                                <Text style={styles.fieldLabel}>Product</Text>
                                <Text style={styles.fieldValue}>{card.productUsed}</Text>
                            </View>
                        )}
                        <View style={styles.gridItem}>
                            <Text style={styles.fieldLabel}>Service Date</Text>
                            <Text style={styles.fieldValueNormal}>{formatDate(card.serviceDate)}</Text>
                        </View>
                        <View style={styles.gridItem}>
                            <Text style={styles.fieldLabel}>Duration</Text>
                            <Text style={styles.fieldValueNormal}>{card.warrantyMonths} months</Text>
                        </View>
                    </View>
                </View>

                {/* Expiry */}
                <View style={styles.expirySection}>
                    <View>
                        <Text style={styles.fieldLabel}>Warranty Valid Until</Text>
                        <Text style={styles.expiryDate}>{formatDate(card.expiryDate)}</Text>
                    </View>
                    {card.status === 'ACTIVE' && (
                        <Text style={[styles.daysRemaining, { color: daysInfo.color }]}>{daysInfo.text}</Text>
                    )}
                </View>

                {/* Verification URL */}
                <Text style={styles.urlText}>
                    Verify online: {warrantyUrl}
                </Text>

                {/* Footer */}
                <View style={styles.footer}>
                    <Text style={styles.footerText}>
                        Issued by {card.businessName} · {new Date(card.createdAt).getFullYear()}
                    </Text>
                    <Text style={styles.footerPowered}>Powered by Clicker.id</Text>
                </View>
            </Page>
        </Document>
    );
}