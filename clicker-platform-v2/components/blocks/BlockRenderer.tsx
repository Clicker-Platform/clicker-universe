import React from 'react';
import dynamic from 'next/dynamic';
import { PageBlock } from '@/data/mockData';

// Dynamically import blocks to reduce initial bundle size
const HeroBlock = dynamic(() => import('./public/HeroBlock').then(mod => mod.HeroBlock));
const TextBlock = dynamic(() => import('./public/TextBlock').then(mod => mod.TextBlock));
const ImageBlock = dynamic(() => import('./public/ImageBlock').then(mod => mod.ImageBlock));
const ButtonBlock = dynamic(() => import('./public/ButtonBlock').then(mod => mod.ButtonBlock));
const ProductsBlock = dynamic(() => import('./public/ProductsBlock').then(mod => mod.ProductsBlock));
const FAQBlock = dynamic(() => import('./public/FAQBlock').then(mod => mod.FAQBlock));
const LinkBlock = dynamic(() => import('./public/LinkBlock').then(mod => mod.LinkBlock));
const MapBlock = dynamic(() => import('./public/MapBlock').then(mod => mod.MapBlock));
const ImageGalleryBlock = dynamic(() => import('./public/ImageGalleryBlock').then(mod => mod.ImageGalleryBlock));

// System blocks (from PublicPageRenderer)
const QuickActions = dynamic(() => import('@/components/QuickActions').then(mod => mod.QuickActions));
const OperatingHours = dynamic(() => import('@/components/OperatingHours').then(mod => mod.OperatingHours));
const BranchesList = dynamic(() => import('@/components/BranchesList').then(mod => mod.BranchesList));
const FeaturedProduct = dynamic(() => import('@/components/FeaturedProduct').then(mod => mod.FeaturedProduct));


import { ModuleBlockLoader } from '@/components/modules/ModuleBlockLoader';

import { SafeBlockRenderer } from './SafeBlockRenderer';

export const BlockRenderer = ({
    block,
    phoneNumber,
    whatsappSettings,
    theme,
    siteId,
    tenantSlug,
    // Additional data for system blocks
    links,
    contact,
    branches,
    featuredProduct,
    products,
    businessHours,
    businessSchedule,
    linkSettings,
    productSettings
}: {
    block: PageBlock,
    phoneNumber?: string,
    whatsappSettings?: any,
    theme?: any,
    siteId?: string,
    tenantSlug?: string,
    links?: any[],
    contact?: any,
    branches?: any[],
    featuredProduct?: any,
    products?: any[],
    businessHours?: any,
    businessSchedule?: any,
    linkSettings?: any,
    productSettings?: any
}) => {
    const renderBlock = () => {
        switch (block.type) {
            case 'hero': return <HeroBlock data={block.data} theme={theme} />;
            case 'text': return <TextBlock data={block.data} />;
            case 'image': return <ImageBlock data={block.data} />;
            case 'button': return <ButtonBlock data={block.data} />;
            case 'products': return <ProductsBlock data={block.data} phoneNumber={phoneNumber} whatsappSettings={whatsappSettings} siteId={siteId} products={products} />;
            case 'faq': return <FAQBlock data={block.data} />;
            case 'link': return <LinkBlock data={block.data} siteId={siteId} />;
            case 'map': return <MapBlock data={block.data} />;
            case 'image_gallery':
                return <ImageGalleryBlock data={block.data} />;

            // System blocks (from Appearance > Block Layout)
            case 'quick_actions':
                return <QuickActions links={links || []} contact={contact} settings={linkSettings} siteId={siteId} tenantSlug={tenantSlug} />;

            case 'hours':
                return <OperatingHours data={businessHours} schedule={businessSchedule} />;

            case 'branches':
                return <BranchesList contact={contact} branches={branches || []} />;

            case 'featured_product':
                if (!featuredProduct) return null;
                const featuredSettings = productSettings || {};
                return (
                    <FeaturedProduct
                        product={featuredProduct}
                        badgeText={featuredSettings.featuredTitle || "Star Pick"}
                        showBadge={featuredSettings.showFeaturedTitle !== false}
                        buttonText={featuredSettings.featuredBtnText || "Order This Now"}
                        phoneNumber={contact?.whatsapp}
                        whatsappSettings={{
                            label: featuredSettings.whatsappBtnLabel,
                            messageTemplate: featuredSettings.whatsappMessageTemplate,
                            bgColor: featuredSettings.whatsappBtnColor,
                            textColor: featuredSettings.whatsappBtnTextColor
                        }}
                    />
                );

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
