import { supabase } from "../supabaseClient";

// 🔹 helper: get or create inventory row
async function getOrCreateInventory(product_id, location_id) {
  const { data, error } = await supabase
    .from("inventory")
    .select("*")
    .eq("product_id", product_id)
    .eq("location_id", location_id)
    .maybeSingle();

  if (data) return data;

  // create if not exists
  const { data: newRow, error: insertError } = await supabase
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

  if (insertError) throw insertError;

  return newRow;
}
// START DELIVERY
export async function startDelivery({
  product_id,
  delivery_user_id,
  crates_sent,
}) {
  if (crates_sent <= 0) throw new Error("Invalid crates");

  const { data: store } = await supabase
    .from("inventory_locations")
    .select("*")
    .eq("name", "store")
    .single();

  const { data: transit } = await supabase
    .from("inventory_locations")
    .select("*")
    .eq("name", "transit")
    .single();

  const storeInv = await getOrCreateInventory(product_id, store.id);
  const transitInv = await getOrCreateInventory(product_id, transit.id);

  // ❌ prevent negative stock
  if (storeInv.quantity_crates < crates_sent) {
    throw new Error("Not enough crates in store");
  }

  // update store
  await supabase
    .from("inventory")
    .update({
      quantity_crates: storeInv.quantity_crates - crates_sent,
    })
    .eq("id", storeInv.id);

  // update transit
  await supabase
    .from("inventory")
    .update({
      quantity_crates: transitInv.quantity_crates + crates_sent,
    })
    .eq("id", transitInv.id);

  // create delivery
  await supabase.from("deliveries").insert([
    {
      product_id,
      delivery_user_id,
      from_location_id: store.id,
      to_location_id: transit.id,
      crates_sent,
      departed_at: new Date().toISOString(),
      status: "in_transit",
    },
  ]);
}

// END DELIVERY
export async function completeDelivery({
  delivery_id,
  product_id,
  crates_received,
  broken_cakes,
}) {
  if (crates_received < 0) throw new Error("Invalid crates");

  const { data: transit } = await supabase
    .from("inventory_locations")
    .select("*")
    .eq("name", "transit")
    .single();

  const { data: market } = await supabase
    .from("inventory_locations")
    .select("*")
    .eq("name", "market")
    .single();

  const transitInv = await getOrCreateInventory(product_id, transit.id);
  const marketInv = await getOrCreateInventory(product_id, market.id);

  if (transitInv.quantity_crates < crates_received) {
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
  await supabase
    .from("inventory")
    .update({
      quantity_crates: marketInv.quantity_crates + crates_received,
    })
    .eq("id", marketInv.id);

  // update delivery
  await supabase
    .from("deliveries")
    .update({
      crates_returned: crates_received,
      broken_cakes,
      arrived_at: new Date().toISOString(),
      status: "completed",
    })
    .eq("id", delivery_id);
}
//CHECK ACTIVE DELIVERIES
export async function getActiveDeliveries() {
  const { data, error } = await supabase
    .from("deliveries")
    .select("*")
    .eq("status", "in_transit");

  if (error) throw error;

  return data;
}