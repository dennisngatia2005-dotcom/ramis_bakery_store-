import { supabase } from "../supabaseClient";

export async function logProduction({
  product_id,
  user_id,
  mixes_made,
  note = "",
  shift = "day",
}) {
  try {
    // 🔹 1. Get product
    const { data: products, error } = await supabase
      .from("products")
      .select("*")
      .eq("id", product_id)
      .limit(1);

    if (error || !products || products.length === 0) {
      throw new Error("Product not found");
    }

    const product = products[0];

    // 🔹 2. Validate formulas
    if (
      product.basins_per_mix == null ||
      product.sacks_per_mix == null
    ) {
      throw new Error("Product formula not configured");
    }

    const cratesPerBasin = 3;
    const cakesPerCrate = 40;

    // 🔹 3. Calculations
    const basins = mixes_made * product.basins_per_mix;
    const totalCakes = Math.floor(basins * cratesPerBasin * cakesPerCrate);
    const crates = Math.floor(totalCakes / cakesPerCrate);
    const remainderCakes = totalCakes % cakesPerCrate;
    const flourUsed = mixes_made * product.sacks_per_mix;

    // 🔹 4. Insert production log
    const { error: insertError } = await supabase
      .from("production_logs")
      .insert([
        {
          product_id,
          user_id, // This will now receive the valid ID from the UI
          mixes_made,
          cakes_produced: totalCakes,
          crates_produced: crates,
          remainder_cakes: remainderCakes,
          flour_used: flourUsed,
          shift,
          note,
        },
      ]);

    if (insertError) throw insertError;

    // 🔹 5. Update STORE inventory
    const { data: locations } = await supabase
      .from("inventory_locations")
      .select("*")
      .eq("name", "store")
      .limit(1);

    if (!locations || locations.length === 0) {
      throw new Error("Store location not found");
    }

    const location = locations[0];

    const { data: existing } = await supabase
      .from("inventory")
      .select("*")
      .eq("product_id", product_id)
      .eq("location_id", location.id)
      .limit(1);

    if (existing && existing.length > 0) {
      await supabase
        .from("inventory")
        .update({
          quantity_cakes: existing[0].quantity_cakes + totalCakes,
          quantity_crates: existing[0].quantity_crates + crates,
        })
        .eq("id", existing[0].id);
    } else {
      await supabase.from("inventory").insert([
        {
          product_id,
          location_id: location.id,
          quantity_cakes: totalCakes,
          quantity_crates: crates,
        },
      ]);
    }
  } catch (err) {
    console.error("Production error:", err);
    throw err;
  }
}
