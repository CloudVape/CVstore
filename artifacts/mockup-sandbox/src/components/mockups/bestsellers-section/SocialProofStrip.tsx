import {
  Star,
  Users,
  TrendingUp,
  ShoppingCart,
  CheckCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const products = [
  {
    brand: "SMOK",
    name: "Nord 5 Pod Kit 40W",
    price: "£39.99",
    oldPrice: "£54.99",
    rating: 4.8,
    reviews: 312,
    boughtThisWeek: 847,
    recommendPct: 97,
    imgSeed: "vape1",
  },
  {
    brand: "GeekVape",
    name: "Aegis Legend 2 200W",
    price: "£64.99",
    rating: 4.7,
    reviews: 218,
    boughtThisWeek: 634,
    recommendPct: 94,
    imgSeed: "vape2",
  },
  {
    brand: "Vaporesso",
    name: "XROS 3 Nano Kit",
    price: "£24.99",
    oldPrice: "£31.99",
    rating: 4.6,
    reviews: 189,
    boughtThisWeek: 521,
    recommendPct: 92,
    imgSeed: "vape3",
  },
  {
    brand: "Elf Bar",
    name: "BC5000 Ultra",
    price: "£14.99",
    rating: 4.5,
    reviews: 456,
    boughtThisWeek: 412,
    recommendPct: 91,
    imgSeed: "vape4",
  },
];

const siteStats = {
  ordersToday: 1240,
  avgRating: 4.7,
  happyCustomers: 28400,
};

export function SocialProofStrip() {
  const maxBought = Math.max(...products.map((p) => p.boughtThisWeek));

  return (
    <div className="bg-background min-h-screen p-8 font-sans text-zinc-900">
      <div className="max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="mb-12 border-b border-zinc-200 pb-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                </span>
                <span className="text-sm font-semibold tracking-wide uppercase text-red-600">
                  Live Insights
                </span>
              </div>
              <h2 className="text-4xl md:text-5xl font-serif tracking-tight text-zinc-900 mb-4">
                Community's Top Picks
              </h2>
              <div className="flex flex-wrap items-center gap-4 text-sm text-zinc-600 bg-white px-4 py-2 rounded-full border border-zinc-200 shadow-sm inline-flex">
                <div className="flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-emerald-500" />
                  <span className="font-medium text-zinc-900">
                    {siteStats.ordersToday.toLocaleString()}
                  </span>{" "}
                  orders today
                </div>
                <div className="w-1 h-1 rounded-full bg-zinc-300" />
                <div className="flex items-center gap-1.5">
                  <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                  <span className="font-medium text-zinc-900">
                    {siteStats.avgRating}
                  </span>{" "}
                  store average
                </div>
                <div className="w-1 h-1 rounded-full bg-zinc-300" />
                <div className="flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-blue-500" />
                  <span className="font-medium text-zinc-900">
                    {(siteStats.happyCustomers / 1000).toFixed(1)}k+
                  </span>{" "}
                  happy vapers
                </div>
              </div>
            </div>
            <div className="text-right">
              <p className="text-zinc-500 text-sm max-w-xs">
                Based on real-time purchase data and verified customer reviews from the last 7 days.
              </p>
            </div>
          </div>
        </div>

        {/* Product Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {products.map((product) => (
            <div
              key={product.name}
              className="bg-white rounded-2xl border border-zinc-200 overflow-hidden hover:shadow-xl transition-all duration-300 group flex flex-col relative"
            >
              {/* Product Image area */}
              <div className="aspect-square relative bg-zinc-100 overflow-hidden">
                <img
                  src={`https://picsum.photos/seed/${product.imgSeed}/400/400`}
                  alt={product.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute top-3 left-3 bg-emerald-500 text-white text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1 shadow-sm">
                  <CheckCircle className="w-3 h-3" />
                  {product.recommendPct}% recommend
                </div>
              </div>

              {/* Card Content - The Social Proof Focus */}
              <div className="p-6 flex flex-col flex-grow">
                {/* BIG Rating */}
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-4xl font-black tracking-tighter text-zinc-900">
                    {product.rating}
                  </span>
                  <div className="flex flex-col">
                    <div className="flex text-amber-400 mb-0.5">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`w-4 h-4 ${
                            i < Math.floor(product.rating)
                              ? "fill-current"
                              : "text-zinc-200 fill-zinc-200"
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-xs text-zinc-500 font-medium hover:text-zinc-900 hover:underline cursor-pointer transition-colors">
                      {product.reviews} verified reviews
                    </span>
                  </div>
                </div>

                {/* Demand Stats */}
                <div className="mb-6 bg-amber-50 rounded-xl p-3 border border-amber-100/50">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="font-semibold text-amber-900 flex items-center gap-1.5">
                      <TrendingUp className="w-4 h-4 text-amber-600" />
                      {product.boughtThisWeek} bought
                    </span>
                    <span className="text-amber-700/80 text-xs font-medium">this week</span>
                  </div>
                  <div className="h-1.5 w-full bg-amber-200/50 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-500 rounded-full"
                      style={{ width: `${(product.boughtThisWeek / maxBought) * 100}%` }}
                    />
                  </div>
                </div>

                {/* Product Details */}
                <div className="mt-auto">
                  <div className="mb-4">
                    <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">
                      {product.brand}
                    </p>
                    <h3 className="text-lg font-semibold text-zinc-900 leading-snug line-clamp-2 group-hover:text-blue-600 transition-colors">
                      {product.name}
                    </h3>
                  </div>

                  <div className="flex items-end justify-between pt-4 border-t border-zinc-100">
                    <div>
                      {product.oldPrice && (
                        <p className="text-sm text-zinc-400 line-through decoration-zinc-300">
                          {product.oldPrice}
                        </p>
                      )}
                      <p className="text-2xl font-bold text-zinc-900">
                        {product.price}
                      </p>
                    </div>
                    <Button
                      size="icon"
                      className="rounded-full bg-zinc-900 hover:bg-zinc-800 text-white h-10 w-10 shrink-0 shadow-md hover:shadow-lg transition-all"
                    >
                      <ShoppingCart className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
