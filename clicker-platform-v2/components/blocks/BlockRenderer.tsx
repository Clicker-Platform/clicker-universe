import React from 'react';
import dynamic from 'next/dynamic';
import { PageBlock } from '@/data/mockData';

// Static imports for LCP-critical above-the-fold blocks
import { DefaultHeroBlock as HeroBlock } from './public/DefaultHeroBlock';
import { DefaultImageGalleryBlock as ImageGalleryBlock } from './public/DefaultImageGalleryBlock';

// Dynamically import remaining blocks to reduce initial bundle size
const TextBlock = dynamic(() => import('./public/DefaultTextBlock').then(mod => mod.DefaultTextBlock));
const ContentShowcaseBlock = dynamic(() => import('./public/DefaultContentShowcaseBlock').then(mod => mod.DefaultContentShowcaseBlock));
const ImageBlock = dynamic(() => import('./public/DefaultImageBlock').then(mod => mod.DefaultImageBlock));
const ButtonBlock = dynamic(() => import('./public/DefaultButtonBlock').then(mod => mod.DefaultButtonBlock));
const ProductsBlock = dynamic(() => import('./public/DefaultProductsBlock').then(mod => mod.DefaultProductsBlock));
const FAQBlock = dynamic(() => import('./public/DefaultFAQBlock').then(mod => mod.DefaultFAQBlock));
const LinkBlock = dynamic(() => import('./public/DefaultLinkBlock').then(mod => mod.DefaultLinkBlock));
const MapBlock = dynamic(() => import('./public/DefaultMapBlock').then(mod => mod.DefaultMapBlock));
const ReservationBlock = dynamic(() => import('./public/ReservationBlock').then(mod => mod.ReservationBlock));
const SocialEmbedBlock = dynamic(() => import('./public/DefaultSocialEmbedBlock').then(mod => mod.DefaultSocialEmbedBlock));
const InlineFormBlock = dynamic(() => import('./public/DefaultInlineFormBlock').then(mod => mod.DefaultInlineFormBlock));
const HeadingBlock = dynamic(() => import('./public/DefaultHeadingBlock').then(mod => mod.DefaultHeadingBlock));
const FeatureCardsBlock = dynamic(() => import('./public/DefaultFeatureCardsBlock').then(mod => mod.DefaultFeatureCardsBlock));

// System blocks (from PublicPageRenderer)
const QuickActions = dynamic(() => import('./public/DefaultQuickActionsBlock').then(mod => mod.DefaultQuickActionsBlock));
const OperatingHours = dynamic(() => import('./public/DefaultOperatingHoursBlock').then(mod => mod.DefaultOperatingHoursBlock));
const BranchesList = dynamic(() => import('./public/DefaultBranchesBlock').then(mod => mod.DefaultBranchesBlock));
const FeaturedProductBlock = dynamic(() => import('./public/DefaultFeaturedProductBlock').then(mod => mod.DefaultFeaturedProductBlock));


import { ModuleBlockLoader } from '@/components/modules/ModuleBlockLoader';

import { SafeBlockRenderer } from './SafeBlockRenderer';
import { getTemplate } from '@/lib/templates/registry';

export const BlockRenderer = ({
    block,
    isFirst = false,
    phoneNumber,
    whatsappSettings,
    theme,
    siteId,
    tenantSlug,
    templateId,
    previewMode,
    onInlineChange,
    onFieldFocus,
    onFieldBlur,
    // Additional data for system blocks
    links,
    contact,
    branches,
    featuredProduct,
    products,
    businessHours,
    businessSchedule,
    linkSettings,
    productSettings,
    profile,
    reservationServices,
    reservationStaff,
    reservationSettings,
}: {
    block: PageBlock,
    isFirst?: boolean,
    phoneNumber?: string,
    whatsappSettings?: any,
    theme?: any,
    siteId?: string,
    tenantSlug?: string,
    templateId?: string,
    previewMode?: boolean,
    onInlineChange?: (field: string, value: string) => void,
    onFieldFocus?: (field: string, rect: DOMRect) => void,
    onFieldBlur?: () => void,
    links?: any[],
    contact?: any,
    branches?: any[],
    featuredProduct?: any,
    products?: any[],
    businessHours?: any,
    businessSchedule?: any,
    linkSettings?: any,
    productSettings?: any,
    profile?: any,
    reservationServices?: any[],
    reservationStaff?: any[],
    reservationSettings?: any,
}) => {
    const fullTemplate = getTemplate(templateId || 'classic');

    const renderBlock = () => {
        const customBlocks = fullTemplate.components?.Blocks;

        // LCP RULE: if a new block type renders an above-the-fold image, pass `isFirst` to it
        // and gate `priority`/`fetchPriority` on that prop inside the block component.
        // Blocks that are text-only, iframes, or never the LCP element can omit it.
        switch (block.type) {
            case 'hero':
                return customBlocks?.Hero ?
                    React.createElement(customBlocks.Hero, { profile, theme, data: block.data, isFirst, previewMode, onInlineChange, onFieldFocus, onFieldBlur }) :
                    <HeroBlock data={block.data} theme={theme} isFirst={isFirst} onInlineChange={onInlineChange} onFieldFocus={onFieldFocus} onFieldBlur={onFieldBlur} />;
            case 'text':
                return customBlocks?.Text ?
                    React.createElement(customBlocks.Text, { data: block.data }) :
                    <TextBlock data={block.data} />;
            case 'content_showcase':
                return <ContentShowcaseBlock data={block.data} isFirst={isFirst} />;
            case 'image':
                return customBlocks?.Image ?
                    React.createElement(customBlocks.Image, { data: block.data, isFirst }) :
                    <ImageBlock data={block.data} isFirst={isFirst} />;
            case 'button':
                return customBlocks?.Button ?
                    React.createElement(customBlocks.Button, { data: block.data, previewMode, siteId }) :
                    <ButtonBlock data={block.data} previewMode={previewMode} siteId={siteId} />;
            case 'products': 
                return customBlocks?.Products ? 
                    React.createElement(customBlocks.Products, { data: block.data, phoneNumber, whatsappSettings, siteId, products }) : 
                    <ProductsBlock data={block.data} phoneNumber={phoneNumber} whatsappSettings={whatsappSettings} siteId={siteId} products={products} />;
            case 'faq': 
                return customBlocks?.FAQ ? 
                    React.createElement(customBlocks.FAQ, { data: block.data }) : 
                    <FAQBlock data={block.data} />;
            case 'link': 
                return customBlocks?.Link ? 
                    React.createElement(customBlocks.Link, { data: block.data, siteId, links }) : 
                    <LinkBlock data={block.data} siteId={siteId} links={links} />;
            case 'map': 
                return customBlocks?.Map ? 
                    React.createElement(customBlocks.Map, { data: block.data }) : 
                    <MapBlock data={block.data} />;
            case 'image_gallery':
                return customBlocks?.ImageGallery ?
                    React.createElement(customBlocks.ImageGallery, { data: block.data, isFirst }) :
                    <ImageGalleryBlock data={block.data} isFirst={isFirst} />;

            case 'quick_actions':
                return customBlocks?.QuickActions ?
                    React.createElement(customBlocks.QuickActions, { links: links || [], contact, settings: linkSettings, siteId, tenantSlug, blockData: block.data }) :
                    <QuickActions links={links || []} contact={contact} settings={linkSettings} siteId={siteId} tenantSlug={tenantSlug} blockData={block.data} />;

            case 'hours':
                return customBlocks?.OperatingHours ?
                    React.createElement(customBlocks.OperatingHours, { data: businessHours, schedule: businessSchedule }) :
                    <OperatingHours data={businessHours} schedule={businessSchedule} />;

            case 'branches':
                return customBlocks?.Branches ? 
                    React.createElement(customBlocks.Branches, { contact, branches: branches || [] }) : 
                    <BranchesList contact={contact} branches={branches || []} />;

            case 'featured_product': {
                if (!featuredProduct) return null;
                const featuredSettings = productSettings || {};
                const featuredProps = {
                    product: featuredProduct,
                    theme,
                    previewMode,
                    badgeText: featuredSettings.featuredTitle || 'Star Pick',
                    showBadge: featuredSettings.showFeaturedTitle !== false,
                    buttonText: featuredSettings.featuredBtnText || 'Order This Now',
                    phoneNumber: contact?.whatsapp,
                    whatsappSettings: {
                        label: featuredSettings.whatsappBtnLabel,
                        messageTemplate: featuredSettings.whatsappMessageTemplate,
                        bgColor: featuredSettings.whatsappBtnColor,
                        textColor: featuredSettings.whatsappBtnTextColor,
                    },
                };
                return customBlocks?.FeaturedProduct
                    ? React.createElement(customBlocks.FeaturedProduct, featuredProps)
                    : <FeaturedProductBlock {...featuredProps} />;
            }

            case 'reservation':
                return <ReservationBlock data={block.data} siteId={siteId} initialServices={reservationServices} initialStaff={reservationStaff} initialSettings={reservationSettings} />;

            case 'social_embed':
                return <SocialEmbedBlock data={block.data} previewMode={previewMode} />;

            case 'inline_form':
                return customBlocks?.InlineFormBlock
                    ? React.createElement(customBlocks.InlineFormBlock, { data: block.data, siteId })
                    : <InlineFormBlock data={block.data} siteId={siteId} />;

            case 'heading':
                return customBlocks?.HeadingBlock
                    ? React.createElement(customBlocks.HeadingBlock, { data: block.data })
                    : <HeadingBlock data={block.data} onInlineChange={onInlineChange} onFieldFocus={onFieldFocus} onFieldBlur={onFieldBlur} />;

            case 'feature_cards':
                return <FeatureCardsBlock data={block.data} theme={theme} previewMode={previewMode} />;

            default:
                return <ModuleBlockLoader type={block.type} data={block.data} siteId={siteId} />;
        }
    };




    return (
        <SafeBlockRenderer blockId={block.id}>
            {renderBlock()}
        </SafeBlockRenderer>
    );
};
