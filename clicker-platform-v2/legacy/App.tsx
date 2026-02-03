import React from 'react';
import { ProfileHeader } from './components/ProfileHeader';
import { LinkCard } from './components/LinkCard';
import { StickerBadge } from './components/StickerBadge';
import { ProductGallery } from './components/ProductGallery';
import { FeaturedProduct } from './components/FeaturedProduct';
import { LinkItem, BusinessProfile, SocialLink, Product } from './types';
import { 
  ShoppingBag, 
  MessageCircle, 
  Map, 
  Clock, 
  Instagram, 
  Facebook, 
  Twitter, 
  Coffee, 
  Croissant,
  Utensils,
  Sparkles
} from 'lucide-react';

const App: React.FC = () => {
  // Mock Data
  const profile: BusinessProfile = {
    name: "SunnySide",
    tagline: "Baked Fresh Daily",
    description: "Artisanal pastries, strong coffee, and good vibes. Your neighborhood spot since 2024.",
    avatarUrl: "https://picsum.photos/300/300"
  };

  const links: LinkItem[] = [
    {
      id: '1',
      title: 'Order for Pickup',
      subtitle: 'Skip the line, earn points',
      url: '#',
      icon: ShoppingBag,
      highlight: true
    },
    {
      id: '2',
      title: 'View Today’s Menu',
      subtitle: 'Fresh croissants just dropped',
      url: '#',
      icon: Utensils
    },
    {
      id: '3',
      title: 'Chat on WhatsApp',
      subtitle: 'For catering & bulk orders',
      url: '#',
      icon: MessageCircle
    },
    {
      id: '4',
      title: 'Find Our Location',
      subtitle: 'Directions via Google Maps',
      url: '#',
      icon: Map
    }
  ];

  const featuredProduct: Product = {
    id: 'featured-1',
    name: 'Tiramisu Croissant',
    price: '$6.50',
    description: 'Our signature flaky croissant filled with mascarpone cream and dusted with premium cocoa.',
    imageUrl: 'https://images.unsplash.com/photo-1576618148400-f54bed99fcf8?q=80&w=800&auto=format&fit=crop'
  };

  const products: Product[] = [
    {
      id: '1',
      name: 'Pain au Chocolat',
      price: '$4.50',
      imageUrl: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?q=80&w=400&auto=format&fit=crop'
    },
    {
      id: '2',
      name: 'Berry Danish',
      price: '$5.00',
      imageUrl: 'https://images.unsplash.com/photo-1509365465985-25d11c17e812?q=80&w=400&auto=format&fit=crop'
    },
    {
      id: '3',
      name: 'Iced Matcha',
      price: '$6.00',
      imageUrl: 'https://images.unsplash.com/photo-1515823664972-6d66e79b3872?q=80&w=400&auto=format&fit=crop'
    },
    {
      id: '4',
      name: 'Avocado Toast',
      price: '$12.00',
      imageUrl: 'https://images.unsplash.com/photo-1588137372308-15f75323a4dd?q=80&w=400&auto=format&fit=crop'
    }
  ];

  const socialLinks: SocialLink[] = [
    { platform: 'Instagram', url: '#', icon: Instagram },
    { platform: 'Facebook', url: '#', icon: Facebook },
    { platform: 'Twitter', url: '#', icon: Twitter },
  ];

  return (
    <div className="min-h-screen bg-brand-green px-4 py-12 relative overflow-hidden font-sans selection:bg-brand-dark selection:text-brand-green">
      
      {/* Background Stickers (Decorative) */}
      <div className="fixed inset-0 pointer-events-none opacity-40 max-w-3xl mx-auto">
        <StickerBadge icon={Croissant} rotation={-15} className="top-10 left-4 w-16 h-16" />
        <StickerBadge icon={Coffee} rotation={10} className="top-20 right-6 w-20 h-20 bg-brand-green" />
        <StickerBadge icon={Sparkles} rotation={-5} className="bottom-20 left-10 w-12 h-12" />
        <StickerBadge icon={Clock} rotation={12} className="bottom-40 right-4 w-14 h-14 bg-brand-white" />
      </div>

      <div className="max-w-md mx-auto relative z-10">
        
        <ProfileHeader profile={profile} />

        <div className="space-y-4 mb-12">
           {/* Section Label */}
           <div className="flex justify-center mb-6">
             <div className="bg-white border-[3px] border-brand-dark px-6 py-2 rounded-full shadow-sticker rotate-2">
                <h2 className="font-extrabold text-brand-dark uppercase tracking-wider text-sm">Quick Actions</h2>
             </div>
           </div>

          {links.map((link) => (
            <LinkCard key={link.id} item={link} />
          ))}
        </div>

        {/* Featured Product Section */}
        <FeaturedProduct product={featuredProduct} />

        {/* New Product Gallery Section */}
        <ProductGallery products={products} title="More Treats" />

        {/* Operating Hours Sticker */}
        <div className="bg-white border-[3px] border-brand-dark p-6 rounded-3xl mb-12 shadow-sticker transform -rotate-1 relative">
            <div className="absolute -top-4 -right-2 bg-brand-dark text-brand-green px-3 py-1 text-xs font-black uppercase rounded-lg rotate-6">
                Open Now
            </div>
            <h3 className="font-black text-xl mb-4 text-center uppercase">Opening Hours</h3>
            <div className="space-y-2 text-center font-bold text-brand-dark/90">
                <p>Mon - Fri: 07:00 - 20:00</p>
                <p>Sat - Sun: 08:00 - 22:00</p>
            </div>
        </div>

        {/* Footer Socials */}
        <footer className="flex flex-col items-center gap-6 pb-8">
          <div className="flex gap-4">
            {socialLinks.map((social) => (
              <a 
                key={social.platform}
                href={social.url}
                className="bg-white p-3 rounded-full border-[3px] border-brand-dark text-brand-dark hover:bg-brand-dark hover:text-brand-green transition-colors duration-200 shadow-sticker hover:shadow-none hover:translate-y-[2px] hover:translate-x-[2px]"
              >
                <social.icon size={24} strokeWidth={2.5} />
              </a>
            ))}
          </div>
          <p className="font-bold text-brand-dark/40 text-sm">© 2024 SunnySide.</p>
        </footer>

      </div>
    </div>
  );
};

export default App;