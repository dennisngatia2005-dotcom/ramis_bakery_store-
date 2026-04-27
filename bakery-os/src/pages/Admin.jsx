import { useEffect, useState, useCallback } from "react";
import LogoutButton from "../components/LogoutButton";
import { supabase } from "../supabaseClient";
import {
  LineChart, Line, AreaChart, Area, XAxis, YAxis, Tooltip,
  CartesianGrid, PieChart, Pie, Cell, Legend, ResponsiveContainer, BarChart, Bar,
} from "recharts";
import {
  getSalesData, getInventoryData, getDeliveryData, getStaffData,
  getProductionData, getFlourData, getExchangesData, getOrdersData,
  addFlourStock, addPayment, searchCustomers,
} from "../services/adminService";

/* ══════════════════════════════════════════════════════════
   DESIGN TOKENS
══════════════════════════════════════════════════════════ */
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
  purple:    "#9B7FD4",
};

const FONT_DISPLAY = "'Playfair Display', Georgia, serif";
const FONT_BODY    = "'DM Sans', 'Helvetica Neue', sans-serif";
const FONT_MONO    = "'JetBrains Mono', 'Fira Code', monospace";

/* ══════════════════════════════════════════════════════════
   SMALL REUSABLE COMPONENTS
══════════════════════════════════════════════════════════ */

function Pill({ label, color = "default" }) {
  const palettes = {
    green:    { bg: "#1A3328", color: C.green },
    amber:    { bg: "#332511", color: C.amber },
    red:      { bg: "#321818", color: C.red },
    blue:     { bg: "#162440", color: C.blue },
    purple:   { bg: "#261E3A", color: C.purple },
    gold:     { bg: "#2A2010", color: C.gold },
    default:  { bg: "#222019", color: C.creamDim },
  };
  const p = palettes[color] || palettes.default;
  return (
    <span style={{
      display: "inline-block", padding: "2px 9px", borderRadius: "999px",
      fontSize: "10px", fontWeight: 600, letterSpacing: "0.05em",
      textTransform: "uppercase", background: p.bg, color: p.color,
      fontFamily: FONT_BODY,
    }}>
      {label}
    </span>
  );
}

const STATUS_COLOR = {
  completed:                   "green",
  in_transit:                  "amber",
  collected:                   "blue",
  awaiting_sales_confirmation: "purple",
  awaiting_return:             "red",
  at_market:                   "green",
  pending:                     "amber",
  open:                        "blue",
  closed:                      "default",
};

function StatusPill({ status }) {
  return <Pill label={status?.replace(/_/g, " ") || "—"} color={STATUS_COLOR[status] || "default"} />;
}

function RolePill({ role }) {
  const map = { admin: "gold", sales: "blue", delivery: "amber", worker: "default" };
  return <Pill label={role || "—"} color={map[role] || "default"} />;
}

function KCard({ label, value, sub, color, icon }) {
  const colorMap = { green: C.green, amber: C.amber, red: C.red, blue: C.blue, gold: C.gold };
  const accent = colorMap[color] || C.cream;
  return (
    <div style={{
      background: C.bgCard, border: `0.5px solid ${C.border}`,
      borderRadius: "12px", padding: "18px 20px",
      display: "flex", flexDirection: "column", gap: "6px",
      position: "relative", overflow: "hidden",
    }}>
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: "2px",
        background: `linear-gradient(90deg, ${accent}55, transparent)`,
      }} />
      {icon && (
        <span style={{ fontSize: "18px", marginBottom: "2px" }}>{icon}</span>
      )}
      <p style={{
        fontSize: "10px", color: C.creamDim, textTransform: "uppercase",
        letterSpacing: "0.08em", margin: 0, fontFamily: FONT_BODY, fontWeight: 500,
      }}>{label}</p>
      <p style={{
        fontSize: "22px", fontWeight: 600, margin: 0,
        color: accent, fontFamily: FONT_MONO,
        lineHeight: 1.1,
      }}>{value}</p>
      {sub && (
        <p style={{ fontSize: "11px", color: C.creamDim, margin: 0, fontFamily: FONT_BODY }}>{sub}</p>
      )}
    </div>
  );
}

function Card({ title, children, action, noPad }) {
  return (
    <div style={{
      background: C.bgCard, border: `0.5px solid ${C.border}`,
      borderRadius: "14px", overflow: "hidden", marginBottom: "16px",
    }}>
      {title && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 20px", borderBottom: `0.5px solid ${C.border}`,
        }}>
          <p style={{
            fontSize: "11px", fontWeight: 600, color: C.gold,
            textTransform: "uppercase", letterSpacing: "0.1em", margin: 0,
            fontFamily: FONT_BODY,
          }}>{title}</p>
          {action}
        </div>
      )}
      <div style={noPad ? {} : { padding: "20px" }}>
        {children}
      </div>
    </div>
  );
}

/* Shared table styles */
const TH = {
  padding: "10px 16px", textAlign: "left", fontSize: "10px", fontWeight: 600,
  color: C.creamDim, textTransform: "uppercase", letterSpacing: "0.08em",
  borderBottom: `0.5px solid ${C.border}`, background: "#13120F",
  fontFamily: FONT_BODY, whiteSpace: "nowrap",
};
const TD = {
  padding: "11px 16px", borderBottom: `0.5px solid ${C.borderSub}`,
  fontSize: "13px", color: C.cream, fontFamily: FONT_BODY, verticalAlign: "middle",
};
const TDMono = { ...TD, fontFamily: FONT_MONO, fontSize: "12px" };

function Tbl({ cols, rows, emptyMsg = "No data" }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>{cols.map((c, i) => <th key={i} style={TH}>{c}</th>)}</tr>
        </thead>
        <tbody>
          {rows.length === 0
            ? <tr><td colSpan={cols.length} style={{ ...TD, textAlign: "center", color: C.creamDim, padding: "32px" }}>{emptyMsg}</td></tr>
            : rows}
        </tbody>
      </table>
    </div>
  );
}

function Input({ placeholder, value, onChange, type = "text", style = {} }) {
  return (
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      style={{
        background: "#0F0E0C", border: `1px solid ${C.border}`,
        borderRadius: "8px", padding: "9px 13px",
        fontSize: "13px", color: C.cream, fontFamily: FONT_BODY,
        outline: "none", width: "100%", boxSizing: "border-box",
        ...style,
      }}
    />
  );
}

function Btn({ children, onClick, variant = "primary", disabled, style = {} }) {
  const variants = {
    primary: { background: C.gold, color: "#0F0E0C" },
    secondary: { background: C.bgHover, color: C.cream, border: `1px solid ${C.border}` },
    danger: { background: "#321818", color: C.red, border: `1px solid #4A2020` },
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        ...variants[variant],
        padding: "9px 16px", borderRadius: "8px", border: "none",
        fontSize: "13px", fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer",
        fontFamily: FONT_BODY, opacity: disabled ? 0.5 : 1,
        transition: "opacity 0.15s",
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

/* Recharts shared theme */
const chartTheme = {
  cartesianGrid: { strokeDasharray: "3 3", stroke: C.border },
  xAxis: { tick: { fontSize: 10, fill: C.creamDim, fontFamily: FONT_BODY }, axisLine: false, tickLine: false },
  yAxis: { tick: { fontSize: 10, fill: C.creamDim, fontFamily: FONT_BODY }, axisLine: false, tickLine: false },
  tooltip: {
    contentStyle: { background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 8, fontFamily: FONT_BODY, fontSize: 12, color: C.cream },
    cursor: { fill: "rgba(212,168,67,0.05)" },
  },
};

const PIE_COLORS = [C.gold, C.green, C.blue, C.amber, C.purple, C.red];

/* ══════════════════════════════════════════════════════════
   TABS CONFIG
══════════════════════════════════════════════════════════ */
const TABS = [
  { id: "overview",   label: "Overview",   icon: "◈" },
  { id: "sales",      label: "Sales",      icon: "◎" },
  { id: "stock",      label: "Stock",      icon: "▣" },
  { id: "production", label: "Production", icon: "⬡" },
  { id: "deliveries", label: "Deliveries", icon: "◁" },
  { id: "staff",      label: "Staff",      icon: "◉" },
  { id: "payments",   label: "Payments",   icon: "⬟" },
];

/* ══════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════ */
function fmtKES(n) { return `KES ${Number(n || 0).toLocaleString()}`; }
function fmtTime(ts) {
  if (!ts) return "—";
  return new Date(ts).toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" });
}
function fmtDate(ts) {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString("en-KE", { day: "2-digit", month: "short" });
}
function fmtDur(mins) {
  if (mins == null) return "—";
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}
function isToday(ts) {
  return new Date(ts).toDateString() === new Date().toDateString();
}

/* ══════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════ */
export default function Admin() {
  const [tab, setTab]       = useState("overview");
  const [loading, setLoading] = useState(false);

  /* Data state */
  const [sales, setSales]           = useState([]);
  const [payments, setPayments]     = useState([]);
  const [inventory, setInventory]   = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [staff, setStaff]           = useState([]);
  const [production, setProduction] = useState([]);
  const [exchanges, setExchanges]   = useState([]);
  const [orders, setOrders]         = useState([]);
  const [flour, setFlour]           = useState({ currentSacks: 0, usedToday: 0, history: [] });

  /* Add flour form */
  const [flourInput, setFlourInput] = useState("");
  const [flourNote, setFlourNote]   = useState("");

  /* Payment form */
  const [paySearch, setPaySearch]     = useState("");
  const [payResults, setPayResults]   = useState([]);
  const [payCustomer, setPayCustomer] = useState(null);
  const [payAmount, setPayAmount]     = useState("");
  const [payRef, setPayRef]           = useState("");

  /* ── Load data ── */
  const loadData = useCallback(async () => {
    const [s, inv, del, st, prod, fl, ex, ord] = await Promise.all([
      getSalesData(), getInventoryData(), getDeliveryData(),
      getStaffData(), getProductionData(), getFlourData(),
      getExchangesData(), getOrdersData(),
    ]);
    setSales(s.sales);
    setPayments(s.payments);
    setInventory(inv);
    setDeliveries(del);
    setStaff(st);
    setProduction(prod);
    setFlour(fl);
    setExchanges(ex);
    setOrders(ord);
  }, []);

  useEffect(() => {
    loadData();
    const tables = ["sales", "payments", "inventory", "deliveries", "staff_sessions", "production_logs", "flour_stock", "exchanges", "orders"];
    const channel = supabase.channel("admin-live");
    tables.forEach(t => channel.on("postgres_changes", { event: "*", schema: "public", table: t }, loadData));
    channel.subscribe();
    return () => supabase.removeChannel(channel);
  }, [loadData]);

  /* ═══════════════════════════════════
     DERIVED DATA
  ═══════════════════════════════════ */

  /* Sales */
  const todaySales      = sales.filter(s => isToday(s.created_at));
  const revenueToday    = todaySales.reduce((s, r) => s + Number(r.total_amount), 0);
  const revenueAllTime  = sales.reduce((s, r) => s + Number(r.total_amount), 0);
  const retailToday     = todaySales.filter(s => s.sale_type === "retail").reduce((s, r) => s + Number(r.total_amount), 0);
  const wholesaleToday  = todaySales.filter(s => s.sale_type === "wholesale").reduce((s, r) => s + Number(r.total_amount), 0);

  const salesPerHour = Array.from({ length: 15 }, (_, i) => {
    const h = i + 6;
    return {
      hour: `${h}:00`,
      revenue: todaySales.filter(s => new Date(s.created_at).getHours() === h).reduce((s, r) => s + Number(r.total_amount), 0),
      count: todaySales.filter(s => new Date(s.created_at).getHours() === h).length,
    };
  });

  const productMix = Object.values(
    todaySales.reduce((acc, s) => {
      const name = s.products?.name || "Unknown";
      if (!acc[name]) acc[name] = { name, value: 0, revenue: 0 };
      acc[name].value += s.quantity;
      acc[name].revenue += Number(s.total_amount);
      return acc;
    }, {})
  );

  /* Inventory grouped by product */
  const invGrouped = {};
  inventory.forEach(i => {
    const name = i.products?.name || "Unknown";
    if (!invGrouped[name]) invGrouped[name] = {
      store: 0, market: 0, transit: 0,
      price: i.products?.retail_price || 0,
      wprice: i.products?.wholesale_price || 0,
      cakesPerCrate: i.products?.cakes_per_crate || 0,
    };
    const loc = i.inventory_locations?.name;
    if (loc === "store")   invGrouped[name].store   += i.quantity_crates || 0;
    if (loc === "market")  invGrouped[name].market  += i.quantity_crates || 0;
    if (loc === "transit") invGrouped[name].transit += i.quantity_crates || 0;
  });

  /* Sales & production by product */
  const soldByProduct     = {};
  const revByProduct      = {};
  const producedByProduct = {};

  sales.forEach(s => {
    const name = s.products?.name;
    if (!name) return;
    soldByProduct[name]  = (soldByProduct[name]  || 0) + s.quantity;
    revByProduct[name]   = (revByProduct[name]   || 0) + Number(s.total_amount);
  });
  production.forEach(p => {
    const name = p.products?.name;
    if (!name) return;
    producedByProduct[name] = (producedByProduct[name] || 0) + (p.cakes_produced || 0);
  });

  const totalMarketValue = Object.entries(invGrouped).reduce(
    (s, [name, d]) => s + d.market * d.price, 0
  );

  /* Flour */
  const MIXES_PER_SACK = 6;
  const mixesLeft      = flour.currentSacks * MIXES_PER_SACK;
  const daysLeft       = flour.usedToday > 0
    ? (flour.currentSacks / (flour.usedToday / MIXES_PER_SACK)).toFixed(1)
    : "—";
  const flourLow = flour.currentSacks <= 5;

  /* Shifts */
  const shiftStats = {
    Day:   { mixes: 0, cakes: 0, crates: 0, flour: 0, byProduct: {} },
    Night: { mixes: 0, cakes: 0, crates: 0, flour: 0, byProduct: {} },
  };
  production.forEach(p => {
    const shift = (p.shift || "").toLowerCase() === "night" ? "Night" : "Day";
    const name  = p.products?.name || "Unknown";
    shiftStats[shift].mixes  += p.mixes_made     || 0;
    shiftStats[shift].cakes  += p.cakes_produced  || 0;
    shiftStats[shift].crates += p.crates_produced || 0;
    shiftStats[shift].flour  += Number(p.flour_used || 0);
    if (!shiftStats[shift].byProduct[name]) shiftStats[shift].byProduct[name] = { mixes: 0, cakes: 0 };
    shiftStats[shift].byProduct[name].mixes += p.mixes_made    || 0;
    shiftStats[shift].byProduct[name].cakes += p.cakes_produced || 0;
  });
  const allProdProducts = [...new Set([...Object.keys(shiftStats.Day.byProduct), ...Object.keys(shiftStats.Night.byProduct)])];

  /* Deliveries */
  const inTransit      = deliveries.filter(d => d.status === "in_transit").length;
  const totalCratesOut = deliveries.reduce((s, d) => {
    return s + (d.delivery_items || []).reduce((a, i) => a + (i.crates_sent || 0), 0);
  }, 0);
  const totalBroken    = deliveries.reduce((s, d) => s + (d.broken_cakes || 0), 0);
  const totalReturned  = deliveries.reduce((s, d) => s + Number(d.crates_returned || 0), 0);

  /* Staff */
  const activeStaff = staff.filter(s => !s.logout_time).length;

  /* Payments */
  const todayPayments  = payments.filter(p => isToday(p.created_at));
  const totalPaidToday = todayPayments.reduce((s, p) => s + Number(p.amount), 0);

  /* Outstanding (all sales - all payments) */
  const totalBilled = sales.reduce((s, r) => s + Number(r.total_amount), 0);
  const totalPaid   = payments.reduce((s, p) => s + Number(p.amount), 0);
  const outstanding = totalBilled - totalPaid;

  /* ═══════════════════════════════════
     ACTIONS
  ═══════════════════════════════════ */
  async function handleAddFlour(e) {
    e.preventDefault();
    if (!flourInput || Number(flourInput) <= 0) return alert("Enter a valid number of sacks.");
    setLoading(true);
    try {
      await addFlourStock(flourInput, flourNote);
      setFlourInput(""); setFlourNote("");
      loadData();
    } catch (err) { alert("Error: " + err.message); }
    finally { setLoading(false); }
  }

  async function handlePaySearch() {
    if (!paySearch.trim()) return;
    setPayResults(await searchCustomers(paySearch.trim()));
  }

  async function handleAddPayment(e) {
    e.preventDefault();
    if (!payCustomer) return alert("Select a customer first.");
    if (!payAmount || Number(payAmount) <= 0) return alert("Enter a valid amount.");
    setLoading(true);
    try {
      await addPayment({ customer_id: payCustomer.id, amount: payAmount, reference: payRef, phone: payCustomer.phone });
      alert("Payment recorded ✅");
      setPayCustomer(null); setPayAmount(""); setPayRef("");
      setPaySearch(""); setPayResults([]);
      loadData();
    } catch (err) { alert("Error: " + err.message); }
    finally { setLoading(false); }
  }

  /* ═══════════════════════════════════
     LAYOUT
  ═══════════════════════════════════ */
  const grid4 = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "12px", marginBottom: "20px" };
  const grid2 = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" };
  const grid3 = { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px", marginBottom: "16px" };

  /* ═══════════════════════════════════
     RENDER
  ═══════════════════════════════════ */
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600&family=DM+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; }
        body { background: ${C.bg}; color: ${C.cream}; margin: 0; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 4px; }
        input::placeholder { color: ${C.creamDim}; opacity: 0.6; }
        input:focus { outline: none; border-color: ${C.gold} !important; }
        tr:hover td { background: ${C.bgHover}; }
      `}</style>

      {/* ── NAV ── */}
      <div style={{
        position: "sticky", top: 0, zIndex: 50,
        background: `${C.bg}EE`, backdropFilter: "blur(12px)",
        borderBottom: `0.5px solid ${C.border}`,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 28px", height: "56px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "20px" }}>🥐</span>
          <span style={{ fontFamily: FONT_DISPLAY, fontSize: "18px", fontWeight: 600, color: C.gold }}>
            Bakery
          </span>
          <span style={{ fontFamily: FONT_BODY, fontSize: "11px", color: C.creamDim, marginLeft: "4px", textTransform: "uppercase", letterSpacing: "0.12em" }}>
            Admin
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <span style={{ fontSize: "11px", color: C.creamDim, fontFamily: FONT_BODY }}>
            {new Date().toLocaleDateString("en-KE", { weekday: "short", day: "numeric", month: "short" })}
          </span>
          <LogoutButton />
        </div>
      </div>

      {/* ── TABS ── */}
      <div style={{
        display: "flex", gap: "2px", padding: "0 28px",
        borderBottom: `0.5px solid ${C.border}`,
        background: C.bg, overflowX: "auto",
      }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: "14px 18px", border: "none", background: "transparent",
              cursor: "pointer", fontFamily: FONT_BODY, fontSize: "12px", fontWeight: 500,
              color: tab === t.id ? C.gold : C.creamDim,
              borderBottom: tab === t.id ? `2px solid ${C.gold}` : "2px solid transparent",
              marginBottom: "-1px", whiteSpace: "nowrap",
              display: "flex", alignItems: "center", gap: "6px",
              transition: "color 0.15s",
            }}
          >
            <span style={{ fontSize: "10px" }}>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── CONTENT ── */}
      <div style={{ padding: "24px 28px", maxWidth: "1400px", margin: "0 auto" }}>

        {/* ══════════════════════════════════
            OVERVIEW TAB
        ══════════════════════════════════ */}
        {tab === "overview" && (
          <>
            <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: "24px", color: C.cream, margin: "0 0 20px", fontWeight: 500 }}>
              Today's Overview
            </h2>

            <div style={grid4}>
              <KCard label="Revenue today"   value={fmtKES(revenueToday)}   color="green" icon="💰" />
              <KCard label="Transactions"    value={todaySales.length}       color="blue"  icon="🛒" sub={`${wholesaleToday > 0 ? fmtKES(wholesaleToday) + " wholesale" : ""}`} />
              <KCard label="Outstanding"     value={fmtKES(outstanding)}     color={outstanding > 0 ? "amber" : "green"} icon="📋" />
              <KCard label="Active staff"    value={activeStaff}             color="green" icon="👥" sub={`${staff.length} total today`} />
              <KCard label="Flour sacks"     value={flour.currentSacks}      color={flourLow ? "red" : undefined} icon="🌾" sub={`~${daysLeft} days left`} />
              <KCard label="In transit"      value={inTransit}               color={inTransit > 0 ? "amber" : undefined} icon="🚗" />
              <KCard label="Market value"    value={fmtKES(totalMarketValue)} color="gold" icon="📦" />
              <KCard label="Payments today"  value={fmtKES(totalPaidToday)}  color="green" icon="📲" />
            </div>

            {flourLow && (
              <div style={{
                background: "#1E0F0F", border: `1px solid ${C.red}44`,
                borderRadius: "10px", padding: "14px 18px", marginBottom: "16px",
                display: "flex", alignItems: "center", gap: "12px",
                fontSize: "13px", color: C.red, fontFamily: FONT_BODY,
              }}>
                <span style={{ fontSize: "20px" }}>⚠️</span>
                <div>
                  <strong>Low flour stock</strong> — {flour.currentSacks} sacks remaining (~{mixesLeft} mixes).
                  Estimated <strong>{daysLeft} day(s)</strong> at current usage rate.
                </div>
              </div>
            )}

            <div style={grid2}>
              <Card title="Sales revenue today — by hour">
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={salesPerHour}>
                    <defs>
                      <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={C.gold} stopOpacity={0.3} />
                        <stop offset="100%" stopColor={C.gold} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid {...chartTheme.cartesianGrid} />
                    <XAxis dataKey="hour" {...chartTheme.xAxis} />
                    <YAxis {...chartTheme.yAxis} tickFormatter={v => `K${(v / 1000).toFixed(0)}`} />
                    <Tooltip {...chartTheme.tooltip} formatter={v => [fmtKES(v), "Revenue"]} />
                    <Area type="monotone" dataKey="revenue" stroke={C.gold} fill="url(#revGrad)" strokeWidth={2} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </Card>

              <Card title="Product mix today">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={productMix} dataKey="value" nameKey="name" innerRadius={55} outerRadius={80} paddingAngle={3}>
                      {productMix.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Legend iconType="square" iconSize={8} wrapperStyle={{ fontSize: "11px", fontFamily: FONT_BODY, color: C.creamDim }} />
                    <Tooltip contentStyle={chartTheme.tooltip.contentStyle} />
                  </PieChart>
                </ResponsiveContainer>
              </Card>
            </div>

            {/* Shift summary */}
            <div style={grid2}>
              {["Day", "Night"].map(sh => (
                <Card key={sh} title={`${sh} shift summary`}>
                  {[
                    ["Mixes done",    shiftStats[sh].mixes,                       FONT_MONO],
                    ["Cakes produced",shiftStats[sh].cakes,                       FONT_MONO],
                    ["Crates packed", shiftStats[sh].crates,                      FONT_MONO],
                    ["Flour used",    `${shiftStats[sh].flour.toFixed(1)} sacks`, FONT_MONO],
                  ].map(([label, val, font]) => (
                    <div key={label} style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "9px 0", borderBottom: `0.5px solid ${C.borderSub}`,
                      fontSize: "13px",
                    }}>
                      <span style={{ color: C.creamDim, fontFamily: FONT_BODY }}>{label}</span>
                      <span style={{ fontFamily: font, fontWeight: 500, color: C.cream }}>{val}</span>
                    </div>
                  ))}
                </Card>
              ))}
            </div>
          </>
        )}

        {/* ══════════════════════════════════
            SALES TAB
        ══════════════════════════════════ */}
        {tab === "sales" && (
          <>
            <div style={grid4}>
              <KCard label="Revenue today"   value={fmtKES(revenueToday)}   color="green" />
              <KCard label="All-time revenue" value={fmtKES(revenueAllTime)} />
              <KCard label="Retail today"    value={fmtKES(retailToday)}    color="blue" />
              <KCard label="Wholesale today" value={fmtKES(wholesaleToday)} color="amber" />
              <KCard label="Transactions today" value={todaySales.length}   color="green" />
              <KCard label="Total exchanges"    value={exchanges.length}     color="amber" />
            </div>

            <div style={grid2}>
              <Card title="Hourly revenue">
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={salesPerHour}>
                    <defs>
                      <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={C.green} stopOpacity={0.3} />
                        <stop offset="100%" stopColor={C.green} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid {...chartTheme.cartesianGrid} />
                    <XAxis dataKey="hour" {...chartTheme.xAxis} />
                    <YAxis {...chartTheme.yAxis} tickFormatter={v => `K${(v / 1000).toFixed(0)}`} />
                    <Tooltip {...chartTheme.tooltip} formatter={v => [fmtKES(v), "Revenue"]} />
                    <Area type="monotone" dataKey="revenue" stroke={C.green} fill="url(#sg)" strokeWidth={2} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </Card>

              <Card title="Transactions per hour">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={salesPerHour}>
                    <CartesianGrid {...chartTheme.cartesianGrid} />
                    <XAxis dataKey="hour" {...chartTheme.xAxis} />
                    <YAxis {...chartTheme.yAxis} />
                    <Tooltip {...chartTheme.tooltip} formatter={v => [v, "Sales"]} />
                    <Bar dataKey="count" fill={C.blue} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </div>

            <Card title="Sales feed" noPad>
              <Tbl
                cols={["Customer", "Product", "Qty", "Amount", "Type", "Via", "Order", "Time"]}
                rows={sales.slice(0, 60).map(s => (
                  <tr key={s.id}>
                    <td style={TD}>{s.customers?.name || "Walk-in"}</td>
                    <td style={TD}>{s.products?.name || "—"}</td>
                    <td style={TDMono}>{s.quantity}</td>
                    <td style={{ ...TDMono, color: C.green, fontWeight: 600 }}>{fmtKES(s.total_amount)}</td>
                    <td style={TD}><Pill label={s.sale_type || "—"} color={s.sale_type === "retail" ? "blue" : "green"} /></td>
                    <td style={TD}>{s.users?.name || "—"}</td>
                    <td style={TD}>{s.order_id ? <Pill label="linked" color="purple" /> : <span style={{ color: C.creamDim }}>—</span>}</td>
                    <td style={{ ...TD, color: C.creamDim, fontFamily: FONT_MONO, fontSize: "11px" }}>
                      {isToday(s.created_at) ? fmtTime(s.created_at) : fmtDate(s.created_at)}
                    </td>
                  </tr>
                ))}
                emptyMsg="No sales yet"
              />
            </Card>

            {/* Exchanges */}
            {exchanges.length > 0 && (
              <Card title="Exchanges / Returns" noPad>
                <Tbl
                  cols={["Customer", "Product", "Qty", "Reason", "Via", "Date"]}
                  rows={exchanges.slice(0, 30).map(e => (
                    <tr key={e.id}>
                      <td style={TD}>{e.customers?.name || "—"}</td>
                      <td style={TD}>{e.products?.name || "—"}</td>
                      <td style={TDMono}>{e.quantity}</td>
                      <td style={{ ...TD, color: C.creamDim }}>{e.reason || "—"}</td>
                      <td style={TD}>{e.users?.name || "—"}</td>
                      <td style={{ ...TD, color: C.creamDim }}>{fmtDate(e.created_at)}</td>
                    </tr>
                  ))}
                  emptyMsg="No exchanges"
                />
              </Card>
            )}
          </>
        )}

        {/* ══════════════════════════════════
            STOCK TAB
        ══════════════════════════════════ */}
        {tab === "stock" && (
          <>
            {flourLow && (
              <div style={{
                background: "#1E0F0F", border: `1px solid ${C.red}55`,
                borderRadius: "10px", padding: "14px 18px", marginBottom: "16px",
                fontSize: "13px", color: C.red, fontFamily: FONT_BODY, display: "flex", gap: "10px", alignItems: "center",
              }}>
                <span>⚠️</span>
                <span>Low flour stock — <strong>{flour.currentSacks} sacks</strong> remaining (~{mixesLeft} mixes, ~{daysLeft} days).</span>
              </div>
            )}

            <div style={grid4}>
              <KCard label="Flour sacks"        value={flour.currentSacks}           color={flourLow ? "red" : undefined} icon="🌾" />
              <KCard label="Mixes available"     value={mixesLeft}                    color={flourLow ? "amber" : undefined} />
              <KCard label="Days remaining"      value={daysLeft}                     color={flourLow ? "amber" : undefined} />
              <KCard label="Used today (sacks)"  value={flour.usedToday.toFixed(2)} />
              <KCard label="Market stock value"  value={fmtKES(totalMarketValue)}     color="gold" />
            </div>

            <Card title="Inventory by product" noPad>
              <Tbl
                cols={["Product", "Store", "Market", "Transit", "Produced", "Sold", "Market Value", "Revenue"]}
                rows={Object.entries(invGrouped).map(([name, d]) => {
                  const sold    = soldByProduct[name] || 0;
                  const revenue = revByProduct[name] || 0;
                  const value   = d.market * d.price;
                  const mktColor = d.market < 5 ? "red" : d.market < 15 ? "amber" : "green";
                  return (
                    <tr key={name}>
                      <td style={{ ...TD, fontWeight: 600 }}>{name}</td>
                      <td style={TDMono}>{d.store}</td>
                      <td style={TD}><Pill label={String(d.market)} color={mktColor} /></td>
                      <td style={TDMono}>{d.transit}</td>
                      <td style={TDMono}>{producedByProduct[name] || 0}</td>
                      <td style={TDMono}>{sold}</td>
                      <td style={{ ...TDMono, color: C.blue }}>{fmtKES(value)}</td>
                      <td style={{ ...TDMono, color: C.green }}>{fmtKES(revenue)}</td>
                    </tr>
                  );
                })}
                emptyMsg="No inventory data"
              />
            </Card>

            <Card title="Add flour stock">
              <form onSubmit={handleAddFlour} style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "flex-end" }}>
                <div style={{ flex: "0 0 160px" }}>
                  <p style={{ fontSize: "11px", color: C.creamDim, margin: "0 0 6px", fontFamily: FONT_BODY }}>Sacks received</p>
                  <Input type="number" placeholder="e.g. 10" value={flourInput} onChange={e => setFlourInput(e.target.value)} />
                </div>
                <div style={{ flex: 1, minWidth: "200px" }}>
                  <p style={{ fontSize: "11px", color: C.creamDim, margin: "0 0 6px", fontFamily: FONT_BODY }}>Note (optional)</p>
                  <Input placeholder="e.g. Morning delivery" value={flourNote} onChange={e => setFlourNote(e.target.value)} />
                </div>
                <Btn disabled={loading}>{loading ? "Saving…" : "Add Sacks"}</Btn>
              </form>

              {flour.history.length > 0 && (
                <div style={{ marginTop: "20px" }}>
                  <p style={{ fontSize: "11px", color: C.creamDim, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "10px", fontFamily: FONT_BODY }}>
                    Recent flour deliveries
                  </p>
                  {flour.history.slice(0, 5).map((h, i) => (
                    <div key={i} style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "8px 0", borderBottom: `0.5px solid ${C.borderSub}`, fontSize: "13px",
                    }}>
                      <span style={{ fontFamily: FONT_MONO, color: C.gold }}>{h.quantity_sacks} sacks</span>
                      <span style={{ color: C.creamDim, fontFamily: FONT_BODY }}>{h.note || "—"}</span>
                      <span style={{ color: C.creamDim, fontFamily: FONT_MONO, fontSize: "11px" }}>{fmtDate(h.created_at)}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </>
        )}

        {/* ══════════════════════════════════
            PRODUCTION TAB
        ══════════════════════════════════ */}
        {tab === "production" && (
          <>
            <div style={grid4}>
              <KCard label="Total cakes produced" value={Object.values(producedByProduct).reduce((s, v) => s + v, 0)} color="green" />
              <KCard label="Day shift mixes"       value={shiftStats.Day.mixes}   color="blue" />
              <KCard label="Night shift mixes"     value={shiftStats.Night.mixes} color="purple" />
              <KCard label="Flour used (all)"      value={`${(shiftStats.Day.flour + shiftStats.Night.flour).toFixed(1)} sacks`} />
            </div>

            <div style={grid2}>
              {["Day", "Night"].map(sh => (
                <Card key={sh} title={`${sh} shift`}>
                  {[
                    ["Mixes",        shiftStats[sh].mixes],
                    ["Cakes",        shiftStats[sh].cakes],
                    ["Crates",       shiftStats[sh].crates],
                    ["Flour used",   `${shiftStats[sh].flour.toFixed(1)} sacks`],
                  ].map(([label, val]) => (
                    <div key={label} style={{
                      display: "flex", justifyContent: "space-between",
                      padding: "9px 0", borderBottom: `0.5px solid ${C.borderSub}`, fontSize: "13px",
                    }}>
                      <span style={{ color: C.creamDim, fontFamily: FONT_BODY }}>{label}</span>
                      <span style={{ fontFamily: FONT_MONO }}>{val}</span>
                    </div>
                  ))}
                </Card>
              ))}
            </div>

            <Card title="Per-product breakdown" noPad>
              <Tbl
                cols={["Product", "Day Mixes", "Day Cakes", "Night Mixes", "Night Cakes", "Total Cakes"]}
                rows={allProdProducts.map(name => (
                  <tr key={name}>
                    <td style={{ ...TD, fontWeight: 600 }}>{name}</td>
                    <td style={TDMono}>{shiftStats.Day.byProduct[name]?.mixes  || 0}</td>
                    <td style={TDMono}>{shiftStats.Day.byProduct[name]?.cakes  || 0}</td>
                    <td style={TDMono}>{shiftStats.Night.byProduct[name]?.mixes || 0}</td>
                    <td style={TDMono}>{shiftStats.Night.byProduct[name]?.cakes || 0}</td>
                    <td style={{ ...TDMono, color: C.green, fontWeight: 600 }}>
                      {(shiftStats.Day.byProduct[name]?.cakes || 0) + (shiftStats.Night.byProduct[name]?.cakes || 0)}
                    </td>
                  </tr>
                ))}
                emptyMsg="No production data"
              />
            </Card>

            <Card title="Production log" noPad>
              <Tbl
                cols={["Product", "Worker", "Shift", "Mixes", "Cakes", "Crates", "Flour (sacks)", "Remainder", "Note", "Time"]}
                rows={production.slice(0, 50).map(p => (
                  <tr key={p.id}>
                    <td style={{ ...TD, fontWeight: 600 }}>{p.products?.name || "—"}</td>
                    <td style={TD}>{p.users?.name || "—"}</td>
                    <td style={TD}><Pill label={p.shift || "day"} color={p.shift === "night" ? "purple" : "blue"} /></td>
                    <td style={TDMono}>{p.mixes_made}</td>
                    <td style={TDMono}>{p.cakes_produced}</td>
                    <td style={TDMono}>{p.crates_produced}</td>
                    <td style={TDMono}>{p.flour_used ?? "—"}</td>
                    <td style={TDMono}>{p.remainder_cakes ?? "—"}</td>
                    <td style={{ ...TD, color: C.creamDim, maxWidth: "140px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.note || "—"}</td>
                    <td style={{ ...TD, color: C.creamDim, fontFamily: FONT_MONO, fontSize: "11px" }}>
                      {isToday(p.created_at) ? fmtTime(p.created_at) : fmtDate(p.created_at)}
                    </td>
                  </tr>
                ))}
                emptyMsg="No production logs"
              />
            </Card>
          </>
        )}

        {/* ══════════════════════════════════
            DELIVERIES TAB
        ══════════════════════════════════ */}
        {tab === "deliveries" && (
          <>
            <div style={grid4}>
              <KCard label="Total trips"    value={deliveries.length} />
              <KCard label="In transit"     value={inTransit}          color={inTransit > 0 ? "amber" : undefined} />
              <KCard label="Crates sent"    value={totalCratesOut} />
              <KCard label="Crates back"    value={totalReturned}      color="green" />
              <KCard label="Broken cakes"   value={totalBroken}        color={totalBroken > 0 ? "red" : undefined} />
            </div>

            <Card title="Delivery log" noPad>
              <Tbl
                cols={["Driver", "Status", "Departed", "Arrived", "Duration", "Broken", "Crates returned", "Sales confirmed"]}
                rows={deliveries.map(d => {
                  const dur = d.departed_at && d.arrived_at
                    ? Math.floor((new Date(d.arrived_at) - new Date(d.departed_at)) / 60000)
                    : null;
                  return (
                    <tr key={d.id}>
                      <td style={{ ...TD, fontWeight: 600 }}>{d.users?.name || "—"}</td>
                      <td style={TD}><StatusPill status={d.status} /></td>
                      <td style={{ ...TD, fontFamily: FONT_MONO, fontSize: "11px" }}>{fmtTime(d.departed_at)}</td>
                      <td style={{ ...TD, fontFamily: FONT_MONO, fontSize: "11px" }}>{fmtTime(d.arrived_at)}</td>
                      <td style={TDMono}>{dur != null ? `${dur}m` : "—"}</td>
                      <td style={{ ...TDMono, color: d.broken_cakes > 0 ? C.red : C.creamDim }}>{d.broken_cakes ?? "—"}</td>
                      <td style={TDMono}>{d.crates_returned ?? "—"}</td>
                      <td style={TD}>
                        <Pill label={d.sales_confirmed ? "yes" : "no"} color={d.sales_confirmed ? "green" : "red"} />
                      </td>
                    </tr>
                  );
                })}
                emptyMsg="No deliveries"
              />
            </Card>

            {/* Delivery items detail */}
            {deliveries.some(d => d.delivery_items?.length > 0) && (
              <Card title="Delivery items detail" noPad>
                <Tbl
                  cols={["Driver", "Product", "Sent", "Received", "With Cakes", "Returned", "Broken"]}
                  rows={deliveries.flatMap(d =>
                    (d.delivery_items || []).map(item => (
                      <tr key={item.id}>
                        <td style={TD}>{d.users?.name || "—"}</td>
                        <td style={{ ...TD, fontWeight: 600 }}>{item.products?.name || "—"}</td>
                        <td style={TDMono}>{item.crates_sent}</td>
                        <td style={TDMono}>{item.crates_received}</td>
                        <td style={TDMono}>{item.crates_with_cakes}</td>
                        <td style={TDMono}>{item.crates_returned}</td>
                        <td style={{ ...TDMono, color: item.broken_cakes > 0 ? C.red : C.creamDim }}>{item.broken_cakes}</td>
                      </tr>
                    ))
                  )}
                  emptyMsg="No delivery items"
                />
              </Card>
            )}
          </>
        )}

        {/* ══════════════════════════════════
            STAFF TAB
        ══════════════════════════════════ */}
        {tab === "staff" && (
          <>
            <div style={grid4}>
              <KCard label="Active now"   value={activeStaff}  color="green" icon="🟢" />
              <KCard label="Total today"  value={staff.length} />
              <KCard label="Day shift"    value={staff.filter(s => s.shift === "day").length}   color="blue" />
              <KCard label="Night shift"  value={staff.filter(s => s.shift === "night").length} color="purple" />
            </div>

            <Card title="Staff sessions today" noPad>
              <Tbl
                cols={["Name", "Role", "Shift", "Logged in", "Logged out", "Duration"]}
                rows={staff.map(s => (
                  <tr key={s.id}>
                    <td style={{ ...TD, fontWeight: 600 }}>{s.users?.name || "—"}</td>
                    <td style={TD}><RolePill role={s.users?.role || s.role} /></td>
                    <td style={TD}><Pill label={s.shift} color={s.shift === "night" ? "purple" : "blue"} /></td>
                    <td style={{ ...TD, fontFamily: FONT_MONO, fontSize: "11px" }}>{fmtTime(s.login_time)}</td>
                    <td style={{ ...TD, fontFamily: FONT_MONO, fontSize: "11px" }}>
                      {s.logout_time
                        ? fmtTime(s.logout_time)
                        : <Pill label="Active" color="green" />}
                    </td>
                    <td style={TDMono}>{fmtDur(s.duration_minutes)}</td>
                  </tr>
                ))}
                emptyMsg="No staff sessions today"
              />
            </Card>
          </>
        )}

        {/* ══════════════════════════════════
            PAYMENTS TAB
        ══════════════════════════════════ */}
        {tab === "payments" && (
          <>
            <div style={grid4}>
              <KCard label="Paid today"     value={fmtKES(totalPaidToday)}  color="green" />
              <KCard label="Total received" value={fmtKES(totalPaid)}       color="green" />
              <KCard label="Total billed"   value={fmtKES(totalBilled)} />
              <KCard label="Outstanding"    value={fmtKES(outstanding)}     color={outstanding > 0 ? "amber" : "green"} />
            </div>

            {/* Add payment form */}
            <Card title="Record M-Pesa payment">
              <div style={{ display: "flex", gap: "10px", marginBottom: "12px" }}>
                <div style={{ flex: 1 }}>
                  <Input
                    placeholder="Search customer name…"
                    value={paySearch}
                    onChange={e => setPaySearch(e.target.value)}
                    style={{ marginBottom: 0 }}
                  />
                </div>
                <Btn variant="secondary" onClick={handlePaySearch}>Search</Btn>
              </div>

              {payResults.length > 0 && (
                <div style={{ border: `1px solid ${C.border}`, borderRadius: "8px", overflow: "hidden", marginBottom: "12px" }}>
                  {payResults.map(c => (
                    <div key={c.id} onClick={() => { setPayCustomer(c); setPayResults([]); }}
                      style={{
                        padding: "10px 14px", cursor: "pointer", fontSize: "13px",
                        display: "flex", justifyContent: "space-between",
                        background: payCustomer?.id === c.id ? C.bgHover : "transparent",
                        borderBottom: `0.5px solid ${C.borderSub}`,
                        fontFamily: FONT_BODY, transition: "background 0.1s",
                      }}>
                      <span style={{ fontWeight: 500 }}>{c.name}</span>
                      <span style={{ color: C.creamDim }}>{c.phone || "—"}</span>
                    </div>
                  ))}
                </div>
              )}

              {payCustomer && (
                <div>
                  <div style={{
                    padding: "10px 14px", background: "#1A2A1A", border: `1px solid ${C.green}44`,
                    borderRadius: "8px", marginBottom: "12px", fontSize: "13px",
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                  }}>
                    <span style={{ fontFamily: FONT_BODY }}>
                      Recording for: <strong style={{ color: C.green }}>{payCustomer.name}</strong>
                    </span>
                    <button onClick={() => setPayCustomer(null)} style={{ background: "none", border: "none", color: C.creamDim, cursor: "pointer", fontSize: "16px" }}>×</button>
                  </div>
                  <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                    <div style={{ flex: "0 0 160px" }}>
                      <p style={{ fontSize: "11px", color: C.creamDim, margin: "0 0 6px", fontFamily: FONT_BODY }}>Amount (KES)</p>
                      <Input type="number" placeholder="0" value={payAmount} onChange={e => setPayAmount(e.target.value)} />
                    </div>
                    <div style={{ flex: 1, minWidth: "160px" }}>
                      <p style={{ fontSize: "11px", color: C.creamDim, margin: "0 0 6px", fontFamily: FONT_BODY }}>M-Pesa reference</p>
                      <Input placeholder="QJX8XXXXXXX" value={payRef} onChange={e => setPayRef(e.target.value)} />
                    </div>
                    <div style={{ display: "flex", alignItems: "flex-end" }}>
                      <Btn onClick={handleAddPayment} disabled={loading}>{loading ? "Saving…" : "Record Payment"}</Btn>
                    </div>
                  </div>
                </div>
              )}
            </Card>

            <Card title="Payment history" noPad>
              <Tbl
                cols={["Customer", "Amount", "Reference", "Phone", "Status", "Added by", "Date"]}
                rows={payments.slice(0, 60).map(p => (
                  <tr key={p.id}>
                    <td style={{ ...TD, fontWeight: 600 }}>{p.customers?.name || "—"}</td>
                    <td style={{ ...TDMono, color: C.green, fontWeight: 600 }}>{fmtKES(p.amount)}</td>
                    <td style={{ ...TD, fontFamily: FONT_MONO, fontSize: "11px", color: C.creamDim }}>{p.reference || p.mpesa_receipt || "—"}</td>
                    <td style={{ ...TD, color: C.creamDim }}>{p.phone || "—"}</td>
                    <td style={TD}><StatusPill status={p.status} /></td>
                    <td style={TD}>{p.users?.name || "—"}</td>
                    <td style={{ ...TD, color: C.creamDim, fontFamily: FONT_MONO, fontSize: "11px" }}>
                      {isToday(p.created_at) ? fmtTime(p.created_at) : fmtDate(p.created_at)}
                    </td>
                  </tr>
                ))}
                emptyMsg="No payments yet"
              />
            </Card>
          </>
        )}

      </div>
    </>
  );
}