import { supabase } from "../supabaseClient";

/* =========================
   SALES SUMMARY
========================= */
export async function getSalesSummary() {
  const today = new Date().toISOString().split("T")[0];

  const { data: sales } = await supabase
    .from("sales")
    .select("*");

  let todayRevenue = 0;
  let totalRevenue = 0;
  let retail = 0;
  let wholesale = 0;

  sales?.forEach((s) => {
    totalRevenue += Number(s.total_amount);

    if (s.created_at?.startsWith(today)) {
      todayRevenue += Number(s.total_amount);

      if (s.sale_type === "retail") retail += Number(s.total_amount);
      if (s.sale_type === "wholesale") wholesale += Number(s.total_amount);
    }
  });

  return { todayRevenue, totalRevenue, retail, wholesale };
}

/* =========================
   STOCK OVERVIEW
========================= */
export async function getStockOverview() {
  const { data: inventory } = await supabase
    .from("inventory")
    .select(`
      *,
      products(name),
      inventory_locations(name)
    `);

  return inventory || [];
}

/* =========================
   DELIVERY TRACKING
========================= */
export async function getDeliveries() {
  const { data } = await supabase
    .from("deliveries")
    .select("*")
    .order("departed_at", { ascending: false });

  return data || [];
}

/* =========================
   STAFF ACTIVITY
========================= */
export async function getStaffActivity() {
  const { data } = await supabase
    .from("staff_sessions")
    .select(`
      *,
      users(name)
    `)
    .order("login_time", { ascending: false });

  return data || [];
}

/* =========================
   CRM FEED
========================= */
export async function getSalesFeed() {
  const { data } = await supabase
    .from("sales")
    .select(`
      *,
      customers(name),
      products(name),
      users(name)
    `)
    .order("created_at", { ascending: false });

  return data || [];
}