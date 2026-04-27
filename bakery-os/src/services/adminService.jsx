import { supabase } from "../supabaseClient";

/* ─────────────────────────────────────────
   SALES + PAYMENTS
───────────────────────────────────────── */
export async function getSalesData() {
  const { data: sales } = await supabase
    .from("sales")
    .select("*, customers(name, phone), products(name, retail_price, wholesale_price), users(name, role)")
    .order("created_at", { ascending: false });

  const { data: payments } = await supabase
    .from("payments")
    .select("*, customers(name, phone), users(name)")
    .order("created_at", { ascending: false });

  return { sales: sales || [], payments: payments || [] };
}

/* ─────────────────────────────────────────
   ORDERS
───────────────────────────────────────── */
export async function getOrdersData() {
  const { data } = await supabase
    .from("orders")
    .select("*, customers(name, phone), users(name, role)")
    .order("created_at", { ascending: false });

  return data || [];
}

/* ─────────────────────────────────────────
   INVENTORY
   Uses location_id → inventory_locations(name)
───────────────────────────────────────── */
export async function getInventoryData() {
  const { data } = await supabase
    .from("inventory")
    .select("*, products(name, retail_price, wholesale_price, cakes_per_crate), inventory_locations(name)");

  return data || [];
}

/* ─────────────────────────────────────────
   DELIVERIES
   Uses delivery_user_id → users(name)
   delivery_items joined to products
───────────────────────────────────────── */
export async function getDeliveryData() {
  const { data } = await supabase
    .from("deliveries")
    .select(`
      *,
      users!deliveries_delivery_user_id_fkey(name, role),
      delivery_items(
        *,
        products(name, cakes_per_crate, retail_price)
      )
    `)
    .order("created_at", { ascending: false });

  return data || [];
}

/* ─────────────────────────────────────────
   STAFF SESSIONS
───────────────────────────────────────── */
export async function getStaffData() {
  const { data } = await supabase
    .from("staff_sessions")
    .select("*, users(name, role, shift)")
    .order("login_time", { ascending: false });

  return data || [];
}

/* ─────────────────────────────────────────
   PRODUCTION LOGS
───────────────────────────────────────── */
export async function getProductionData() {
  const { data } = await supabase
    .from("production_logs")
    .select("*, products(name, sacks_per_mix, cakes_per_crate), users(name, role)")
    .order("created_at", { ascending: false });

  return data || [];
}

/* ─────────────────────────────────────────
   EXCHANGES
───────────────────────────────────────── */
export async function getExchangesData() {
  const { data } = await supabase
    .from("exchanges")
    .select("*, customers(name, phone), products(name), users(name, role)")
    .order("created_at", { ascending: false });

  return data || [];
}

/* ─────────────────────────────────────────
   PRODUCTS
───────────────────────────────────────── */
export async function getProductsData() {
  const { data } = await supabase
    .from("products")
    .select("*")
    .order("name");

  return data || [];
}

/* ─────────────────────────────────────────
   FLOUR STOCK
   flour_stock is an append-only log — sum all rows
   for current stock. usedToday from production_logs.
───────────────────────────────────────── */
export async function getFlourData() {
  // Sum all flour_stock entries = current total
  const { data: stockRows } = await supabase
    .from("flour_stock")
    .select("quantity_sacks, created_at, note, users(name)")
    .order("created_at", { ascending: false });

  const totalSacks = (stockRows || []).reduce(
    (sum, r) => sum + Number(r.quantity_sacks || 0),
    0
  );

  // Flour used today from production_logs
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { data: logs } = await supabase
    .from("production_logs")
    .select("flour_used")
    .gte("created_at", today.toISOString());

  const usedToday = (logs || []).reduce(
    (sum, r) => sum + Number(r.flour_used || 0),
    0
  );

  return {
    currentSacks: totalSacks,
    usedToday,
    history: stockRows || [],
  };
}

/* ─────────────────────────────────────────
   ADD FLOUR STOCK (append a new row)
───────────────────────────────────────── */
export async function addFlourStock(sacks, note = "", addedBy = null) {
  const { error } = await supabase.from("flour_stock").insert([
    {
      quantity_sacks: Number(sacks),
      note: note || null,
      added_by: addedBy,
      created_at: new Date(),
    },
  ]);
  if (error) throw error;
}

/* ─────────────────────────────────────────
   ADD PAYMENT (M-Pesa)
───────────────────────────────────────── */
export async function addPayment({ customer_id, amount, reference, phone = null, added_by = null }) {
  const { error } = await supabase.from("payments").insert([
    {
      customer_id,
      amount: Number(amount),
      reference: reference || null,
      phone: phone || null,
      added_by,
      status: "completed",
      created_at: new Date(),
    },
  ]);
  if (error) throw error;
}

/* ─────────────────────────────────────────
   SEARCH CUSTOMERS
───────────────────────────────────────── */
export async function searchCustomers(name) {
  const { data } = await supabase
    .from("customers")
    .select("id, name, phone")
    .ilike("name", `%${name}%`)
    .limit(8);

  return data || [];
}

/* ─────────────────────────────────────────
   CUSTOMER BALANCE (sales - payments)
───────────────────────────────────────── */
export async function getCustomerBalance(customerId) {
  const { data: salesRows } = await supabase
    .from("sales")
    .select("total_amount")
    .eq("customer_id", customerId);

  const { data: paymentRows } = await supabase
    .from("payments")
    .select("amount")
    .eq("customer_id", customerId);

  const totalSales = (salesRows || []).reduce((s, r) => s + Number(r.total_amount), 0);
  const totalPaid  = (paymentRows || []).reduce((s, r) => s + Number(r.amount), 0);

  return { totalSales, totalPaid, balance: totalSales - totalPaid };
}