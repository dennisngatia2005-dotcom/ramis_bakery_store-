import { supabase } from "../supabaseClient";

// START DELIVERY
export async function startDelivery({
  product_id,
  delivery_user_id,
  crates_sent,
}) {
  // 1. Get locations
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

  // 2. Get inventory in store
  const { data: inventory } = await supabase
    .from("inventory")
    .select("*")
    .eq("product_id", product_id)
    .eq("location_id", store.id)
    .single();

  if (!inventory || inventory.quantity_crates < crates_sent) {
    throw new Error("Not enough crates in store");
  }

  // 3. Deduct from store
  await supabase
    .from("inventory")
    .update({
      quantity_crates: inventory.quantity_crates - crates_sent,
    })
    .eq("id", inventory.id);

  // 4. Add to transit
  const { data: transitInventory } = await supabase
    .from("inventory")
    .select("*")
    .eq("product_id", product_id)
    .eq("location_id", transit.id)
    .single();

  if (transitInventory) {
    await supabase
      .from("inventory")
      .update({
        quantity_crates:
          transitInventory.quantity_crates + crates_sent,
      })
      .eq("id", transitInventory.id);
  } else {
    await supabase.from("inventory").insert([
      {
        product_id,
        location_id: transit.id,
        quantity_crates: crates_sent,
        quantity_cakes: 0,
      },
    ]);
  }

  // 5. Create delivery record
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

  // 1. Remove from transit
  const { data: transitInv } = await supabase
    .from("inventory")
    .select("*")
    .eq("product_id", product_id)
    .eq("location_id", transit.id)
    .single();

  await supabase
    .from("inventory")
    .update({
      quantity_crates:
        transitInv.quantity_crates - crates_received,
    })
    .eq("id", transitInv.id);

  // 2. Add to market
  const { data: marketInv } = await supabase
    .from("inventory")
    .select("*")
    .eq("product_id", product_id)
    .eq("location_id", market.id)
    .single();

  if (marketInv) {
    await supabase
      .from("inventory")
      .update({
        quantity_crates:
          marketInv.quantity_crates + crates_received,
      })
      .eq("id", marketInv.id);
  } else {
    await supabase.from("inventory").insert([
      {
        product_id,
        location_id: market.id,
        quantity_crates: crates_received,
        quantity_cakes: 0,
      },
    ]);
  }

  // 3. Update delivery record
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