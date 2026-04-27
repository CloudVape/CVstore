import { ArrowRight, Zap } from "lucide-react";

const FEATURED = {
  slug: "mods-devices",
  name: "Mods & Devices",
  emoji: "📦",
  count: 3,
  desc: "From beginner-friendly box mods to advanced mech setups — find the hardware that matches your style and power needs.",
};

const REST = [
  { slug: "pod-systems", name: "Pod Systems", emoji: "🔋", count: 3, desc: "Compact kits for daily use" },
  { slug: "tanks-atomizers", name: "Tanks & Atomizers", emoji: "🛢️", count: 3, desc: "RTAs, RDAs & sub-ohm tanks" },
  { slug: "e-liquids", name: "E-Liquids", emoji: "💧", count: 5, desc: "Premium juice in every profile" },
  { slug: "coils-wire", name: "Coils & Wire", emoji: "🌀", count: 4, desc: "Replacement coils & builder wire" },
  { slug: "disposables", name: "Disposables", emoji: "⚡", count: 3, desc: "Grab-and-go vapes" },
  { slug: "accessories", name: "Accessories", emoji: "🔧", count: 4, desc: "Chargers, cases & more" },
];

export function FeatureBanner() {
  return (
    <div style={{ background: "#080c12", minHeight: "100vh", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 24px" }}>
        <div style={{ marginBottom: 36 }}>
          <p style={{ margin: "0 0 8px", fontSize: 12, fontFamily: "monospace", color: "#22d3ee", letterSpacing: "0.12em", textTransform: "uppercase" }}>
            Browse the vault
          </p>
          <h1 style={{ margin: 0, fontSize: 38, fontWeight: 900, color: "#f8fafc", letterSpacing: "-0.02em", textTransform: "uppercase" }}>
            Shop by Category
          </h1>
        </div>

        <div
          style={{
            borderRadius: 20,
            padding: "2px",
            background: "linear-gradient(135deg, #22d3ee, #a78bfa)",
            marginBottom: 24,
            cursor: "pointer",
          }}
        >
          <div
            style={{
              borderRadius: 18,
              padding: "40px 44px",
              background: "linear-gradient(135deg, #0f1e2b 0%, #10111a 100%)",
              display: "flex",
              alignItems: "center",
              gap: 40,
            }}
          >
            <div
              style={{
                width: 120,
                height: 120,
                borderRadius: 24,
                background: "linear-gradient(135deg, #22d3ee20, #a78bfa20)",
                border: "1px solid rgba(34,211,238,0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 60,
                flexShrink: 0,
              }}
            >
              {FEATURED.emoji}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <span
                  style={{
                    fontSize: 10,
                    fontFamily: "monospace",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    color: "#22d3ee",
                    background: "#22d3ee18",
                    border: "1px solid #22d3ee30",
                    borderRadius: 20,
                    padding: "3px 10px",
                  }}
                >
                  Featured
                </span>
                <span style={{ fontSize: 11, fontFamily: "monospace", color: "#475569" }}>
                  {FEATURED.count} products
                </span>
              </div>
              <h2 style={{ margin: "0 0 12px", fontSize: 28, fontWeight: 900, color: "#f1f5f9", textTransform: "uppercase", letterSpacing: "-0.01em" }}>
                {FEATURED.name}
              </h2>
              <p style={{ margin: "0 0 20px", fontSize: 14, color: "#94a3b8", lineHeight: 1.7, maxWidth: 480 }}>
                {FEATURED.desc}
              </p>
              <button
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  background: "linear-gradient(135deg, #22d3ee, #06b6d4)",
                  color: "#0a0a0f",
                  border: "none",
                  borderRadius: 10,
                  padding: "12px 24px",
                  fontSize: 13,
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  cursor: "pointer",
                }}
              >
                Shop {FEATURED.name} <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          {REST.map((cat) => (
            <div
              key={cat.slug}
              style={{
                borderRadius: 14,
                padding: "20px",
                background: "#0e1420",
                border: "1px solid rgba(255,255,255,0.06)",
                display: "flex",
                alignItems: "center",
                gap: 14,
                cursor: "pointer",
                transition: "border-color 0.2s",
              }}
            >
              <div
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 12,
                  background: "rgba(34,211,238,0.08)",
                  border: "1px solid rgba(34,211,238,0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 22,
                  flexShrink: 0,
                }}
              >
                {cat.emoji}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 style={{ margin: "0 0 3px", fontSize: 13, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em", color: "#e2e8f0" }}>
                  {cat.name}
                </h3>
                <p style={{ margin: 0, fontSize: 11, color: "#475569", lineHeight: 1.5 }}>{cat.desc}</p>
              </div>
              <ArrowRight size={14} color="#22d3ee" style={{ flexShrink: 0 }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
