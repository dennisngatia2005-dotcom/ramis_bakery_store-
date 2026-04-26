import { supabase } from "../supabaseClient";

/* ================= SALES ================= */
export async function getSalesData() {
  const { data: sales } = await supabase
    .from("sales")
    .select(`
      *,
      customers(name),
      products(name),
      users(name)
    `)
    .order("created_at", { ascending: false });

  const { data: payments } = await supabase
    .from("payments")
    .select("*");

  return {
    sales: sales || [],
    payments: payments || []
  };
}

/* ================= INVENTORY ================= */
export async function getInventoryData() {
  const { data } = await supabase
    .from("inventory")
    .select(`
      *,
      products(name, retail_price),
      inventory_locations(name)
    `);

  return data || [];
}

/* ================= DELIVERIES ================= */
export async function getDeliveryData() {
  const { data } = await supabase
    .from("deliveries")
    .select(`*, delivery_items(*, products(name))`)
    .order("created_at", { ascending: false });

  return data || [];
}

/* ================= STAFF ================= */
export async function getStaffData() {
  const { data } = await supabase
    .from("staff_sessions")
    .select(`*, users(name, role, shift)`)
    .order("login_time", { ascending: false });

  return data || [];
}

/* ================= PRODUCTION ================= */
export async function getProductionData() {
  const { data } = await supabase
    .from("production_logs")
    .select(`
      *,
      products(name),
      users(name)
    `)
    .order("created_at", { ascending: false });

  return data || [];
}