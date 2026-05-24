'use client';

import { Suspense } from 'react';
import ProductForm from './components/ProductForm';

export default function ProductEditorPage() {
  return (
    <Suspense fallback={<div className="p-6 text-gray-500">Loading...</div>}>
      <ProductForm />
    </Suspense>
  );
}
