import React, { useState } from 'react';
import { Product } from '../types';
import { Sparkles, ArrowRight, Image as ImageIcon } from 'lucide-react';

interface FeaturedProductProps {
  product: Product;
  badgeText?: string;
}

export const FeaturedProduct: React.FC<FeaturedProductProps> = ({ 
  product, 
  badgeText = "Star Pick" 
}) => {
  const [isLoading, setIsLoading] = useState(true);

  return (
    <div className="mb-12 relative mt-8">
       {/* Floating Badge */}
       <div className="absolute -top-5 left-1/2 -translate-x-1/2 z-20 w-max">
         <div className="bg-brand-green border-[3px] border-brand-dark px-6 py-2 rounded-full shadow-sticker rotate-[-2deg] flex items-center gap-2 animate-bounce">
            <Sparkles size={20} className="text-brand-dark fill-brand-dark" />
            <span className="font-black text-brand-dark uppercase tracking-wider text-sm">{badgeText}</span>
            <Sparkles size={20} className="text-brand-dark fill-brand-dark" />
         </div>
       </div>

       {/* Card Container */}
       <div className="group relative bg-white rounded-3xl border-[4px] border-brand-dark shadow-sticker p-4 pt-8 hover:shadow-sticker-hover transition-all duration-300 hover:-translate-y-1">
          
          {/* Image Container */}
          <div className="w-full aspect-[4/3] rounded-2xl overflow-hidden border-[3px] border-brand-dark mb-5 relative bg-gray-100">
             
             {/* Skeleton Loader */}
             {isLoading && (
               <div className="absolute inset-0 bg-gray-200 animate-pulse flex items-center justify-center z-10">
                  <ImageIcon className="text-gray-300 w-16 h-16" strokeWidth={2} />
               </div>
             )}

             <img 
                src={product.imageUrl} 
                alt={product.name}
                onLoad={() => setIsLoading(false)}
                className={`w-full h-full object-cover transition-all duration-700 group-hover:scale-105 ${isLoading ? 'opacity-0' : 'opacity-100'}`} 
             />
             
             {/* Price Tag */}
             <div className="absolute bottom-4 right-4 bg-brand-dark text-brand-green px-4 py-2 rounded-xl border-2 border-brand-green font-black text-xl shadow-lg rotate-[-3deg] group-hover:rotate-0 transition-transform z-20">
                {product.price}
             </div>
          </div>

          {/* Content */}
          <div className="text-center px-2 pb-2">
             <h3 className="font-black text-3xl text-brand-dark mb-3 uppercase leading-none tracking-tight">
                {product.name}
             </h3>
             
             {product.description && (
                <p className="font-bold text-brand-dark/70 text-base mb-6 leading-snug max-w-xs mx-auto">
                    {product.description}
                </p>
             )}
             
             <button className="w-full bg-brand-dark text-white py-4 rounded-xl font-extrabold text-lg uppercase tracking-wide flex items-center justify-center gap-2 group-hover:bg-brand-green group-hover:text-brand-dark transition-all duration-300 border-[3px] border-brand-dark shadow-sm group-hover:shadow-none">
                Order This Now <ArrowRight size={24} strokeWidth={3} />
             </button>
          </div>
       </div>
    </div>
  );
};