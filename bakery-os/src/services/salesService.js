import { supabase } from "../supabaseClient";

/* =========================
   GET ACTIVE DELIVERIES
   Fetches deliveries the sales guy needs to act on:
   - "awaiting_sales_confirmation" → needs to be counted and confirmed
   - "at_market"                   → selling in progress, can prepare return
========================= */
export async function getActiveSalesDeliveries() {
  try {
    const { data, error } = await supabase
      .from("deliveries")
      .select(`
        *,
        delivery_items(*, products(name, cakes_per_crate))
      `)
      .in("status", ["awaiting_sales_confirmation", "at_market"]);

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error("GET SALES DELIVERIES ERROR:", err);
    throw err;
  }
}


/* =========================
   CONFIRM DELIVERY (AUDIT MODE)
   Called by sales when physically counting the crates the driver brought.
   - Validates you cannot receive more than was sent (no magic stock)
   - If discrepancy exists, corrects market inventory downward
   - Records per-item broken cakes and actual crates received
   - Marks delivery as "at_market" so sales can now start selling
========================= */
export async function confirmDelivery({ delivery_id, items, broken_cakes }) {
  try {
    const { data: market, error: mErr } = await supabase
      .from("inventory_locations")
      .select("id")
      .eq("name", "market")
      .single();

    if (mErr || !market) throw new Error("Market location not found.");

    for (const item of items) {
      const { data: original, error: oErr } = await supabase
        .from("delivery_items")
        .select("*, products(cakes_per_crate)")
        .eq("delivery_id", delivery_id)
        .eq("product_id", item.product_id)
        .single();

      if (oErr || !original) throw new Error("Delivery record not found for this product.");

      if (Number(item.crates_received) > Number(original.crates_sent)) {
        throw new Error(
          `Validation Error: Cannot receive ${item.crates_received} crates — only ${original.crates_sent} were sent.`
        );
      }

      const multiplier = original.products.cakes_per_crate || 0;
      const discrepancy = Number(original.crates_sent) - Number(item.crates_received);

      if (discrepancy > 0) {
        const { data: marketInv } = await supabase
          .from("inventory")
          .select("*")
          .eq("product_id", item.product_id)
          .eq("location_id", market.id)
          .single();

        await supabase.from("inventory").update({
          quantity_crates: (marketInv.quantity_crates || 0) - discrepancy,
          quantity_cakes: (marketInv.quantity_cakes || 0) - (discrepancy * multiplier),
          updated_at: new Date(),
        }).eq("id", marketInv.id);
      }

      await supabase.from("delivery_items").update({
        crates_received: Number(item.crates_received),
        broken_cakes: Number(item.item_broken_cakes || 0),
      }).eq("id", original.id);
    }

    const { error: finalErr } = await supabase.from("deliveries").update({
      broken_cakes: Number(broken_cakes),
      sales_confirmed: true,
      status: "at_market",
    }).eq("id", delivery_id);

    if (finalErr) throw finalErr;
    return { success: true };

  } catch (err) {
    console.error("CONFIRM DELIVERY ERROR:", err.message);
    throw err;
  }
}


/* =========================
   PREPARE RETURN
   Sales logs how many empty crates they are handing back to the driver
   and how many crates still have unsold cakes (stay at market overnight).
========================= */
export async function prepareReturn({ delivery_id, empty_crates, crates_with_cakes }) {
  const { error } = await supabase.from("deliveries").update({
    crates_returned: empty_crates,
    return_crates_with_cakes: crates_with_cakes,
    status: "awaiting_return",
  }).eq("id", delivery_id);

  if (error) throw error;
}


/* =========================
   TODAY'S PRODUCTION — per product
   Returns a map keyed by product_id → total cakes produced today.
   Used by the stock screen "Produced Today" column.
========================= */
export async function getTodayProduction() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from("production_logs")
    .select("product_id, cakes_produced")
    .gte("created_at", today.toISOString());

  if (error) throw error;

  const map = {};
  for (const row of data || []) {
    map[row.product_id] = (map[row.product_id] || 0) + (row.cakes_produced || 0);
  }
  return map;
}


/* =========================
   TODAY'S SALES — per product
   Returns a map keyed by product_id → { quantity, revenue } sold today.
   Used by the stock screen "Sold Today" column.
========================= */
export async function getTodaySalesByProduct() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from("sales")
    .select("product_id, quantity, total_amount")
    .gte("created_at", today.toISOString());

  if (error) throw error;

  const map = {};
  for (const row of data || []) {
    if (!map[row.product_id]) map[row.product_id] = { quantity: 0, revenue: 0 };
    map[row.product_id].quantity += row.quantity || 0;
    map[row.product_id].revenue += Number(row.total_amount) || 0;
  }
  return map;
}


/* =========================
   FIND CUSTOMER
========================= */
export async function findCustomer(name) {
  const { data } = await supabase
    .from("customers")
    .select("*")
    .ilike("name", `%${name}%`);

  return data || [];
}


/* =========================
   CUSTOMER BALANCE
   Balance = total payments received minus total amount spent on sales.
   Positive = customer still has credit to spend.
========================= */
export async function getCustomerBalance(customer_id) {
  const { data: payments } = await supabase
    .from("payments")
    .select("amount")
    .eq("customer_id", customer_id);

  const { data: sales } = await supabase
    .from("sales")
    .select("total_amount")
    .eq("customer_id", customer_id);

  const paid = payments?.reduce((s, p) => s + Number(p.amount), 0) || 0;
  const spent = sales?.reduce((s, s2) => s + Number(s2.total_amount), 0) || 0;

  return paid - spent;
}


/* =========================
   FIND OR CREATE TODAY'S ORDER
   Reuses an existing order if the customer already bought today.
   Uses .maybeSingle() → returns null (not an error) when 0 rows found.
   Bounded to today only (>= today AND < tomorrow).
========================= */
export async function getOrCreateOrder(customer_id, user_id) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayISO = today.toISOString();

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowISO = tomorrow.toISOString();

  const { data: existing, error: fetchErr } = await supabase
    .from("orders")
    .select("*")
    .eq("customer_id", customer_id)
    .gte("created_at", todayISO)
    .lt("created_at", tomorrowISO)
    .maybeSingle();

  if (fetchErr) throw fetchErr;
  if (existing) return existing;

  const { data, error: insertErr } = await supabase
    .from("orders")
    .insert([{ customer_id, user_id, total_amount: 0 }])
    .select()
    .single();

  if (insertErr) throw insertErr;
  return data;
}


/* =========================
   PROCESS SALE — CART VERSION
   Accepts a full cart array and processes it as one atomic transaction.

   Safety order (fail fast, touch nothing until all checks pass):
     1. Cart must not be empty, all items must have valid quantities
     2. Customer balance must cover the full cart total
     3. Every item must have enough market stock
   Then:
     - Deducts stock for each item
     - Inserts one sale record per item
     - Updates (or creates) today's order with the new running total

   items shape: [{ product_id, name, quantity, price_per_unit, sale_type }]
========================= */
export async function processSaleCart({ customer_id, items }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not logged in.");
  if (!items || items.length === 0) throw new Error("Cart is empty.");

  for (const item of items) {
    if (!item.product_id) throw new Error("A cart item is missing a product.");
    if (!item.quantity || item.quantity <= 0) throw new Error(`Invalid quantity for ${item.name}.`);
  }

  const cartTotal = items.reduce((sum, i) => sum + i.quantity * i.price_per_unit, 0);

  // 1. Balance check — before touching anything
  const balance = await getCustomerBalance(customer_id);
  if (balance < cartTotal) {
    throw new Error(
      `Insufficient balance. Customer has KES ${balance.toFixed(2)} but the cart total is KES ${cartTotal.toFixed(2)}. ` +
      `They need KES ${(cartTotal - balance).toFixed(2)} more.`
    );
  }

  // 2. Get market location
  const { data: market, error: mErr } = await supabase
    .from("inventory_locations")
    .select("id")
    .eq("name", "market")
    .single();

  if (mErr || !market) throw new Error("Market location not found.");

  // 3. Stock check for ALL items before deducting anything
  for (const item of items) {
    const { data: inv } = await supabase
      .from("inventory")
      .select("quantity_cakes")
      .eq("product_id", item.product_id)
      .eq("location_id", market.id)
      .single();

    if (!inv || inv.quantity_cakes < item.quantity) {
      throw new Error(
        `Not enough stock for ${item.name}. ` +
        `Only ${inv?.quantity_cakes ?? 0} cakes available, cart needs ${item.quantity}.`
      );
    }
  }

  // 4. All checks passed — process each item
  for (const item of items) {
    const { data: inv } = await supabase
      .from("inventory")
      .select("id, quantity_cakes")
      .eq("product_id", item.product_id)
      .eq("location_id", market.id)
      .single();

    await supabase.from("inventory")
      .update({ quantity_cakes: inv.quantity_cakes - item.quantity })
      .eq("id", inv.id);

    await supabase.from("sales").insert([{
      customer_id,
      product_id: item.product_id,
      quantity: item.quantity,
      price_per_unit: item.price_per_unit,
      total_amount: item.quantity * item.price_per_unit,
      sale_type: item.sale_type,
      user_id: user.id,
    }]);
  }

  // 5. Update today's running order total
  const order = await getOrCreateOrder(customer_id, user.id);
  const { error: orderErr } = await supabase
    .from("orders")
    .update({ total_amount: (order.total_amount || 0) + cartTotal })
    .eq("id", order.id);

  if (orderErr) throw orderErr;
}


/* =========================
   PROCESS EXCHANGE
   Validates prior purchase exists, returns stock to market, logs the exchange.
========================= */
export async function processExchange({ customer_id, product_id, quantity, reason }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not logged in.");
  if (!product_id) throw new Error("Please select a product for exchange.");
  if (!quantity || quantity <= 0) throw new Error("Exchange quantity must be greater than 0.");

  const { data: sales } = await supabase
    .from("sales")
    .select("id")
    .eq("customer_id", customer_id)
    .eq("product_id", product_id);

  if (!sales || sales.length === 0) {
    throw new Error("This customer has no prior purchase of this product.");
  }

  const { data: market } = await supabase
    .from("inventory_locations")
    .select("id")
    .eq("name", "market")
    .single();

  const { data: inv } = await supabase
    .from("inventory")
    .select("id, quantity_cakes")
    .eq("product_id", product_id)
    .eq("location_id", market.id)
    .single();

  if (!inv) throw new Error("Product not found in market inventory.");

  await supabase.from("inventory")
    .update({ quantity_cakes: inv.quantity_cakes + quantity })
    .eq("id", inv.id);

  const { error } = await supabase.from("exchanges").insert([{
    customer_id,
    product_id,
    quantity,
    reason,
    user_id: user.id,
  }]);

  if (error) throw error;
}
