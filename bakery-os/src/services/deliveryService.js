import { supabase } from "../supabaseClient";

/* =========================
   🔹 HELPERS
========================= */
async function getLocation(name) {
  const { data, error } = await supabase
    .from("inventory_locations")
    .select("*")
    .eq("name", name)
    .single();
  if (error) throw error;
  return data;
}

async function getOrCreateInventory(product_id, location_id) {
  const { data } = await supabase
    .from("inventory")
    .select("*")
    .eq("product_id", product_id)
    .eq("location_id", location_id)
    .maybeSingle();

  if (data) return data;

  // Create row with 0s to avoid NULL math issues
  const { data: newRow, error } = await supabase
    .from("inventory")
    .insert([{ 
      product_id, 
      location_id, 
      quantity_crates: 0, 
      quantity_cakes: 0 
    }])
    .select().single();

  if (error) throw error;
  return newRow;
}

/* =========================
   🔹 STEP 1 — CREATE DELIVERY
========================= */
export async function createDelivery(items) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const store = await getLocation("store");
    const transit = await getLocation("transit");

    // Create delivery header
    const { data: delivery, error: dErr } = await supabase
      .from("deliveries")
      .insert([{ delivery_user_id: user.id, status: "collected" }])
      .select().single();
    if (dErr) throw dErr;

    for (const item of items) {
      // Get formula
      const { data: product } = await supabase
        .from("products")
        .select("cakes_per_crate")
        .eq("id", item.product_id)
        .single();

      const multiplier = product?.cakes_per_crate || 0;
      const cratesToMove = Number(item.crates);
      const cakesToMove = cratesToMove * multiplier;

      const storeInv = await getOrCreateInventory(item.product_id, store.id);
      const transitInv = await getOrCreateInventory(item.product_id, transit.id);

      // Perform Update - Store (Subtract)
      const { error: storeErr } = await supabase.from("inventory").update({
        quantity_crates: (storeInv.quantity_crates || 0) - cratesToMove,
        quantity_cakes: (storeInv.quantity_cakes || 0) - cakesToMove,
        updated_at: new Date()
      }).eq("id", storeInv.id);
      if (storeErr) throw storeErr;

      // Perform Update - Transit (Add)
      const { error: transitErr } = await supabase.from("inventory").update({
        quantity_crates: (transitInv.quantity_crates || 0) + cratesToMove,
        quantity_cakes: (transitInv.quantity_cakes || 0) + cakesToMove,
        updated_at: new Date()
      }).eq("id", transitInv.id);
      if (transitErr) throw transitErr;

      // Record in delivery_items
      await supabase.from("delivery_items").insert([{
        delivery_id: delivery.id,
        product_id: item.product_id,
        crates_sent: cratesToMove
      }]);
    }
    return delivery;
  } catch (err) {
    console.error("CREATE DELIVERY ERROR:", err.message);
    throw err;
  }
}

/* =========================
   🔹 STEP 2 & 3 — START & ARRIVE
========================= */
export async function startDelivery(delivery_id) {
  const { error } = await supabase.from("deliveries")
    .update({ status: "in_transit", departed_at: new Date().toISOString() })
    .eq("id", delivery_id);
  if (error) throw error;
}

export async function arriveDelivery(delivery_id) {
  const transit = await getLocation("transit");
  const market = await getLocation("market");

  const { data: items } = await supabase
    .from("delivery_items")
    .select("*, products(cakes_per_crate)")
    .eq("delivery_id", delivery_id);

  for (const item of items) {
    const multiplier = item.products?.cakes_per_crate || 0;
    const cratesToMove = Number(item.crates_sent);
    const cakesToMove = cratesToMove * multiplier;

    const transitInv = await getOrCreateInventory(item.product_id, transit.id);
    const marketInv = await getOrCreateInventory(item.product_id, market.id);

    // Transit -> Market
    await supabase.from("inventory").update({
      quantity_crates: (transitInv.quantity_crates || 0) - cratesToMove,
      quantity_cakes: (transitInv.quantity_cakes || 0) - cakesToMove
    }).eq("id", transitInv.id);

    await supabase.from("inventory").update({
      quantity_crates: (marketInv.quantity_crates || 0) + cratesToMove,
      quantity_cakes: (marketInv.quantity_cakes || 0) + cakesToMove
    }).eq("id", marketInv.id);
  }

  await supabase.from("deliveries").update({
    status: "awaiting_sales_confirmation",
    arrived_at: new Date().toISOString()
  }).eq("id", delivery_id);
}

/* =========================
   🔹 STEP 5 — RETURN
========================= */
export async function confirmReturn(delivery_id, returns) {
  const market = await getLocation("market");
  const store = await getLocation("store");

  for (const r of returns) {
    const { data: product } = await supabase.from("products").select("cakes_per_crate").eq("id", r.product_id).single();
    const multiplier = product?.cakes_per_crate || 0;
    const cratesReturning = Number(r.returned);
    const cakesReturning = cratesReturning * multiplier;

    const marketInv = await getOrCreateInventory(r.product_id, market.id);
    const storeInv = await getOrCreateInventory(r.product_id, store.id);

    // Market -> Store
    await supabase.from("inventory").update({
      quantity_crates: (marketInv.quantity_crates || 0) - cratesReturning,
      quantity_cakes: (marketInv.quantity_cakes || 0) - cakesReturning
    }).eq("id", marketInv.id);

    await supabase.from("inventory").update({
      quantity_crates: (storeInv.quantity_crates || 0) + cratesReturning,
      quantity_cakes: (storeInv.quantity_cakes || 0) + cakesReturning
    }).eq("id", storeInv.id);

    await supabase.from("delivery_items").update({
      crates_returned: cratesReturning,
      crates_with_cakes: Number(r.with_cakes)
    }).eq("id", r.item_id);
  }

  await supabase.from("deliveries").update({ status: "completed", return_confirmed: true }).eq("id", delivery_id);
}

export async function getActiveDeliveries() {
  const { data } = await supabase.from("deliveries")
    .select("*, delivery_items(*, products(name))")
    .neq("status", "completed")
    .order("created_at", { ascending: false });
  return data || [];
}
