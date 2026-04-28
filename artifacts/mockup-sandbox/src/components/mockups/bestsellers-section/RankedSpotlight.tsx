import React from "react";
import { Star, ShoppingCart, Flame, ArrowRight, Trophy } from "lucide-react";

const products = [
  { rank: 1, brand: "SMOK", name: "Nord 5 Pod Kit 40W", price: "£39.99", oldPrice: "£54.99", rating: 4.8, reviews: 312, badge: "Best Seller", imgSeed: "vape1" },
  { rank: 2, brand: "GeekVape", name: "Aegis Legend 2 200W", price: "£64.99", rating: 4.7, reviews: 218, badge: "Top Rated", imgSeed: "vape2" },
  { rank: 3, brand: "Vaporesso", name: "XROS 3 Nano Kit", price: "£24.99", oldPrice: "£31.99", rating: 4.6, reviews: 189, badge: "Sale", imgSeed: "vape3" },
  { rank: 4, brand: "Elf Bar", name: "BC5000 Ultra", price: "£14.99", rating: 4.5, reviews: 456, badge: null, imgSeed: "vape4" },
];

export function RankedSpotlight() {
  const heroProduct = products[0];
  const runnerUps = products.slice(1);

  return (
    <div className="bg-[#09090b] min-h-screen p-8 font-sans text-slate-200 selection:bg-purple-500/30">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header Section */}
        <div className="flex items-end justify-between border-b border-white/5 pb-4">
          <div className="space-y-1">
            <h2 className="text-3xl font-bold tracking-tight text-white flex items-center gap-2">
              <Flame className="w-8 h-8 text-orange-500" />
              Bestsellers
            </h2>
            <p className="text-slate-400">Our most popular hardware this week</p>
          </div>
          <button className="hidden sm:flex items-center gap-2 text-sm font-medium text-purple-400 hover:text-purple-300 transition-colors group">
            View the Top 50
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

        <div className="space-y-6">
          {/* #1 Hero Product */}
          <div className="relative group rounded-2xl overflow-hidden bg-[#121118] border border-purple-500/20 shadow-[0_0_40px_-15px_rgba(124,58,237,0.3)] transition-all hover:border-purple-500/40">
            {/* Ambient Background Glow */}
            <div className="absolute top-0 left-1/4 w-1/2 h-full bg-purple-600/10 blur-[100px] pointer-events-none" />
            
            <div className="flex flex-col md:flex-row relative z-10">
              {/* Image Section */}
              <div className="md:w-5/12 relative aspect-square md:aspect-auto bg-[#0a0a0f] flex items-center justify-center p-8 overflow-hidden">
                <div className="absolute top-4 left-4 z-20 flex items-center gap-1.5 bg-yellow-500/10 text-yellow-500 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border border-yellow-500/20 backdrop-blur-md">
                  <Trophy className="w-3.5 h-3.5" />
                  #1 {heroProduct.badge}
                </div>
                
                {/* Huge Rank Number Background */}
                <div className="absolute -left-4 -bottom-10 text-[240px] font-black italic text-white/[0.03] leading-none pointer-events-none select-none mix-blend-overlay">
                  1
                </div>

                <img 
                  src={`https://picsum.photos/seed/${heroProduct.imgSeed}/600/600`} 
                  alt={heroProduct.name}
                  className="relative z-10 w-full h-auto object-contain drop-shadow-2xl mix-blend-lighten transform group-hover:scale-105 transition-transform duration-700 ease-out"
                />
              </div>

              {/* Content Section */}
              <div className="md:w-7/12 p-8 md:p-12 flex flex-col justify-center border-t md:border-t-0 md:border-l border-white/5">
                <div className="mb-2">
                  <span className="text-sm font-medium tracking-widest text-purple-400 uppercase">{heroProduct.brand}</span>
                </div>
                <h3 className="text-3xl md:text-5xl font-bold text-white mb-4 tracking-tight leading-tight">
                  {heroProduct.name}
                </h3>
                
                <div className="flex items-center gap-4 mb-6">
                  <div className="flex items-center gap-1">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className={`w-5 h-5 ${i < Math.floor(heroProduct.rating) ? 'fill-yellow-500 text-yellow-500' : 'text-slate-600'}`} />
                    ))}
                  </div>
                  <span className="text-sm text-slate-400 font-medium">{heroProduct.rating} ({heroProduct.reviews} reviews)</span>
                </div>

                <div className="flex items-end gap-3 mb-8">
                  <span className="text-4xl font-bold text-white">{heroProduct.price}</span>
                  {heroProduct.oldPrice && (
                    <span className="text-lg text-slate-500 line-through mb-1">{heroProduct.oldPrice}</span>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row gap-4 mt-auto">
                  <button className="flex-1 bg-[#7c3aed] hover:bg-purple-600 text-white font-medium px-8 py-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 active:scale-[0.98]">
                    <ShoppingCart className="w-5 h-5" />
                    Add to Cart
                  </button>
                  <button className="flex-1 bg-white/5 hover:bg-white/10 text-white font-medium px-8 py-4 rounded-xl transition-all border border-white/10 active:scale-[0.98]">
                    Quick View
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Runners Up (2, 3, 4) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {runnerUps.map((product) => (
              <div key={product.rank} className="group relative bg-[#121118] border border-white/5 rounded-2xl p-6 transition-all hover:border-white/10 hover:bg-[#16151c]">
                <div className="absolute top-4 left-4 z-10 w-8 h-8 rounded-full bg-black/50 border border-white/10 backdrop-blur-md flex items-center justify-center text-sm font-bold text-white shadow-lg">
                  #{product.rank}
                </div>
                
                {product.badge && (
                  <div className="absolute top-4 right-4 z-10 bg-purple-500/10 text-purple-400 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border border-purple-500/20">
                    {product.badge}
                  </div>
                )}

                <div className="aspect-square bg-[#0a0a0f] rounded-xl mb-6 relative overflow-hidden flex items-center justify-center p-4">
                  {/* Subtle Background Rank */}
                  <div className="absolute -left-2 -bottom-6 text-[120px] font-black italic text-white/[0.02] leading-none pointer-events-none select-none">
                    {product.rank}
                  </div>
                  
                  <img 
                    src={`https://picsum.photos/seed/${product.imgSeed}/300/300`} 
                    alt={product.name}
                    className="w-full h-auto object-contain mix-blend-lighten transform group-hover:scale-110 transition-transform duration-500 ease-out"
                  />
                </div>

                <div>
                  <div className="text-xs font-semibold tracking-wider text-slate-500 uppercase mb-1">
                    {product.brand}
                  </div>
                  <h4 className="text-lg font-bold text-white mb-3 line-clamp-1 group-hover:text-purple-400 transition-colors">
                    {product.name}
                  </h4>
                  
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex items-center">
                      <Star className="w-4 h-4 fill-yellow-500 text-yellow-500 mr-1" />
                      <span className="text-sm font-medium text-white">{product.rating}</span>
                    </div>
                    <span className="text-xs text-slate-500">({product.reviews})</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xl font-bold text-white">{product.price}</span>
                      {product.oldPrice && (
                        <span className="text-xs text-slate-500 line-through">{product.oldPrice}</span>
                      )}
                    </div>
                    
                    <button className="w-10 h-10 rounded-full bg-white/5 hover:bg-purple-600 text-white flex items-center justify-center transition-colors border border-white/10 group-hover:border-transparent">
                      <ShoppingCart className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
        </div>
      </div>
    </div>
  );
}
