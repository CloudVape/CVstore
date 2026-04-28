import React from 'react';
import { Star, ShoppingCart, Flame, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';

const products = [
  { brand: "SMOK", name: "Nord 5 Pod Kit 40W", price: "£39.99", oldPrice: "£54.99", rating: 4.8, reviews: 312, soldThisWeek: 847, imgSeed: "vape1" },
  { brand: "GeekVape", name: "Aegis Legend 2 200W", price: "£64.99", rating: 4.7, reviews: 218, soldThisWeek: 634, imgSeed: "vape2" },
  { brand: "Vaporesso", name: "XROS 3 Nano Kit", price: "£24.99", oldPrice: "£31.99", rating: 4.6, reviews: 189, soldThisWeek: 521, imgSeed: "vape3" },
  { brand: "Elf Bar", name: "BC5000 Ultra", price: "£14.99", rating: 4.5, reviews: 456, soldThisWeek: 412, imgSeed: "vape4" },
];

export function DarkFirePanel() {
  return (
    <div className="bg-background min-h-screen">
      <section className="w-full bg-[#0a0a0a] py-20 px-4 md:px-8 relative overflow-hidden">
        {/* Background glow effects */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-32 bg-orange-500/10 blur-[100px] rounded-full pointer-events-none" />
        
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="text-center mb-16 relative z-10">
            <div className="inline-flex items-center justify-center gap-2 mb-4 px-4 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-sm font-semibold tracking-wide uppercase">
              <Flame className="w-4 h-4" />
              <span>Trending Now</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-amber-500 to-yellow-500 tracking-tight mb-4 uppercase">
              The Best Sellers
            </h2>
            <p className="text-zinc-400 text-lg max-w-2xl mx-auto">
              These are the products that are on fire right now. Don't miss out on what everyone else is vaping.
            </p>
          </div>

          {/* Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {products.map((product) => (
              <div 
                key={product.name} 
                className="group relative bg-zinc-900/50 rounded-2xl border border-zinc-800 p-4 transition-all duration-300 hover:border-orange-500/50 hover:bg-zinc-900 hover:shadow-[0_0_30px_-5px_rgba(249,115,22,0.3)] flex flex-col"
              >
                {/* Image */}
                <div className="relative aspect-square mb-4 bg-zinc-950 rounded-xl overflow-hidden flex items-center justify-center">
                  <div className="absolute inset-0 bg-gradient-to-tr from-orange-500/5 to-transparent z-10" />
                  <img 
                    src={`https://picsum.photos/seed/${product.imgSeed}/400/400`}
                    alt={product.name}
                    className="object-cover w-full h-full transition-transform duration-500 group-hover:scale-110 opacity-90"
                  />
                  {product.oldPrice && (
                    <div className="absolute top-3 left-3 z-20 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded">
                      SALE
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-grow flex flex-col">
                  <div className="text-zinc-500 text-xs font-semibold uppercase tracking-wider mb-1">
                    {product.brand}
                  </div>
                  <h3 className="text-zinc-100 font-bold text-lg mb-2 leading-tight">
                    {product.name}
                  </h3>
                  
                  {/* Reviews & Stats */}
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex items-center text-amber-500">
                      <Star className="w-4 h-4 fill-current" />
                      <span className="ml-1 text-sm font-medium">{product.rating}</span>
                    </div>
                    <span className="text-zinc-600 text-sm">({product.reviews})</span>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs font-medium text-orange-400 bg-orange-500/10 rounded-md px-2 py-1.5 mb-auto w-fit">
                    <TrendingUp className="w-3.5 h-3.5" />
                    {product.soldThisWeek} sold this week
                  </div>

                  {/* Price & Action */}
                  <div className="mt-5 flex items-center justify-between pt-4 border-t border-zinc-800">
                    <div>
                      {product.oldPrice && (
                        <div className="text-zinc-500 text-sm line-through mb-0.5">
                          {product.oldPrice}
                        </div>
                      )}
                      <div className="text-white font-bold text-xl">
                        {product.price}
                      </div>
                    </div>
                    
                    <Button 
                      size="icon" 
                      className="rounded-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-lg shadow-orange-500/25 border-0 transition-transform active:scale-95 group-hover:-translate-y-1"
                    >
                      <ShoppingCart className="w-5 h-5" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
