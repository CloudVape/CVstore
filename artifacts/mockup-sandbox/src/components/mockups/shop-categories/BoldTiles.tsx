import { ArrowUpRight } from "lucide-react";

const CATEGORIES = [
  {
    slug: "mods-devices",
    name: "Mods & Devices",
    emoji: "📦",
    count: 3,
    tag: "Most popular",
    bg: "linear-gradient(135deg, #164e63 0%, #0c2a35 100%)",
    accent: "#22d3ee",
    span: 2,
  },
  {
    slug: "pod-systems",
    name: "Pod Systems",
    emoji: "🔋",
    count: 3,
    tag: null,
    bg: "linear-gradient(135deg, #3b1f6e 0%, #1e1033 100%)",
    accent: "#a78bfa",
    span: 1,
  },
  {
    slug: "e-liquids",
    name: "E-Liquids",
    emoji: "💧",
    count: 5,
    tag: "New arrivals",
    bg: "linear-gradient(135deg, #1e3a5f 0%, #0f1e2e 100%)",
    accent: "#38bdf8",
    span: 1,
  },
  {
    slug: "tanks-atomizers",
    name: "Tanks & Atomizers",
    emoji: "🛢️",
    count: 3,
    tag: null,
    bg: "linear-gradient(135deg, #1f1b40 0%, #110f25 100%)",
    accent: "#818cf8",
    span: 1,
  },
  {
    slug: "coils-wire",
    name: "Coils & Wire",
    emoji: "🌀",
    count: 4,
    tag: null,
    bg: "linear-gradient(135deg, #052e1c 0%, #021409 100%)",
    accent: "#34d399",
    span: 1,
  },
  {
    slug: "disposables",
    name: "Disposables",
    emoji: "⚡",
    count: 3,
    tag: "On sale",
    bg: "linear-gradient(135deg, #431407 0%, #1c0803 100%)",
    accent: "#fb923c",
    span: 1,
  },
  {
    slug: "accessories",
    name: "Accessories",
    emoji: "🔧",
    count: 4,
    tag: null,
    bg: "linear-gradient(135deg, #1c1917 0%, #0c0a09 100%)",
    accent: "#a3a3a3",
    span: 1,
  },
];

type Cat = typeof CATEGORIES[0];

function Tile({ cat, height = 200 }: { cat: Cat; height?: number }) {
  return (
    <div
      style={{
        borderRadius: 18,
        padding: "28px",
        background: cat.bg,
        border: `1px solid ${cat.accent}25`,
        cursor: "pointer",
        height: height,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: -20,
          right: -20,
          width: 100,
          height: 100,
          borderRadius: "50%",
          background: `${cat.accent}10`,
          pointerEvents: "none",
        }}
      />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ fontSize: cat.span === 2 ? 44 : 32 }}>{cat.emoji}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {cat.tag && (
            <span
              style={{
                fontSize: 10,
                fontFamily: "monospace",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: cat.accent,
                background: `${cat.accent}18`,
                border: `1px solid ${cat.accent}30`,
                borderRadius: 20,
                padding: "3px 8px",
              }}
            >
              {cat.tag}
            </span>
          )}
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background: `${cat.accent}20`,
              border: `1px solid ${cat.accent}30`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ArrowUpRight size={14} color={cat.accent} />
          </div>
        </div>
      </div>

      <div>
        <h3
          style={{
            margin: "0 0 4px",
            fontSize: cat.span === 2 ? 20 : 15,
            fontWeight: 900,
            textTransform: "uppercase",
            letterSpacing: "0.03em",
            color: "#f8fafc",
          }}
        >
          {cat.name}
        </h3>
        <p style={{ margin: 0, fontSize: 12, fontFamily: "monospace", color: cat.accent, opacity: 0.8 }}>
          {cat.count} products
        </p>
      </div>
    </div>
  );
}

export function BoldTiles() {
  const [featured, ...rest] = CATEGORIES;
  const row1 = rest.slice(0, 3);
  const row2 = rest.slice(3);

  return (
    <div style={{ background: "#05070d", minHeight: "100vh", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 24px" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 36 }}>
          <div>
            <p style={{ margin: "0 0 6px", fontSize: 11, fontFamily: "monospace", color: "#22d3ee", letterSpacing: "0.12em", textTransform: "uppercase" }}>
              VapeVault Store
            </p>
            <h1 style={{ margin: 0, fontSize: 40, fontWeight: 900, color: "#f8fafc", letterSpacing: "-0.03em", textTransform: "uppercase", lineHeight: 1 }}>
              Shop by<br />
              <span style={{ WebkitTextStroke: "1px #22d3ee", color: "transparent" }}>Category</span>
            </h1>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: "#475569", maxWidth: 240, textAlign: "right", lineHeight: 1.6 }}>
            {CATEGORIES.reduce((s, c) => s + c.count, 0)} products across {CATEGORIES.length} categories
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
          <Tile cat={featured} height={220} />
          <Tile cat={row1[0]} height={220} />
          <Tile cat={row1[1]} height={220} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}>
          {row2.map((cat) => (
            <Tile key={cat.slug} cat={cat} height={170} />
          ))}
          <div
            style={{
              borderRadius: 18,
              padding: "28px",
              background: "rgba(34,211,238,0.04)",
              border: "1px dashed rgba(34,211,238,0.2)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: 170,
              cursor: "pointer",
              gap: 8,
            }}
          >
            <span style={{ fontSize: 24 }}>✦</span>
            <span style={{ fontSize: 12, fontFamily: "monospace", color: "#22d3ee", letterSpacing: "0.06em", textTransform: "uppercase" }}>
              All products
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
