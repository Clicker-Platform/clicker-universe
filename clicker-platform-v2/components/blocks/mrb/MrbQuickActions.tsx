'use client';

import React from 'react';
import { LinkItem, BusinessContact, LinkSettings } from '@/data/mockData';
import { useTemplate } from '@/components/TemplateProvider';
import { getWhatsappUrl } from '@/components/common/WhatsappButton';
import { FormModal } from '@/components/FormModal';
import { useSite } from '@/lib/site-context';
import { useDeviceView, dv } from '@/components/DeviceViewContext';
import { useAnalytics } from '@/hooks/useAnalytics';
import { ICON_MAP } from '@/data/icons';
import { ShoppingBag } from 'lucide-react';

interface QuickActionsProps {
    links: LinkItem[];
    contact?: BusinessContact;
    settings?: LinkSettings;
    siteId?: string;
    tenantSlug?: string;
    blockData?: { hiddenLinkIds?: string[]; layout?: 'list' | 'grid' };
}

export const MrbQuickActions: React.FC<QuickActionsProps> = ({ links, contact, settings, siteId, tenantSlug, blockData }) => {
    const { theme } = useTemplate();
    const d = useDeviceView();
    const { track } = useAnalytics();
    const { siteId: contextSiteId } = useSite();
    const effectiveSiteId = siteId || contextSiteId;

    const [isModalOpen, setIsModalOpen] = React.useState(false);
    const [formData, setFormData] = React.useState<any>(null);
    const [isLoadingForm, setIsLoadingForm] = React.useState(false);

    // Default settings if not provided
    const sectionTitle = settings?.sectionTitle || "Quick Actions";
    const showOnHome = settings?.showOnHome !== false;
    const hiddenLinkIds: string[] = blockData?.hiddenLinkIds || [];
    const layout: 'list' | 'grid' = blockData?.layout || 'grid';

    const processedLinks = links
        .filter(link => !link.hideOnHome && !hiddenLinkIds.includes(link.id))
        .map(link => {
            if (contact?.whatsapp && link.url === '#' && (link.title.toLowerCase().includes('whatsapp') || link.title.toLowerCase().includes('order'))) {
                return {
                    ...link,
                    url: getWhatsappUrl(contact.whatsapp, "Hi! I'd like to reach out...")
                };
            }
            return link;
        });

    const getTenantAwareUrl = (url: string): string => {
        if (url.startsWith('http') || url.startsWith('#') || url.startsWith('mailto:') || url.startsWith('tel:')) {
            return url;
        }
        if (tenantSlug && url.startsWith('/')) {
            return `/${tenantSlug}${url}`;
        }
        return url;
    };

    const handleClick = async (e: React.MouseEvent, item: LinkItem) => {
        track({ type: 'link_click', id: item.id, siteId: effectiveSiteId });

        if (item.type === 'form' && item.formId) {
            e.preventDefault();
            if (!formData) {
                setIsLoadingForm(true);
                try {
                    const res = await fetch(`/api/forms?id=${item.formId}&siteId=${siteId}`);
                    if (res.ok) {
                        const data = await res.json();
                        setFormData(data);
                        setIsModalOpen(true);
                    }
                } catch (error) {
                    console.error('Error loading form:', error);
                }
                setIsLoadingForm(false);
            } else {
                setIsModalOpen(true);
            }
        }
    };

    return (
        <section className="w-full">
            {showOnHome && !theme.custom?.hideQuickActionsTitle && (
                <h3 className="text-slate-400 text-xs font-bold uppercase tracking-[0.2em] mb-6">
                    {sectionTitle}
                </h3>
            )}
            <div className={layout === 'list' ? 'flex flex-col gap-3' : `grid ${dv(d, 'grid-cols-1', 'sm:grid-cols-3')} gap-4`}>
                {processedLinks.map((link) => {
                    const Icon = link.iconName && ICON_MAP[link.iconName] ? ICON_MAP[link.iconName] : ShoppingBag;
                    const Wrapper = link.type === 'form' ? 'button' : 'a';
                    const wrapperProps: any = link.type === 'form' ? {
                        onClick: (e: any) => handleClick(e, link),
                        type: 'button'
                    } : {
                        href: getTenantAwareUrl(link.url),
                        target: link.openInNewTab ? '_blank' : undefined,
                        rel: link.openInNewTab ? 'noopener noreferrer' : undefined,
                        onClick: (e: any) => handleClick(e, link)
                    };

                    const isHighlight = link.highlight;

                    return (
                        <Wrapper
                            key={link.id}
                            {...wrapperProps}
                            className={`
                                group relative overflow-hidden rounded-2xl glass-effect transition-all hover:bg-primary/10 w-full
                                ${layout === 'list' ? 'p-4 flex items-center gap-4' : 'p-6 flex flex-col items-center justify-center gap-4'}
                                ${isHighlight ? 'neon-border border-primary/50' : 'border-white/10'}
                            `}
                            style={{
                                background: 'rgba(26, 26, 26, 0.6)',
                                backdropFilter: 'blur(12px)',
                                borderWidth: '1px'
                            }}
                        >
                            <div className={`
                                rounded-full flex items-center justify-center group-hover:scale-110 transition-transform
                                ${layout === 'list' ? 'size-10 shrink-0' : 'size-14'}
                                ${isHighlight ? 'bg-primary/20 text-primary' : 'bg-white/10 text-white'}
                            `}>
                                <Icon size={layout === 'list' ? 20 : 28} strokeWidth={2} />
                            </div>
                            <div className={layout === 'list' ? 'text-left flex-1' : 'text-center'}>
                                <p className="text-white font-bold text-lg">{link.title}</p>
                                {link.subtitle && (
                                    <p className="text-slate-500 text-sm">{link.subtitle}</p>
                                )}
                            </div>

                            {/* Loading State Overlay */}
                            {isLoadingForm && link.type === 'form' && (
                                <div className="absolute inset-0 bg-background-dark/50 flex items-center justify-center">
                                    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                                </div>
                            )}
                        </Wrapper>
                    );
                })}
            </div>

            {isModalOpen && formData && (
                <FormModal
                    form={formData}
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    siteId={effectiveSiteId}
                />
            )}
        </section>
    );
};
