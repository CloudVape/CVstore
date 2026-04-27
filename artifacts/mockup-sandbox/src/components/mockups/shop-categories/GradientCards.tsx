import { ArrowRight } from "lucide-react";

const CATEGORIES = [
  { slug: "mods-devices", name: "Mods & Devices", emoji: "📦", count: 3, desc: "Box mods, mech mods, and advanced devices for cloud chasers", accent: "#22d3ee" },
  { slug: "pod-systems", name: "Pod Systems", emoji: "🔋", count: 3, desc: "Compact pod kits perfect for daily use and stealth vaping", accent: "#a78bfa" },
  { slug: "tanks-atomizers", name: "Tanks & Atomizers", emoji: "🛢️", count: 3, desc: "Sub-ohm tanks, RTAs, RDAs, and rebuildables", accent: "#22d3ee" },
  { slug: "e-liquids", name: "E-Liquids", emoji: "💧", count: 5, desc: "Premium e-juice in every flavor profile imaginable", accent: "#a78bfa" },
  { slug: "coils-wire", name: "Coils & Wire", emoji: "🌀", count: 4, desc: "Replacement coils, builder wire, and wicking supplies", accent: "#22d3ee" },
  { slug: "disposables", name: "Disposables", emoji: "⚡", count: 3, desc: "Grab-and-go disposable vapes in popular flavors", accent: "#a78bfa" },
  { slug: "accessories", name: "Accessories", emoji: "🔧", count: 4, desc: "Chargers, cases, and everything else you need", accent: "#22d3ee" },
];

export function GradientCards() {
  return (
    <div
      className="min-h-screen"
      style={{ background: "#0a0a0f", fontFamily: "system-ui, sans-serif" }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 24px" }}>
        <div style={{ marginBottom: 48 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <div style={{ width: 4, height: 32, background: "linear-gradient(180deg,#22d3ee,#a78bfa)", borderRadius: 2 }} />
            <h1 style={{ margin: 0, fontSize: 36, fontWeight: 900, textTransform: "uppercase", letterSpacing: "-0.02em", color: "#f8fafc" }}>
              Shop by Category
            </h1>
          </div>
          <p style={{ margin: 0, fontSize: 14, color: "#64748b", fontFamily: "monospace", letterSpacing: "0.05em" }}>
            Find exactly what you're looking for
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          {CATEGORIES.map((cat, i) => (
            <div
              key={cat.slug}
              style={{
                position: "relative",
                borderRadius: 16,
                padding: "1px",
                background: `linear-gradient(135deg, ${cat.accent}55, transparent 60%)`,
                cursor: "pointer",
                transition: "transform 0.2s",
              }}
            >
              <div
                style={{
                  borderRadius: 15,
                  padding: "28px 24px",
                  background: "linear-gradient(135deg, #111827 0%, #0d1117 100%)",
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  gap: 16,
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                  <div
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 14,
                      background: `${cat.accent}18`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 26,
                      border: `1px solid ${cat.accent}30`,
                    }}
                  >
                    {cat.emoji}
                  </div>
                  <span
                    style={{
                      fontSize: 11,
                      fontFamily: "monospace",
                      color: cat.accent,
                      background: `${cat.accent}15`,
                      border: `1px solid ${cat.accent}30`,
                      borderRadius: 20,
                      padding: "3px 10px",
                      letterSpacing: "0.05em",
                    }}
                  >
                    {cat.count} products
                  </span>
                </div>

                <div style={{ flex: 1 }}>
                  <h3
                    style={{
                      margin: "0 0 8px",
                      fontSize: 15,
                      fontWeight: 800,
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      color: "#f1f5f9",
                    }}
                  >
                    {cat.name}
                  </h3>
                  <p style={{ margin: 0, fontSize: 13, color: "#64748b", lineHeight: 1.6 }}>
                    {cat.desc}
                  </p>
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 12,
                    fontFamily: "monospace",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    color: cat.accent,
                  }}
                >
                  Shop now <ArrowRight size={13} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
