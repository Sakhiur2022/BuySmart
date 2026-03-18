'use client';

import { useState, useMemo } from 'react';
import { BuySmartAutomaton } from '@/lib/agents/buysmart-automaton';

interface Product {
  id: string;
  name: string;
  price: number;
  description: string;
  image?: string;
}

interface ProductPageProps {
  products?: Product[];
}

export default function ProductPage({ products = [] }: ProductPageProps) {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const machine = useMemo(() => new BuySmartAutomaton(), []);

  const validation = machine.validate(searchTerm);

  // Sample products if none provided
  const displayProducts: Product[] = products.length > 0 ? products : [
    {
      id: '1',
      name: 'Wireless Headphones',
      price: 79.99,
      description: 'Premium sound quality with noise cancellation',
      image: 'https://via.placeholder.com/300?text=Headphones'
    },
    {
      id: '2',
      name: 'Smart Watch',
      price: 199.99,
      description: 'Track your fitness and stay connected',
      image: 'https://via.placeholder.com/300?text=SmartWatch'
    },
    {
      id: '3',
      name: 'USB-C Cable',
      price: 12.99,
      description: 'Fast charging and data transfer',
      image: 'https://via.placeholder.com/300?text=Cable'
    },
    {
      id: '4',
      name: 'Portable Charger',
      price: 45.99,
      description: '20000mAh with multiple ports',
      image: 'https://via.placeholder.com/300?text=Charger'
    },
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Search & Validation Header */}
      <div className="mb-8 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search (try 'BUYSMART')..."
              className={`w-full p-3 rounded-lg border-2 transition-colors ${
                validation.accepted ? 'border-green-500 ring-2 ring-green-100' : 'border-gray-200'
              }`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {validation.accepted && (
              <span className="absolute right-3 top-3 text-green-600 font-bold">✓</span>
            )}
          </div>

          <div className="flex bg-gray-100 p-1 rounded-md">
            <button 
              onClick={() => setViewMode('grid')}
              className={`px-4 py-2 rounded transition-colors ${viewMode === 'grid' ? 'bg-white shadow' : 'text-gray-500'}`}
            >
              Grid
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={`px-4 py-2 rounded transition-colors ${viewMode === 'list' ? 'bg-white shadow' : 'text-gray-500'}`}
            >
              List
            </button>
          </div>
        </div>
        <p className="text-xs font-mono text-gray-400">DFA Path: {validation.path.join(' → ')}</p>
      </div>

      {/* Product Listing */}
      <div className={viewMode === 'grid' ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6" : "space-y-4"}>
        {displayProducts.map((product) => (
          <div 
            key={product.id} 
            className={`bg-white border rounded-xl overflow-hidden hover:shadow-lg transition-shadow ${
              viewMode === 'list' ? 'flex h-40' : 'flex flex-col'
            }`}
          >
            {/* Image */}
            <div className={viewMode === 'list' ? 'w-48 shrink-0' : 'w-full h-48'}>
              <img 
                src={product.image || 'https://via.placeholder.com/300'}
                alt={product.name}
                className="w-full h-full object-cover"
              />
            </div>

            {/* Content */}
            <div className="p-4 flex flex-col justify-between flex-grow">
              <div>
                <div className="flex justify-between items-start">
                  <h3 className="font-bold text-gray-900">{product.name}</h3>
                  <span className="text-blue-600 font-semibold">${product.price}</span>
                </div>
                <p className="text-gray-500 text-sm mt-1 line-clamp-2">{product.description}</p>
              </div>
              <button className="mt-4 w-full bg-black text-white py-2 rounded-lg hover:bg-gray-800 transition-colors">
                Add to Cart
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
