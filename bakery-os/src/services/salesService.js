import { supabase } from "../supabaseClient";

/* =========================
   DELIVERY HANDSHAKE
========================= */

// Get deliveries waiting for sales
export async function getArrivedDeliveries() {
  const { data, error } = await supabase
    .from("deliveries")
    .select("*")
    .eq("status", "arrived")
    .eq("sales_confirmed", false);

  if (error) throw error;
  return data || [];
}

// STEP 4 — Confirm delivery
export async function confirmDelivery({
  delivery_id,
  product_id,
  crates_received,
  broken_cakes,
}) {
  const { data: market } = await supabase
    .from("inventory_locations")
    .select("*")
    .eq("name", "market")
    .single();

  const { data: transit } = await supabase
    .from("inventory_locations")
    .select("*")
    .eq("name", "transit")
    .single();

  const { data: transitInv } = await supabase
    .from("inventory")
    .select("*")
    .eq("product_id", product_id)
    .eq("location_id", transit.id)
    .single();

  if (!transitInv || transitInv.quantity_crates < crates_received) {
    throw new Error("Transit stock mismatch");
  }

  // remove from transit
  await supabase
    .from("inventory")
    .update({
      quantity_crates: transitInv.quantity_crates - crates_received,
    })
    .eq("id", transitInv.id);

  // add to market
  await supabase.from("inventory").upsert({
    product_id,
    location_id: market.id,
    quantity_crates: crates_received,
  });

  // update delivery
  const { error } = await supabase
    .from("deliveries")
    .update({
      crates_returned: crates_received,
      broken_cakes,
      sales_confirmed: true,
      status: "at_market",
    })
    .eq("id", delivery_id);

  if (error) throw error;
}

// STEP 5 — Prepare return
export async function prepareReturn({
  delivery_id,
  empty_crates,
  crates_with_cakes,
}) {
  const { error } = await supabase
    .from("deliveries")
    .update({
      crates_returned: empty_crates,
      return_crates_with_cakes: crates_with_cakes,
      return_confirmed: false,
      status: "awaiting_return",
    })
    .eq("id", delivery_id);

  if (error) throw error;
}

/* =========================
   CUSTOMER + SALES
========================= */

export async function findCustomer(name) {
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .ilike("name", `%${name}%`);

  if (error) throw error;
  return data || [];
}

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

export async function processSale({
  customer_id,
  product_id,
  quantity,
  price,
  sale_type,
}) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Not logged in");

  const total = quantity * price;
  const balance = await getCustomerBalance(customer_id);

  if (balance < total) {
    throw new Error(`Customer needs KES ${total - balance} more`);
  }

  const { data: market } = await supabase
    .from("inventory_locations")
    .select("*")
    .eq("name", "market")
    .single();

  const { data: inv } = await supabase
    .from("inventory")
    .select("*")
    .eq("product_id", product_id)
    .eq("location_id", market.id)
    .single();

  if (!inv || inv.quantity_cakes < quantity) {
    throw new Error("Not enough cakes in stock");
  }

  await supabase
    .from("inventory")
    .update({
      quantity_cakes: inv.quantity_cakes - quantity,
    })
    .eq("id", inv.id);

  const { error } = await supabase.from("sales").insert([
    {
      customer_id,
      product_id,
      quantity,
      price_per_unit: price,
      total_amount: total,
      sale_type,
      user_id: user.id,
    },
  ]);

  if (error) throw error;
}