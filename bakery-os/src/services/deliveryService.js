import { supabase } from "../supabaseClient";

// 🔹 helpers
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

  const { data: newRow, error } = await supabase
    .from("inventory")
    .insert([
      {
        product_id,
        location_id,
        quantity_crates: 0,
        quantity_cakes: 0,
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return newRow;
}

// 🔹 STEP 1: COLLECT CRATES
export async function collectCrates({ product_id, crates }) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("User not authenticated");

  const store = await getLocation("store");
  const transit = await getLocation("transit");

  const storeInv = await getOrCreateInventory(product_id, store.id);
  const transitInv = await getOrCreateInventory(product_id, transit.id);

  if (storeInv.quantity_crates < crates) {
    throw new Error("Not enough crates in store");
  }

  // move inventory
  await supabase
    .from("inventory")
    .update({
      quantity_crates: storeInv.quantity_crates - crates,
    })
    .eq("id", storeInv.id);

  await supabase
    .from("inventory")
    .update({
      quantity_crates: transitInv.quantity_crates + crates,
    })
    .eq("id", transitInv.id);

  // create delivery
  const { data, error } = await supabase
    .from("deliveries")
    .insert([
      {
        product_id,
        delivery_user_id: user.id,
        crates_sent: crates,
        status: "collected",
      },
    ])
    .select()
    .single();

  if (error) {
    console.error("DELIVERY INSERT ERROR:", error);
    throw error;
  }

  return data;
}

// 🔹 STEP 2
export async function startDelivery(delivery_id) {
  const { error } = await supabase
    .from("deliveries")
    .update({
      departed_at: new Date().toISOString(),
      status: "in_transit",
    })
    .eq("id", delivery_id);

  if (error) throw error;
}

// 🔹 STEP 3
export async function arriveDelivery(delivery_id) {
  const { error } = await supabase
    .from("deliveries")
    .update({
      arrived_at: new Date().toISOString(),
      status: "arrived",
    })
    .eq("id", delivery_id);

  if (error) throw error;
}

// 🔹 STEP 6
export async function confirmReturn({
  delivery_id,
  product_id,
  crates_returned,
}) {
  const market = await getLocation("market");
  const store = await getLocation("store");

  const marketInv = await getOrCreateInventory(product_id, market.id);
  const storeInv = await getOrCreateInventory(product_id, store.id);

  if (marketInv.quantity_crates < crates_returned) {
    throw new Error("Market stock mismatch");
  }

  await supabase
    .from("inventory")
    .update({
      quantity_crates: marketInv.quantity_crates - crates_returned,
    })
    .eq("id", marketInv.id);

  await supabase
    .from("inventory")
    .update({
      quantity_crates: storeInv.quantity_crates + crates_returned,
    })
    .eq("id", storeInv.id);

  const { error } = await supabase
    .from("deliveries")
    .update({
      crates_returned,
      return_confirmed: true,
      status: "completed",
    })
    .eq("id", delivery_id);

  if (error) throw error;
}

// 🔹 ACTIVE DELIVERY
export async function getActiveDeliveries() {
  const { data, error } = await supabase
    .from("deliveries")
    .select("*")
    .neq("status", "completed")
    .order("created_at", { ascending: false });

  if (error) throw error;

  return data || [];
}