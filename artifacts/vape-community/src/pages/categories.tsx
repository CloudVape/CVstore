import { useListCategories } from "@workspace/api-client-react";
import { Link } from "wouter";
import {
  Grid,
  ArrowUpRight,
  Cpu,
  Droplets,
  Wind,
  LifeBuoy,
  Newspaper,
  Wrench,
  MessagesSquare,
  type LucideIcon,
} from "lucide-react";
import { useSeo } from "@/lib/seo";

type CategoryStyle = {
  Icon: LucideIcon;
  iconGlow: string;
  ring: string;
  glow: string;
  accentText: string;
  badgeBg: string;
  ghostIconColor: string;
  tag: string;
};

const STYLES: Record<string, CategoryStyle> = {
  "hardware-reviews": {
    Icon: Cpu,
    iconGlow: "group-hover:drop-shadow-[0_0_12px_rgba(34,211,238,0.8)]",
    ring: "ring-cyan-400/30 group-hover:ring-cyan-400/60",
    glow: "group-hover:shadow-[0_0_40px_-8px_rgba(34,211,238,0.45)]",
    accentText: "group-hover:text-cyan-300",
    badgeBg: "bg-cyan-500/10 text-cyan-300 border border-cyan-500/30",
    ghostIconColor: "text-cyan-400",
    tag: "REVIEWS",
  },
  "e-liquid-talk": {
    Icon: Droplets,
    iconGlow: "group-hover:drop-shadow-[0_0_12px_rgba(236,72,153,0.8)]",
    ring: "ring-pink-400/30 group-hover:ring-pink-400/60",
    glow: "group-hover:shadow-[0_0_40px_-8px_rgba(236,72,153,0.45)]",
    accentText: "group-hover:text-pink-300",
    badgeBg: "bg-pink-500/10 text-pink-300 border border-pink-500/30",
    ghostIconColor: "text-pink-400",
    tag: "FLAVOUR",
  },
  "cloud-chasing": {
    Icon: Wind,
    iconGlow: "group-hover:drop-shadow-[0_0_12px_rgba(56,189,248,0.8)]",
    ring: "ring-sky-400/30 group-hover:ring-sky-400/60",
    glow: "group-hover:shadow-[0_0_40px_-8px_rgba(56,189,248,0.45)]",
    accentText: "group-hover:text-sky-300",
    badgeBg: "bg-sky-500/10 text-sky-300 border border-sky-500/30",
    ghostIconColor: "text-sky-400",
    tag: "CLOUDS",
  },
  "beginner-help": {
    Icon: LifeBuoy,
    iconGlow: "group-hover:drop-shadow-[0_0_12px_rgba(251,191,36,0.8)]",
    ring: "ring-amber-400/30 group-hover:ring-amber-400/60",
    glow: "group-hover:shadow-[0_0_40px_-8px_rgba(251,191,36,0.45)]",
    accentText: "group-hover:text-amber-300",
    badgeBg: "bg-amber-500/10 text-amber-300 border border-amber-500/30",
    ghostIconColor: "text-amber-400",
    tag: "STARTERS",
  },
  "industry-news": {
    Icon: Newspaper,
    iconGlow: "group-hover:drop-shadow-[0_0_12px_rgba(167,139,250,0.8)]",
    ring: "ring-violet-400/30 group-hover:ring-violet-400/60",
    glow: "group-hover:shadow-[0_0_40px_-8px_rgba(167,139,250,0.45)]",
    accentText: "group-hover:text-violet-300",
    badgeBg: "bg-violet-500/10 text-violet-300 border border-violet-500/30",
    ghostIconColor: "text-violet-400",
    tag: "NEWS",
  },
  "diy-coil-building": {
    Icon: Wrench,
    iconGlow: "group-hover:drop-shadow-[0_0_12px_rgba(251,113,133,0.8)]",
    ring: "ring-rose-400/30 group-hover:ring-rose-400/60",
    glow: "group-hover:shadow-[0_0_40px_-8px_rgba(251,113,133,0.45)]",
    accentText: "group-hover:text-rose-300",
    badgeBg: "bg-rose-500/10 text-rose-300 border border-rose-500/30",
    ghostIconColor: "text-rose-400",
    tag: "BUILDS",
  },
};

const FALLBACK_STYLE: CategoryStyle = {
  Icon: MessagesSquare,
  iconGlow: "group-hover:drop-shadow-[0_0_12px_rgba(34,211,238,0.8)]",
  ring: "ring-primary/30 group-hover:ring-primary/60",
  glow: "group-hover:shadow-[0_0_40px_-8px_rgba(34,211,238,0.45)]",
  accentText: "group-hover:text-primary",
  badgeBg: "bg-primary/10 text-primary border border-primary/30",
  ghostIconColor: "text-primary",
  tag: "TOPIC",
};

export default function Categories() {
  const { data: categories, isLoading } = useListCategories();

  useSeo({
    title: "Forum Categories",
    description:
      "Explore CloudVape forum discussions by topic. From hardware reviews to juice recommendations, find your niche in the community.",
    canonical: "/categories",
    keywords: ["vape forum categories", "vape topics", "vape discussions"],
  });

  return (
    <div className="container mx-auto max-w-6xl px-4 py-12">
      <div className="mb-12 border-b border-border/40 pb-8 text-center">
        <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter flex items-center justify-center gap-3 mb-4">
          <Grid className="h-10 w-10 text-secondary" />
          Categories
        </h1>
        <p className="text-muted-foreground font-mono max-w-2xl mx-auto">
          Explore discussions by topic. From hardware reviews to juice
          recommendations, find your niche.
        </p>
      </div>

      {isLoading ? (
        <div className="py-20 text-center text-muted-foreground font-mono border border-dashed border-border/40 rounded-xl">
          <span className="animate-pulse">Loading categories...</span>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {categories?.map((category) => {
            const style = STYLES[category.slug] ?? FALLBACK_STYLE;
            const { Icon } = style;
            return (
              <Link
                key={category.id}
                href={`/forum?categoryId=${category.id}`}
                data-testid={`link-category-${category.slug}`}
              >
                <article
                  className={`relative h-full overflow-hidden rounded-2xl border border-border/50 bg-gradient-to-br from-card to-card/40 p-6 cursor-pointer group transition-all duration-300 hover:-translate-y-1 hover:border-border ${style.glow}`}
                >
                  <Icon
                    aria-hidden="true"
                    className={`absolute -right-6 -bottom-6 h-40 w-40 opacity-[0.06] ${style.ghostIconColor} transition-all duration-500 group-hover:opacity-[0.12] group-hover:scale-110 group-hover:rotate-6`}
                  />

                  <div
                    className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                    style={{
                      background:
                        "radial-gradient(circle at top right, rgba(255,255,255,0.04), transparent 60%)",
                    }}
                  />

                  <div className="relative flex items-start justify-between gap-4 mb-5">
                    <Icon
                      aria-hidden="true"
                      className={`h-11 w-11 ${style.ghostIconColor} transition-all duration-300 group-hover:scale-110 ${style.iconGlow}`}
                      strokeWidth={1.5}
                    />
                    <span
                      className={`text-[10px] font-mono font-bold tracking-[0.18em] px-2 py-1 rounded-md ${style.badgeBg}`}
                    >
                      {style.tag}
                    </span>
                  </div>

                  <h2
                    className={`relative font-black text-xl tracking-tight mb-2 transition-colors ${style.accentText}`}
                  >
                    {category.name}
                  </h2>

                  <p className="relative text-sm text-muted-foreground/90 mb-6 line-clamp-2 leading-relaxed">
                    {category.description}
                  </p>

                  <div className="relative flex items-center justify-between pt-4 border-t border-border/30">
                    <span className="inline-flex items-baseline gap-1.5 text-xs font-mono uppercase tracking-wider">
                      <span className="text-foreground font-bold text-sm tabular-nums">
                        {category.postCount}
                      </span>
                      <span className="text-muted-foreground/70">
                        {category.postCount === 1 ? "post" : "posts"}
                      </span>
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 text-xs font-mono font-semibold opacity-60 group-hover:opacity-100 transition-all group-hover:gap-2 ${style.accentText}`}
                    >
                      Browse
                      <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:rotate-12" />
                    </span>
                  </div>
                </article>
              </Link>
            );
          })}

          {categories?.length === 0 && (
            <div className="col-span-full py-12 text-center text-muted-foreground font-mono">
              No categories found.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
