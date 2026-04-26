import { supabase } from "../supabaseClient";

// =========================
// 🔹 HELPERS
// =========================
async function getLocation(name) {
  const { data, error } = await supabase
    .from("inventory_locations")
    .select("*")
    .eq("name", name)
    .single();

  if (error) {
    console.error("Location error:", error);
    throw error;
  }

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

  const { data: newRow, error } = await supabase
    .from("inventory")
    .insert([{ product_id, location_id }])
    .select()
    .single();

  if (error) throw error;

  return newRow;
}

// =========================
// 🔹 STEP 1 — CREATE DELIVERY
// =========================
export async function createDelivery(items) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    const store = await getLocation("store");
    const transit = await getLocation("transit");

    // Create delivery
    const { data: delivery, error } = await supabase
      .from("deliveries")
      .insert([{ delivery_user_id: user.id, status: "collected" }])
      .select()
      .single();

    if (error) throw error;

    // Process each product
    for (const item of items) {
      const { product_id, crates } = item;

      const storeInv = await getOrCreateInventory(product_id, store.id);
      const transitInv = await getOrCreateInventory(product_id, transit.id);

      if (storeInv.quantity_crates < crates) {
        throw new Error("Not enough crates in store");
      }

      // Move store → transit
      await supabase.from("inventory").update({
        quantity_crates: storeInv.quantity_crates - crates,
      }).eq("id", storeInv.id);

      await supabase.from("inventory").update({
        quantity_crates: transitInv.quantity_crates + crates,
      }).eq("id", transitInv.id);

      // Insert delivery item
      await supabase.from("delivery_items").insert([
        {
          delivery_id: delivery.id,
          product_id,
          crates_sent: crates,
        },
      ]);
    }

    return delivery;

  } catch (err) {
    console.error("CREATE DELIVERY ERROR:", err);
    throw err;
  }
}

// =========================
// 🔹 STEP 2 — START DELIVERY
// =========================
export async function startDelivery(delivery_id) {
  try {
    const { error } = await supabase
      .from("deliveries")
      .update({
        status: "in_transit",
        departed_at: new Date().toISOString(),
      })
      .eq("id", delivery_id);

    if (error) throw error;

  } catch (err) {
    console.error("START DELIVERY ERROR:", err);
    throw err;
  }
}

// =========================
// 🔹 STEP 3 — ARRIVE
// =========================
export async function arriveDelivery(delivery_id) {
  try {
    const transit = await getLocation("transit");
    const market = await getLocation("market");

    const { data: items, error } = await supabase
      .from("delivery_items")
      .select("*")
      .eq("delivery_id", delivery_id);

    if (error) throw error;

    for (const item of items) {
      const transitInv = await getOrCreateInventory(item.product_id, transit.id);
      const marketInv = await getOrCreateInventory(item.product_id, market.id);

      // Move transit → market
      await supabase.from("inventory").update({
        quantity_crates: transitInv.quantity_crates - item.crates_sent,
      }).eq("id", transitInv.id);

      await supabase.from("inventory").update({
        quantity_crates: marketInv.quantity_crates + item.crates_sent,
      }).eq("id", marketInv.id);
    }

    await supabase.from("deliveries").update({
      status: "awaiting_sales_confirmation",
      arrived_at: new Date().toISOString(),
    }).eq("id", delivery_id);

  } catch (err) {
    console.error("ARRIVE ERROR:", err);
    throw err;
  }
}

// =========================
// 🔹 STEP 4 — SALES CONFIRM
// =========================
export async function confirmBySales(delivery_id, confirmations) {
  try {
    for (const c of confirmations) {
      await supabase
        .from("delivery_items")
        .update({
          crates_received: c.received,
          broken_cakes: c.broken,
        })
        .eq("id", c.item_id);

      if (c.received !== c.sent) {
        console.warn("🚨 CRATE MISMATCH DETECTED");
      }
    }

    await supabase.from("deliveries").update({
      status: "at_market",
      sales_confirmed: true,
    }).eq("id", delivery_id);

  } catch (err) {
    console.error("SALES CONFIRM ERROR:", err);
    throw err;
  }
}

// =========================
// 🔹 STEP 5 — RETURN
// =========================
export async function confirmReturn(delivery_id, returns) {
  try {
    const market = await getLocation("market");
    const store = await getLocation("store");

    for (const r of returns) {
      const marketInv = await getOrCreateInventory(r.product_id, market.id);
      const storeInv = await getOrCreateInventory(r.product_id, store.id);

      if (marketInv.quantity_crates < r.returned) {
        throw new Error("Return exceeds market stock");
      }

      // Move market → store
      await supabase.from("inventory").update({
        quantity_crates: marketInv.quantity_crates - r.returned,
      }).eq("id", marketInv.id);

      await supabase.from("inventory").update({
        quantity_crates: storeInv.quantity_crates + r.returned,
      }).eq("id", storeInv.id);

      await supabase.from("delivery_items")
        .update({
          crates_returned: r.returned,
          crates_with_cakes: r.with_cakes,
        })
        .eq("id", r.item_id);

      if (r.returned < r.with_cakes) {
        console.warn("🚨 Suspicious: more crates with cakes than returned");
      }
    }

    await supabase.from("deliveries").update({
      status: "completed",
      return_confirmed: true,
    }).eq("id", delivery_id);

  } catch (err) {
    console.error("RETURN ERROR:", err);
    throw err;
  }
}

// =========================
// 🔹 GET ACTIVE
// =========================
export async function getActiveDeliveries() {
  const { data, error } = await supabase
    .from("deliveries")
    .select("*")
    .neq("status", "completed")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("FETCH DELIVERY ERROR:", error);
    throw error;
  }

  return data || [];
}