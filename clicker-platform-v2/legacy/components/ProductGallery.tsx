import React from 'react';
import Image from 'next/image';
import { Product } from '../types';

interface ProductGalleryProps {
  products: Product[];
  title?: string;
}

export const ProductGallery: React.FC<ProductGalleryProps> = ({ products, title = "Popular Treats" }) => {
  return (
    <div className="mb-12">
      {/* Section Title */}
      <div className="flex justify-center mb-6">
        <div className="bg-white border-[3px] border-brand-dark px-6 py-2 rounded-full shadow-sticker -rotate-1">
          <h2 className="font-extrabold text-brand-dark uppercase tracking-wider text-sm">{title}</h2>
        </div>
      </div>
      
      {/* Grid Layout */}
      <div className="grid grid-cols-2 gap-4">
        {products.map((product, index) => (
          <div 
            key={product.id}
            className={`
              bg-white p-3 rounded-2xl border-[3px] border-brand-dark shadow-sticker relative flex flex-col
              transform transition-all duration-200 hover:-translate-y-1 hover:shadow-sticker-hover
              ${index % 2 === 0 ? 'rotate-1' : '-rotate-1'}
            `}
          >
             {/* Price Tag Sticker */}
            <div className="absolute -top-3 -right-2 z-10">
               <div className="bg-brand-green text-brand-dark border-[2px] border-brand-dark px-2 py-1 rounded-lg font-black text-xs shadow-sm rotate-6">
                 {product.price}
               </div>
            </div>

            {/* Image */}
            <div className="aspect-square w-full rounded-xl overflow-hidden border-[2px] border-brand-dark mb-3 bg-gray-100">
              <Image
                src={product.imageUrl}
                alt={product.name}
                fill
                className="object-cover transition-transform duration-500 hover:scale-110"
                unoptimized
              />
            </div>
            
            {/* Title */}
            <h3 className="font-extrabold text-brand-dark leading-tight text-center text-base sm:text-lg mt-auto">
              {product.name}
            </h3>
          </div>
        ))}
      </div>
    </div>
  );
};