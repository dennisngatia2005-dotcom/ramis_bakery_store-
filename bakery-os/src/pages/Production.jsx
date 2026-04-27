import { useState, useEffect, useCallback } from "react";
import { supabase } from "../supabaseClient";
import { logProduction } from "../services/productionService";
import LogoutButton from "../components/LogoutButton";

/* ── Design tokens ── */
const C = {
  bg:        "#0F0E0C",
  bgCard:    "#161512",
  bgHover:   "#1C1A17",
  border:    "#2A2720",
  borderSub: "#221F1B",
  gold:      "#D4A843",
  goldDim:   "#8A6C2A",
  cream:     "#EDE8DC",
  creamDim:  "#8A8375",
  green:     "#4CAF82",
  amber:     "#E0933A",
  red:       "#D95C5C",
  blue:      "#5B9BD5",
};

const FONT_DISPLAY = "'Playfair Display', Georgia, serif";
const FONT_BODY    = "'DM Sans', 'Helvetica Neue', sans-serif";
const FONT_MONO    = "'JetBrains Mono', 'Fira Code', monospace";

function getShift() {
  const h = new Date().getHours();
  return h >= 6 && h < 18 ? "day" : "night";
}

/* ── Atoms ── */
function Label({ children }) {
  return (
    <p style={{
      fontSize: "10px", fontWeight: 600, color: C.creamDim,
      textTransform: "uppercase", letterSpacing: "0.1em",
      margin: "0 0 7px", fontFamily: FONT_BODY,
    }}>{children}</p>
  );
}

function NumInput({ value, onChange, placeholder = "0", min = 0 }) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      type="number" min={min}
      value={value || ""}
      placeholder={placeholder}
      onChange={onChange}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        background: "#0F0E0C",
        border: `1px solid ${focused ? C.gold : C.border}`,
        borderRadius: "8px", padding: "11px 14px",
        fontSize: "15px", color: C.cream, fontFamily: FONT_MONO,
        outline: "none", width: "100%", boxSizing: "border-box",
        transition: "border-color 0.15s",
      }}
    />
  );
}

function Stepper({ value, onChange, max }) {
  const n = Number(value || 0);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      <button
        type="button"
        onClick={() => onChange(Math.max(0, n - 1))}
        style={{
          width: "38px", height: "38px", borderRadius: "8px",
          background: C.bgCard, border: `1px solid ${C.border}`,
          color: C.cream, fontSize: "20px", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0, fontFamily: FONT_BODY,
          transition: "background 0.1s",
        }}
      >−</button>
      <div style={{ flex: 1 }}>
        <NumInput
          value={value}
          onChange={e => onChange(max != null
            ? Math.min(max, Math.max(0, Number(e.target.value)))
            : Math.max(0, Number(e.target.value)))}
        />
      </div>
      <button
        type="button"
        onClick={() => onChange(max != null ? Math.min(max, n + 1) : n + 1)}
        style={{
          width: "38px", height: "38px", borderRadius: "8px",
          background: C.bgCard, border: `1px solid ${C.border}`,
          color: C.cream, fontSize: "20px", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0, fontFamily: FONT_BODY,
          transition: "background 0.1s",
        }}
      >+</button>
    </div>
  );
}

function StatBox({ label, value, color, sub }) {
  const colorMap = { gold: C.gold, green: C.green, amber: C.amber, blue: C.blue };
  const accent = colorMap[color] || C.cream;
  return (
    <div style={{
      background: C.bgHover, borderRadius: "10px", padding: "14px 16px",
      border: `1px solid ${C.borderSub}`, textAlign: "center",
      position: "relative", overflow: "hidden",
    }}>
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: "2px",
        background: `linear-gradient(90deg, ${accent}66, transparent)`,
      }} />
      <div style={{ fontFamily: FONT_MONO, fontSize: "22px", fontWeight: 500, color: accent, lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontFamily: FONT_BODY, fontSize: "10px", color: C.creamDim, marginTop: "5px", textTransform: "uppercase", letterSpacing: "0.07em" }}>
        {label}
      </div>
      {sub && <div style={{ fontFamily: FONT_BODY, fontSize: "10px", color: C.creamDim, marginTop: "2px" }}>{sub}</div>}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   MAIN
══════════════════════════════════════════════════════════ */
export default function Production() {
  const [products,         setProducts]         = useState([]);
  const [selectedProduct,  setSelectedProduct]  = useState("");
  const [mixes,            setMixes]            = useState(0);
  const [manualCakes,      setManualCakes]      = useState(0);
  const [note,             setNote]             = useState("");
  const [history,          setHistory]          = useState([]);
  const [loading,          setLoading]          = useState(false);
  const [showHistory,      setShowHistory]      = useState(false);
  const [submitted,        setSubmitted]        = useState(false);

  /* ── Load products ── */
  useEffect(() => {
    supabase.from("products").select("*").then(({ data }) => setProducts(data || []));
  }, []);

  /* ── Load history ── */
  const loadHistory = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const today = new Date().toISOString().split("T")[0];
    const { data } = await supabase
      .from("production_logs")
      .select("*, products(name, cakes_per_crate)")
      .eq("user_id", user.id)
      .gte("created_at", today)
      .order("created_at", { ascending: false });
    setHistory(data || []);
  }, []);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  /* ── Derived product + preview ── */
  const product = products.find(p => p.id === selectedProduct);

  let preview = null;
  if (product && (mixes > 0 || manualCakes > 0)) {
    const cpCrate = product.cakes_per_crate || 40;
    if (product.basins_per_mix && mixes > 0) {
      const basins     = mixes * product.basins_per_mix;
      const totalCakes = Math.floor(basins * 3 * cpCrate);
      preview = {
        totalCakes,
        crates:    Math.floor(totalCakes / cpCrate),
        remainder: totalCakes % cpCrate,
        flourUsed: product.sacks_per_mix ? (mixes * product.sacks_per_mix).toFixed(2) : null,
      };
    } else if (!product.basins_per_mix && manualCakes > 0) {
      preview = {
        totalCakes: manualCakes,
        crates:    Math.floor(manualCakes / cpCrate),
        remainder: manualCakes % cpCrate,
        flourUsed: product.sacks_per_mix ? (mixes * product.sacks_per_mix).toFixed(2) : null,
      };
    }
  }

  /* ── Today's totals ── */
  const todayTotals = history.reduce(
    (acc, h) => ({
      mixes:  acc.mixes  + (h.mixes_made     || 0),
      cakes:  acc.cakes  + (h.cakes_produced || 0),
      crates: acc.crates + (h.crates_produced|| 0),
      flour:  acc.flour  + Number(h.flour_used || 0),
    }),
    { mixes: 0, cakes: 0, crates: 0, flour: 0 }
  );

  /* ── Submit ── */
  async function handleSubmit(e) {
    e.preventDefault();
    if (!selectedProduct) return alert("Select a product first.");
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not logged in");
      await logProduction({
        product_id:   selectedProduct,
        user_id:      user.id,
        mixes_made:   mixes,
        manual_cakes: manualCakes,
        note,
        shift: getShift(),
      });
      setMixes(0); setManualCakes(0); setNote(""); setSelectedProduct("");
      setSubmitted(true);
      setTimeout(() => setSubmitted(false), 2000);
      await loadHistory();
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  }

  const shift = getShift();

  /* ══════════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════════ */
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600&family=DM+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; }
        body { background: ${C.bg}; color: ${C.cream}; margin: 0; }
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; }
        input[type=number] { -moz-appearance: textfield; }
        select:focus { outline: none; border-color: ${C.gold} !important; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 4px; }
        @keyframes fadeUp   { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        @keyframes popIn    { 0% { transform:scale(0.9); opacity:0; } 100% { transform:scale(1); opacity:1; } }
        @keyframes shimmer  { 0%,100% { opacity:1; } 50% { opacity:0.6; } }
      `}</style>

      {/* ── NAV ── */}
      <div style={{
        position: "sticky", top: 0, zIndex: 50,
        background: `${C.bg}EE`, backdropFilter: "blur(12px)",
        borderBottom: `0.5px solid ${C.border}`,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 20px", height: "56px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "20px" }}>⚙️</span>
          <span style={{ fontFamily: FONT_DISPLAY, fontSize: "18px", fontWeight: 600, color: C.gold }}>
            Production
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{
            fontFamily: FONT_BODY, fontSize: "11px",
            padding: "3px 10px", borderRadius: "999px",
            background: shift === "day" ? "#2A2010" : "#1E1A2E",
            color: shift === "day" ? C.gold : C.blue,
            border: `1px solid ${shift === "day" ? C.goldDim : "#3A3060"}44`,
            fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase",
          }}>
            {shift === "day" ? "☀ Day shift" : "🌙 Night shift"}
          </span>
          <LogoutButton />
        </div>
      </div>

      {/* ── CONTENT ── */}
      <div style={{
        maxWidth: "480px", margin: "0 auto",
        padding: "24px 20px 48px",
        animation: "fadeUp 0.3s ease",
      }}>

        {/* Today's totals */}
        {history.length > 0 && (
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
            gap: "8px", marginBottom: "20px",
          }}>
            <StatBox label="Mixes"   value={todayTotals.mixes}              color="blue"  />
            <StatBox label="Cakes"   value={todayTotals.cakes}              color="gold"  />
            <StatBox label="Crates"  value={todayTotals.crates}             color="green" />
            <StatBox label="Flour"   value={`${todayTotals.flour.toFixed(1)}`} sub="sacks" color="amber" />
          </div>
        )}

        {/* ── FORM CARD ── */}
        <div style={{
          background: C.bgCard, border: `0.5px solid ${C.border}`,
          borderRadius: "16px", overflow: "hidden", marginBottom: "16px",
        }}>
          {/* Card header */}
          <div style={{
            padding: "18px 20px 16px",
            borderBottom: `0.5px solid ${C.border}`,
            background: `linear-gradient(135deg, #1A1814, ${C.bgCard})`,
          }}>
            <p style={{
              fontFamily: FONT_DISPLAY, fontSize: "20px", fontWeight: 600,
              color: C.cream, margin: "0 0 2px",
            }}>Log Production</p>
            <p style={{ fontFamily: FONT_BODY, fontSize: "12px", color: C.creamDim, margin: 0 }}>
              Record your batch for today's {shift} shift.
            </p>
          </div>

          <form onSubmit={handleSubmit} style={{ padding: "20px" }}>

            {/* PRODUCT SELECT */}
            <div style={{ marginBottom: "18px" }}>
              <Label>Product</Label>
              <div style={{ position: "relative" }}>
                <select
                  value={selectedProduct}
                  onChange={e => { setSelectedProduct(e.target.value); setMixes(0); setManualCakes(0); }}
                  style={{
                    width: "100%", background: "#0F0E0C",
                    border: `1px solid ${selectedProduct ? C.gold + "88" : C.border}`,
                    borderRadius: "8px", padding: "11px 36px 11px 14px",
                    fontSize: "14px", color: selectedProduct ? C.cream : C.creamDim,
                    fontFamily: FONT_BODY, outline: "none", appearance: "none",
                    cursor: "pointer", transition: "border-color 0.15s",
                  }}
                >
                  <option value="">Choose a product…</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <span style={{
                  position: "absolute", right: "12px", top: "50%",
                  transform: "translateY(-50%)", color: C.creamDim,
                  pointerEvents: "none", fontSize: "12px",
                }}>▾</span>
              </div>
            </div>



            {/* MIXES or MANUAL CAKES */}
            {product && (
              <div style={{ marginBottom: "18px", animation: "popIn 0.2s ease" }}>
                {product.basins_per_mix ? (
                  <>
                    <Label>Mixes made</Label>
                    <Stepper value={mixes} onChange={setMixes} />
                  </>
                ) : (
                  <>
                    <Label>Total cakes produced</Label>
                    <Stepper value={manualCakes} onChange={setManualCakes} />
                  </>
                )}
              </div>
            )}

            {/* NOTE */}
            <div style={{ marginBottom: "20px" }}>
              <Label>Note (optional)</Label>
              <input
                type="text"
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Any observations, issues…"
                style={{
                  width: "100%", background: "#0F0E0C",
                  border: `1px solid ${C.border}`,
                  borderRadius: "8px", padding: "11px 14px",
                  fontSize: "13px", color: C.cream, fontFamily: FONT_BODY,
                  outline: "none", boxSizing: "border-box",
                  transition: "border-color 0.15s",
                }}
                onFocus={e => e.target.style.borderColor = C.gold}
                onBlur={e => e.target.style.borderColor = C.border}
              />
            </div>

            {/* PREVIEW */}
            {preview && (
              <div style={{
                background: "#1A2010", border: `1px solid ${C.green}44`,
                borderRadius: "12px", padding: "16px",
                marginBottom: "20px", animation: "popIn 0.2s ease",
              }}>
                <p style={{
                  fontFamily: FONT_BODY, fontSize: "10px", fontWeight: 600,
                  color: C.green, textTransform: "uppercase", letterSpacing: "0.1em",
                  margin: "0 0 12px",
                }}>Batch preview</p>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontFamily: FONT_MONO, fontSize: "24px", color: C.gold, fontWeight: 500 }}>
                      {preview.crates}
                    </div>
                    <div style={{ fontFamily: FONT_BODY, fontSize: "10px", color: C.creamDim, textTransform: "uppercase", letterSpacing: "0.07em" }}>
                      Crates
                    </div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontFamily: FONT_MONO, fontSize: "24px", color: C.cream, fontWeight: 500 }}>
                      {preview.totalCakes}
                    </div>
                    <div style={{ fontFamily: FONT_BODY, fontSize: "10px", color: C.creamDim, textTransform: "uppercase", letterSpacing: "0.07em" }}>
                      {product?.name || "Units"}
                    </div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontFamily: FONT_MONO, fontSize: "24px", color: preview.remainder > 0 ? C.amber : C.creamDim, fontWeight: 500 }}>
                      {preview.remainder}
                    </div>
                    <div style={{ fontFamily: FONT_BODY, fontSize: "10px", color: C.creamDim, textTransform: "uppercase", letterSpacing: "0.07em" }}>
                      Remainder
                    </div>
                  </div>
                </div>


              </div>
            )}

            {/* SUBMIT */}
            <button
              type="submit"
              disabled={loading || !selectedProduct || (!mixes && !manualCakes)}
              style={{
                width: "100%", padding: "14px",
                background: submitted ? "#1A3328" : C.gold,
                color: submitted ? C.green : "#0F0E0C",
                border: submitted ? `1px solid ${C.green}88` : "none",
                borderRadius: "10px", fontSize: "14px", fontWeight: 700,
                cursor: (loading || !selectedProduct || (!mixes && !manualCakes)) ? "not-allowed" : "pointer",
                opacity: (loading || !selectedProduct || (!mixes && !manualCakes)) ? 0.5 : 1,
                fontFamily: FONT_BODY, letterSpacing: "0.03em",
                transition: "all 0.2s",
              }}
            >
              {submitted ? "✓ Logged!" : loading ? "Saving…" : "Log Production"}
            </button>
          </form>
        </div>

        {/* ── HISTORY TOGGLE ── */}
        <button
          onClick={() => setShowHistory(s => !s)}
          style={{
            width: "100%", padding: "12px",
            background: "transparent",
            border: `1px solid ${C.border}`,
            borderRadius: "10px", fontSize: "13px", fontWeight: 500,
            color: C.creamDim, cursor: "pointer",
            fontFamily: FONT_BODY, marginBottom: "16px",
            display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
            transition: "border-color 0.15s, color 0.15s",
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = C.gold; e.currentTarget.style.color = C.gold; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.creamDim; }}
        >
          <span>{showHistory ? "▴" : "▾"}</span>
          {showHistory ? "Hide today's work" : `View today's work${history.length > 0 ? ` (${history.length})` : ""}`}
        </button>

        {/* ── HISTORY ── */}
        {showHistory && (
          <div style={{ animation: "fadeUp 0.25s ease" }}>
            {history.length === 0 ? (
              <div style={{
                background: C.bgCard, border: `0.5px solid ${C.border}`,
                borderRadius: "14px", padding: "32px",
                textAlign: "center", color: C.creamDim,
                fontFamily: FONT_BODY, fontSize: "13px",
              }}>
                No production logged yet today.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {history.map((h, i) => (
                  <div key={h.id} style={{
                    background: C.bgCard, border: `0.5px solid ${C.border}`,
                    borderRadius: "12px", padding: "16px",
                    animation: `fadeUp 0.2s ease ${i * 0.04}s both`,
                  }}>
                    <div style={{
                      display: "flex", justifyContent: "space-between",
                      alignItems: "flex-start", marginBottom: "12px",
                    }}>
                      <div>
                        <p style={{
                          fontFamily: FONT_BODY, fontWeight: 600,
                          fontSize: "14px", color: C.cream, margin: "0 0 3px",
                        }}>
                          {h.products?.name || "—"}
                        </p>
                        <span style={{
                          fontFamily: FONT_BODY, fontSize: "10px", fontWeight: 600,
                          padding: "2px 8px", borderRadius: "999px", textTransform: "uppercase",
                          letterSpacing: "0.07em",
                          background: h.shift === "night" ? "#1E1A2E" : "#2A2010",
                          color: h.shift === "night" ? C.blue : C.gold,
                        }}>
                          {h.shift === "night" ? "🌙 Night" : "☀ Day"}
                        </span>
                      </div>
                      <span style={{
                        fontFamily: FONT_MONO, fontSize: "11px", color: C.creamDim,
                      }}>
                        {new Date(h.created_at).toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>

                    {/* Stats row */}
                    <div style={{
                      display: "grid",
                      gridTemplateColumns: `repeat(${[h.mixes_made > 0, true, true].filter(Boolean).length}, 1fr)`,
                      gap: "8px",
                    }}>
                      {h.mixes_made > 0 && (
                        <div style={{ textAlign: "center", padding: "8px 0" }}>
                          <div style={{ fontFamily: FONT_MONO, fontSize: "18px", color: C.blue }}>{h.mixes_made}</div>
                          <div style={{ fontFamily: FONT_BODY, fontSize: "9px", color: C.creamDim, textTransform: "uppercase", letterSpacing: "0.07em", marginTop: "2px" }}>Mixes</div>
                        </div>
                      )}
                      <div style={{ textAlign: "center", padding: "8px 0", borderLeft: `0.5px solid ${C.borderSub}` }}>
                        <div style={{ fontFamily: FONT_MONO, fontSize: "18px", color: C.gold }}>{h.crates_produced}</div>
                        <div style={{ fontFamily: FONT_BODY, fontSize: "9px", color: C.creamDim, textTransform: "uppercase", letterSpacing: "0.07em", marginTop: "2px" }}>Crates</div>
                      </div>
                      <div style={{ textAlign: "center", padding: "8px 0", borderLeft: `0.5px solid ${C.borderSub}` }}>
                        <div style={{ fontFamily: FONT_MONO, fontSize: "18px", color: C.cream }}>{h.cakes_produced}</div>
                        <div style={{ fontFamily: FONT_BODY, fontSize: "9px", color: C.creamDim, textTransform: "uppercase", letterSpacing: "0.07em", marginTop: "2px" }}>{h.products?.name || "Units"}</div>
                      </div>
                    </div>

                    {/* Remainder */}
                    {h.remainder_cakes > 0 && (
                      <div style={{
                        marginTop: "10px", paddingTop: "10px",
                        borderTop: `0.5px solid ${C.borderSub}`,
                        display: "flex", justifyContent: "space-between",
                        fontFamily: FONT_BODY, fontSize: "12px",
                      }}>
                        <span style={{ color: C.creamDim }}>Remainder cakes</span>
                        <span style={{ fontFamily: FONT_MONO, color: C.amber }}>{h.remainder_cakes}</span>
                      </div>
                    )}

                    {/* Note */}
                    {h.note && (
                      <div style={{
                        marginTop: "10px", paddingTop: "10px",
                        borderTop: `0.5px solid ${C.borderSub}`,
                        fontFamily: FONT_BODY, fontSize: "12px", color: C.creamDim,
                        display: "flex", gap: "8px",
                      }}>
                        <span style={{ flexShrink: 0 }}>📝</span>
                        <span>{h.note}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}