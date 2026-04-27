import { useEffect, useState, useCallback } from "react";
import { supabase } from "../supabaseClient";
import LogoutButton from "../components/LogoutButton";
import {
  createDelivery, startDelivery, arriveDelivery,
  confirmReturn, getActiveDeliveries,
} from "../services/deliveryService";

/* ── Design tokens (mirrors Admin) ── */
const C = {
  bg:       "#0F0E0C",
  bgCard:   "#161512",
  bgHover:  "#1C1A17",
  border:   "#2A2720",
  borderSub:"#221F1B",
  gold:     "#D4A843",
  goldDim:  "#8A6C2A",
  cream:    "#EDE8DC",
  creamDim: "#8A8375",
  green:    "#4CAF82",
  amber:    "#E0933A",
  red:      "#D95C5C",
  blue:     "#5B9BD5",
};

const FONT_DISPLAY = "'Playfair Display', Georgia, serif";
const FONT_BODY    = "'DM Sans', 'Helvetica Neue', sans-serif";
const FONT_MONO    = "'JetBrains Mono', 'Fira Code', monospace";

/* ── Delivery steps ── */
const STEPS = [
  { key: "collect",                     label: "Load",      icon: "📦" },
  { key: "collected",                   label: "Collected", icon: "✓" },
  { key: "in_transit",                  label: "Transit",   icon: "🚗" },
  { key: "awaiting_sales_confirmation", label: "Confirm",   icon: "⏳" },
  { key: "at_market",                   label: "Market",    icon: "🏪" },
  { key: "awaiting_return",             label: "Return",    icon: "↩" },
  { key: "completed",                   label: "Done",      icon: "✓" },
];

function stepIndex(status) {
  if (!status) return 0;
  return STEPS.findIndex(s => s.key === status) ?? 0;
}

/* ── Small atoms ── */
function Label({ children }) {
  return (
    <p style={{
      fontSize: "10px", fontWeight: 600, color: C.creamDim,
      textTransform: "uppercase", letterSpacing: "0.1em",
      margin: "0 0 6px", fontFamily: FONT_BODY,
    }}>{children}</p>
  );
}

function NumInput({ value, onChange, placeholder = "0", max }) {
  return (
    <input
      type="number" min="0" max={max}
      value={value} placeholder={placeholder}
      onChange={onChange}
      style={{
        background: "#0F0E0C", border: `1px solid ${C.border}`,
        borderRadius: "8px", padding: "10px 13px",
        fontSize: "14px", color: C.cream, fontFamily: FONT_MONO,
        outline: "none", width: "100%", boxSizing: "border-box",
        transition: "border-color 0.15s",
      }}
      onFocus={e => { e.target.style.borderColor = C.gold; }}
      onBlur={e => { e.target.style.borderColor = C.border; }}
    />
  );
}

function ActionBtn({ children, onClick, color = "gold", disabled }) {
  const palette = {
    gold:   { bg: C.gold,   text: "#0F0E0C" },
    green:  { bg: "#1A3328", text: C.green,  border: `1px solid ${C.green}44` },
    amber:  { bg: "#332511", text: C.amber,  border: `1px solid ${C.amber}44` },
    red:    { bg: "#321818", text: C.red,    border: `1px solid ${C.red}44`   },
    ghost:  { bg: "#1C1A17", text: C.cream,  border: `1px solid ${C.border}`  },
  };
  const p = palette[color] || palette.gold;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: p.bg, color: p.text,
        border: p.border || "none",
        padding: "13px 20px", borderRadius: "10px",
        fontSize: "14px", fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        fontFamily: FONT_BODY, width: "100%",
        transition: "opacity 0.15s, transform 0.1s",
        letterSpacing: "0.02em",
      }}
      onMouseDown={e => { if (!disabled) e.currentTarget.style.transform = "scale(0.98)"; }}
      onMouseUp={e => { e.currentTarget.style.transform = "scale(1)"; }}
    >
      {children}
    </button>
  );
}

function Card({ children, glow }) {
  return (
    <div style={{
      background: C.bgCard,
      border: `0.5px solid ${glow ? C.gold + "55" : C.border}`,
      borderRadius: "16px", padding: "24px",
      boxShadow: glow ? `0 0 32px ${C.gold}18` : "none",
      transition: "box-shadow 0.3s",
    }}>
      {children}
    </div>
  );
}

/* ── Step progress bar ── */
function StepBar({ status }) {
  const current = stepIndex(status || "collect");
  return (
    <div style={{ marginBottom: "28px" }}>
      <div style={{ display: "flex", alignItems: "center", position: "relative" }}>
        {/* connector line */}
        <div style={{
          position: "absolute", top: "15px", left: "15px", right: "15px",
          height: "1px", background: C.border, zIndex: 0,
        }} />
        <div style={{
          position: "absolute", top: "15px", left: "15px",
          height: "1px", zIndex: 1,
          background: `linear-gradient(90deg, ${C.gold}, ${C.goldDim})`,
          width: current === 0 ? "0%" : `${(current / (STEPS.length - 1)) * 100}%`,
          transition: "width 0.5s ease",
          right: "auto",
        }} />

        {STEPS.map((step, i) => {
          const done    = i < current;
          const active  = i === current;
          return (
            <div key={step.key} style={{
              flex: 1, display: "flex", flexDirection: "column",
              alignItems: "center", zIndex: 2, gap: "6px",
            }}>
              <div style={{
                width: "30px", height: "30px", borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: done ? "12px" : "14px",
                background: done  ? C.gold    :
                            active ? "#2A2010" : C.bgCard,
                border: done   ? `2px solid ${C.gold}` :
                        active ? `2px solid ${C.gold}` :
                                 `1px solid ${C.border}`,
                color:  done ? "#0F0E0C" : active ? C.gold : C.creamDim,
                fontWeight: 600,
                transition: "all 0.3s",
              }}>
                {done ? "✓" : step.icon}
              </div>
              <span style={{
                fontSize: "9px", fontFamily: FONT_BODY, fontWeight: 600,
                letterSpacing: "0.07em", textTransform: "uppercase",
                color: active ? C.gold : done ? C.goldDim : C.creamDim,
              }}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════ */
export default function Transport() {
  const [storeStock, setStoreStock] = useState([]);
  const [selected,   setSelected]   = useState({});
  const [delivery,   setDelivery]   = useState(null);
  const [timer,      setTimer]      = useState("");
  const [returnMap,  setReturnMap]  = useState({});
  const [loading,    setLoading]    = useState(false);

  /* ── Data loading ── */
  const loadData = useCallback(async () => {
    try {
      const { data: loc } = await supabase
        .from("inventory_locations").select("id").eq("name", "store").maybeSingle();
      if (loc) {
        const { data: stock } = await supabase
          .from("inventory")
          .select("*, products(name, cakes_per_crate)")
          .eq("location_id", loc.id);
        setStoreStock(stock || []);
      }
      const active = await getActiveDeliveries();
      setDelivery(active?.[0] || null);
    } catch (err) { console.error(err); }
  }, []);

  useEffect(() => {
    loadData();
    const ch = supabase.channel("transport-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "deliveries" }, loadData)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [loadData]);

  /* ── Transit timer ── */
  useEffect(() => {
    let iv;
    if (delivery?.status === "in_transit" && delivery?.departed_at) {
      iv = setInterval(() => {
        const diff = Math.floor((Date.now() - new Date(delivery.departed_at)) / 1000);
        if (diff < 0) return;
        const h = Math.floor(diff / 3600);
        const m = Math.floor((diff % 3600) / 60);
        const s = diff % 60;
        setTimer(h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`);
      }, 1000);
    } else { setTimer(""); }
    return () => clearInterval(iv);
  }, [delivery?.status, delivery?.departed_at]);

  /* ── Actions ── */
  async function handleCollect() {
    const items = Object.entries(selected)
      .filter(([, qty]) => Number(qty) > 0)
      .map(([pid, qty]) => ({ product_id: pid, crates: Number(qty) }));
    if (!items.length) return alert("Select at least one crate to load.");
    setLoading(true);
    try { await createDelivery(items); setSelected({}); loadData(); }
    catch (err) { alert(err.message); }
    finally { setLoading(false); }
  }

  async function handleStart() {
    setLoading(true);
    try { await startDelivery(delivery.id); loadData(); }
    catch (err) { alert(err.message); }
    finally { setLoading(false); }
  }

  async function handleArrive() {
    setLoading(true);
    try { await arriveDelivery(delivery.id); loadData(); }
    catch (err) { alert(err.message); }
    finally { setLoading(false); }
  }

  async function handleReturn() {
    const returns = (delivery.delivery_items || []).map(item => ({
      item_id:    item.id,
      product_id: item.product_id,
      returned:   Number(returnMap[item.id]              || 0),
      with_cakes: Number(returnMap[`${item.id}_cakes`]  || 0),
    }));
    setLoading(true);
    try { await confirmReturn(delivery.id, returns); setReturnMap({}); loadData(); }
    catch (err) { alert(err.message); }
    finally { setLoading(false); }
  }

  /* ── Totals for loaded items ── */
  const selectedTotal = Object.values(selected).reduce((s, v) => s + Number(v || 0), 0);
  const currentStatus = delivery?.status || (storeStock.length > 0 ? "collect" : "collect");

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
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 4px; }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.5; } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
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
          <span style={{ fontSize: "20px" }}>🚗</span>
          <span style={{ fontFamily: FONT_DISPLAY, fontSize: "18px", fontWeight: 600, color: C.gold }}>
            Transport
          </span>
        </div>
        <LogoutButton />
      </div>

      {/* ── MAIN ── */}
      <div style={{
        minHeight: "calc(100vh - 56px)",
        padding: "24px 20px 40px",
        maxWidth: "480px", margin: "0 auto",
        animation: "fadeUp 0.3s ease",
      }}>

        {/* Step progress */}
        <StepBar status={currentStatus} />

        {/* ──────────────────────────────
            STEP 1: LOAD CRATES
        ────────────────────────────── */}
        {!delivery && (
          <Card>
            <p style={{
              fontFamily: FONT_DISPLAY, fontSize: "20px", fontWeight: 600,
              color: C.cream, margin: "0 0 4px",
            }}>Load Crates</p>
            <p style={{
              fontFamily: FONT_BODY, fontSize: "12px", color: C.creamDim, margin: "0 0 24px",
            }}>Select how many crates of each product to take from store.</p>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "24px" }}>
              {storeStock.length === 0 ? (
                <p style={{ color: C.creamDim, fontSize: "13px", fontFamily: FONT_BODY, textAlign: "center", padding: "20px 0" }}>
                  No stock available in store.
                </p>
              ) : (
                storeStock.map(item => {
                  const max = item.quantity_crates || 0;
                  const qty = Number(selected[item.product_id] || 0);
                  return (
                    <div key={item.id} style={{
                      background: qty > 0 ? "#1A1E13" : C.bgHover,
                      border: `1px solid ${qty > 0 ? C.green + "55" : C.borderSub}`,
                      borderRadius: "12px", padding: "14px 16px",
                      transition: "all 0.2s",
                    }}>
                      <div style={{
                        display: "flex", justifyContent: "space-between",
                        alignItems: "center", marginBottom: "10px",
                      }}>
                        <span style={{ fontFamily: FONT_BODY, fontWeight: 600, fontSize: "14px" }}>
                          {item.products?.name || "—"}
                        </span>
                        <span style={{
                          fontFamily: FONT_MONO, fontSize: "11px", color: C.creamDim,
                          background: C.bgCard, padding: "3px 8px", borderRadius: "6px",
                          border: `1px solid ${C.border}`,
                        }}>
                          {max} in store
                        </span>
                      </div>

                      {/* Stepper */}
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <button
                          onClick={() => setSelected(s => ({ ...s, [item.product_id]: Math.max(0, qty - 1) }))}
                          style={{
                            width: "36px", height: "36px", borderRadius: "8px",
                            background: C.bgCard, border: `1px solid ${C.border}`,
                            color: C.cream, fontSize: "18px", cursor: "pointer",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >−</button>

                        <div style={{ flex: 1 }}>
                          <NumInput
                            value={selected[item.product_id] || ""}
                            max={max}
                            onChange={e => setSelected(s => ({
                              ...s, [item.product_id]: Math.min(max, Math.max(0, Number(e.target.value))),
                            }))}
                          />
                        </div>

                        <button
                          onClick={() => setSelected(s => ({ ...s, [item.product_id]: Math.min(max, qty + 1) }))}
                          style={{
                            width: "36px", height: "36px", borderRadius: "8px",
                            background: C.bgCard, border: `1px solid ${C.border}`,
                            color: C.cream, fontSize: "18px", cursor: "pointer",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >+</button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Summary bar */}
            {selectedTotal > 0 && (
              <div style={{
                background: "#1A2010", border: `1px solid ${C.green}44`,
                borderRadius: "10px", padding: "12px 16px",
                display: "flex", justifyContent: "space-between", alignItems: "center",
                marginBottom: "16px", fontFamily: FONT_BODY, fontSize: "13px",
              }}>
                <span style={{ color: C.creamDim }}>Total crates loading</span>
                <span style={{ fontFamily: FONT_MONO, fontWeight: 600, color: C.green, fontSize: "16px" }}>
                  {selectedTotal}
                </span>
              </div>
            )}

            <ActionBtn onClick={handleCollect} disabled={loading || selectedTotal === 0} color="gold">
              {loading ? "Loading…" : `🚚 Collect ${selectedTotal > 0 ? `${selectedTotal} crate${selectedTotal !== 1 ? "s" : ""}` : ""}`}
            </ActionBtn>
          </Card>
        )}

        {/* ──────────────────────────────
            STEP 2: COLLECTED — READY
        ────────────────────────────── */}
        {delivery?.status === "collected" && (
          <Card glow>
            <p style={{ fontFamily: FONT_DISPLAY, fontSize: "20px", fontWeight: 600, color: C.cream, margin: "0 0 4px" }}>
              Ready to Go
            </p>
            <p style={{ fontFamily: FONT_BODY, fontSize: "12px", color: C.creamDim, margin: "0 0 20px" }}>
              Crates loaded. Start when leaving the bakery.
            </p>

            {/* Loaded items summary */}
            <div style={{ marginBottom: "20px" }}>
              {(delivery.delivery_items || []).map(item => (
                <div key={item.id} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "10px 0", borderBottom: `0.5px solid ${C.borderSub}`,
                  fontFamily: FONT_BODY, fontSize: "13px",
                }}>
                  <span>{item.products?.name || "—"}</span>
                  <span style={{ fontFamily: FONT_MONO, color: C.gold }}>{item.crates_sent} crates</span>
                </div>
              ))}
            </div>

            <ActionBtn onClick={handleStart} disabled={loading} color="gold">
              {loading ? "Starting…" : "🚦 Start Delivery"}
            </ActionBtn>
          </Card>
        )}

        {/* ──────────────────────────────
            STEP 3: IN TRANSIT
        ────────────────────────────── */}
        {delivery?.status === "in_transit" && (
          <Card glow>
            <p style={{ fontFamily: FONT_DISPLAY, fontSize: "20px", fontWeight: 600, color: C.cream, margin: "0 0 20px" }}>
              In Transit
            </p>

            {/* Live timer */}
            <div style={{
              textAlign: "center", padding: "28px 0",
              marginBottom: "20px",
            }}>
              <div style={{
                fontFamily: FONT_MONO, fontSize: "42px", fontWeight: 500,
                color: C.gold, letterSpacing: "0.04em",
                animation: "pulse 2s ease infinite",
              }}>
                {timer || "0m 0s"}
              </div>
              <p style={{ fontFamily: FONT_BODY, fontSize: "11px", color: C.creamDim, margin: "8px 0 0" }}>
                elapsed since departure
              </p>
            </div>

            {/* Cargo summary */}
            <div style={{
              background: C.bgHover, borderRadius: "10px", padding: "14px 16px", marginBottom: "20px",
            }}>
              <p style={{ fontFamily: FONT_BODY, fontSize: "10px", color: C.creamDim, margin: "0 0 10px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Cargo
              </p>
              {(delivery.delivery_items || []).map(item => (
                <div key={item.id} style={{
                  display: "flex", justifyContent: "space-between",
                  fontFamily: FONT_BODY, fontSize: "13px",
                  padding: "6px 0", borderBottom: `0.5px solid ${C.borderSub}`,
                }}>
                  <span>{item.products?.name || "—"}</span>
                  <span style={{ fontFamily: FONT_MONO, color: C.amber }}>{item.crates_sent} crates</span>
                </div>
              ))}
            </div>

            <ActionBtn onClick={handleArrive} disabled={loading} color="green">
              {loading ? "Updating…" : "📍 I've Arrived"}
            </ActionBtn>
          </Card>
        )}

        {/* ──────────────────────────────
            STEP 4: AWAITING SALES CONFIRM
        ────────────────────────────── */}
        {delivery?.status === "awaiting_sales_confirmation" && (
          <Card>
            <div style={{ textAlign: "center", padding: "20px 0 28px" }}>
              <div style={{ fontSize: "48px", marginBottom: "16px", animation: "pulse 2s ease infinite" }}>⏳</div>
              <p style={{ fontFamily: FONT_DISPLAY, fontSize: "20px", color: C.cream, margin: "0 0 8px" }}>
                Awaiting Confirmation
              </p>
              <p style={{ fontFamily: FONT_BODY, fontSize: "13px", color: C.creamDim, margin: 0, lineHeight: 1.6 }}>
                Waiting for the sales team to confirm delivery at the market.
              </p>
            </div>
          </Card>
        )}

        {/* ──────────────────────────────
            STEP 5: AT MARKET
        ────────────────────────────── */}
        {delivery?.status === "at_market" && (
          <Card>
            <div style={{ textAlign: "center", padding: "20px 0 28px" }}>
              <div style={{ fontSize: "48px", marginBottom: "16px" }}>🏪</div>
              <p style={{ fontFamily: FONT_DISPLAY, fontSize: "20px", color: C.cream, margin: "0 0 8px" }}>
                Sales Ongoing
              </p>
              <p style={{ fontFamily: FONT_BODY, fontSize: "13px", color: C.creamDim, margin: "0 0 24px", lineHeight: 1.6 }}>
                The market team is selling. You'll be notified when it's time to return.
              </p>

              {/* What was sent */}
              <div style={{ textAlign: "left" }}>
                {(delivery.delivery_items || []).map(item => (
                  <div key={item.id} style={{
                    display: "flex", justifyContent: "space-between",
                    fontFamily: FONT_BODY, fontSize: "13px",
                    padding: "9px 0", borderBottom: `0.5px solid ${C.borderSub}`,
                  }}>
                    <span style={{ color: C.creamDim }}>{item.products?.name}</span>
                    <span style={{ fontFamily: FONT_MONO, color: C.amber }}>{item.crates_sent} sent</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        )}

        {/* ──────────────────────────────
            STEP 6: CONFIRM RETURN
        ────────────────────────────── */}
        {delivery?.status === "awaiting_return" && (
          <Card glow>
            <p style={{ fontFamily: FONT_DISPLAY, fontSize: "20px", fontWeight: 600, color: C.cream, margin: "0 0 4px" }}>
              Confirm Return
            </p>
            <p style={{ fontFamily: FONT_BODY, fontSize: "12px", color: C.creamDim, margin: "0 0 24px" }}>
              Enter how many crates came back and how many still have cakes inside.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "24px" }}>
              {(delivery.delivery_items || []).map(item => (
                <div key={item.id} style={{
                  background: C.bgHover, borderRadius: "12px", padding: "16px",
                  border: `1px solid ${C.borderSub}`,
                }}>
                  <p style={{
                    fontFamily: FONT_BODY, fontSize: "14px", fontWeight: 600,
                    margin: "0 0 12px", color: C.cream,
                  }}>
                    {item.products?.name || "—"}
                    <span style={{ fontFamily: FONT_MONO, fontSize: "11px", color: C.creamDim, marginLeft: "8px", fontWeight: 400 }}>
                      ({item.crates_sent} sent)
                    </span>
                  </p>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    <div>
                      <Label>Crates returned</Label>
                      <NumInput
                        value={returnMap[item.id] || ""}
                        max={item.crates_sent}
                        onChange={e => setReturnMap(m => ({ ...m, [item.id]: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label>With cakes</Label>
                      <NumInput
                        value={returnMap[`${item.id}_cakes`] || ""}
                        onChange={e => setReturnMap(m => ({ ...m, [`${item.id}_cakes`]: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <ActionBtn onClick={handleReturn} disabled={loading} color="gold">
              {loading ? "Saving…" : "✓ Confirm Return"}
            </ActionBtn>
          </Card>
        )}

        {/* ──────────────────────────────
            STEP 7: COMPLETED
        ────────────────────────────── */}
        {delivery?.status === "completed" && (
          <Card>
            <div style={{ textAlign: "center", padding: "20px 0 28px" }}>
              <div style={{ fontSize: "52px", marginBottom: "16px" }}>✅</div>
              <p style={{ fontFamily: FONT_DISPLAY, fontSize: "20px", color: C.gold, margin: "0 0 8px" }}>
                Delivery Complete
              </p>
              <p style={{ fontFamily: FONT_BODY, fontSize: "13px", color: C.creamDim, lineHeight: 1.6 }}>
                Everything's been returned and confirmed. Good work!
              </p>
            </div>
          </Card>
        )}

      </div>
    </>
  );
}