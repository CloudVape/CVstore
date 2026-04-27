import { useEffect } from "react";

export const SITE_NAME = "CloudVape";
export const SITE_TAGLINE = "Premium Vape Shop & Community";
export const SITE_DESCRIPTION =
  "Shop authentic vape kits, pod systems, e-liquids, coils, and accessories at CloudVape. Free shipping over $50, same-day dispatch, and a thriving community of cloud chasers.";
export const DEFAULT_OG_IMAGE = "/opengraph.jpg";
export const TWITTER_HANDLE = "@cloudvape";

export function getSiteUrl(): string {
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

export function absoluteUrl(path: string): string {
  if (!path) return getSiteUrl();
  if (/^https?:\/\//i.test(path)) return path;
  const origin = getSiteUrl();
  return `${origin}${path.startsWith("/") ? "" : "/"}${path}`;
}

type SeoProps = {
  title?: string;
  description?: string;
  canonical?: string;
  image?: string;
  type?: "website" | "article" | "product" | "profile";
  robots?: string;
  keywords?: string[];
};

function setMeta(attr: "name" | "property", key: string, value: string | undefined) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!value) {
    if (el) el.remove();
    return;
  }
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", value);
}

function setLink(rel: string, href: string | undefined) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!href) {
    if (el) el.remove();
    return;
  }
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

export function useSeo({
  title,
  description = SITE_DESCRIPTION,
  canonical,
  image = DEFAULT_OG_IMAGE,
  type = "website",
  robots,
  keywords,
}: SeoProps) {
  useEffect(() => {
    const fullTitle = title ? `${title} — ${SITE_NAME}` : `${SITE_NAME} — ${SITE_TAGLINE}`;
    const url = canonical ? absoluteUrl(canonical) : (typeof window !== "undefined" ? window.location.href.split("?")[0].split("#")[0] : "");
    const imgUrl = absoluteUrl(image);

    document.title = fullTitle;
    setMeta("name", "description", description);
    setMeta("name", "keywords", keywords?.join(", "));
    setMeta("name", "robots", robots ?? "index, follow, max-image-preview:large, max-snippet:-1");

    setLink("canonical", url);

    setMeta("property", "og:type", type);
    setMeta("property", "og:site_name", SITE_NAME);
    setMeta("property", "og:title", fullTitle);
    setMeta("property", "og:description", description);
    setMeta("property", "og:url", url);
    setMeta("property", "og:image", imgUrl);
    setMeta("property", "og:image:alt", title ?? `${SITE_NAME} — ${SITE_TAGLINE}`);

    setMeta("name", "twitter:card", "summary_large_image");
    setMeta("name", "twitter:site", TWITTER_HANDLE);
    setMeta("name", "twitter:title", fullTitle);
    setMeta("name", "twitter:description", description);
    setMeta("name", "twitter:image", imgUrl);
  }, [title, description, canonical, image, type, robots, keywords?.join("|")]);
}

type JsonLdProps = { id: string; data: object };

export function JsonLd({ id, data }: JsonLdProps) {
  useEffect(() => {
    const scriptId = `jsonld-${id}`;
    let el = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (!el) {
      el = document.createElement("script");
      el.type = "application/ld+json";
      el.id = scriptId;
      document.head.appendChild(el);
    }
    el.textContent = JSON.stringify(data);
    return () => {
      const stale = document.getElementById(scriptId);
      if (stale) stale.remove();
    };
  }, [id, JSON.stringify(data)]);
  return null;
}

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "OnlineStore",
    name: SITE_NAME,
    url: getSiteUrl() || undefined,
    description: SITE_DESCRIPTION,
    logo: absoluteUrl("/apple-touch-icon.svg"),
    image: absoluteUrl(DEFAULT_OG_IMAGE),
    sameAs: [],
  };
}

export function websiteJsonLd() {
  const origin = getSiteUrl();
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: origin || undefined,
    potentialAction: {
      "@type": "SearchAction",
      target: `${origin}/shop?search={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
}

export function breadcrumbJsonLd(items: Array<{ name: string; url: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: absoluteUrl(item.url),
    })),
  };
}

type ProductLike = {
  name: string;
  slug: string;
  brand?: string | null;
  shortDescription?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  priceCents: number;
  comparePriceCents?: number | null;
  inStock: boolean;
  rating?: string | number | null;
  reviewCount?: number | null;
  categoryName?: string | null;
};

export function productJsonLd(p: ProductLike) {
  const price = (p.priceCents / 100).toFixed(2);
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    description: p.shortDescription || p.description || undefined,
    image: p.imageUrl ? absoluteUrl(p.imageUrl) : undefined,
    sku: p.slug,
    brand: p.brand ? { "@type": "Brand", name: p.brand } : undefined,
    category: p.categoryName || undefined,
    offers: {
      "@type": "Offer",
      url: absoluteUrl(`/shop/p/${p.slug}`),
      priceCurrency: "USD",
      price,
      availability: p.inStock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
    },
  };
  const rating = Number(p.rating);
  if (!Number.isNaN(rating) && rating > 0 && (p.reviewCount ?? 0) > 0) {
    data.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: rating.toFixed(1),
      reviewCount: p.reviewCount,
    };
  }
  return data;
}

export function articleJsonLd(args: {
  title: string;
  description?: string;
  authorName?: string;
  datePublished?: string;
  dateModified?: string;
  image?: string;
  url: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: args.title,
    description: args.description,
    author: args.authorName ? { "@type": "Person", name: args.authorName } : undefined,
    datePublished: args.datePublished,
    dateModified: args.dateModified ?? args.datePublished,
    image: args.image ? absoluteUrl(args.image) : absoluteUrl(DEFAULT_OG_IMAGE),
    mainEntityOfPage: absoluteUrl(args.url),
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      logo: { "@type": "ImageObject", url: absoluteUrl("/apple-touch-icon.svg") },
    },
  };
}

export function collectionJsonLd(args: {
  name: string;
  description?: string;
  url: string;
  items?: Array<{ name: string; url: string; image?: string | null }>;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: args.name,
    description: args.description,
    url: absoluteUrl(args.url),
    hasPart: args.items?.map((i) => ({
      "@type": "Product",
      name: i.name,
      url: absoluteUrl(i.url),
      image: i.image ? absoluteUrl(i.image) : undefined,
    })),
  };
}
