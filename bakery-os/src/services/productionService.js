import { supabase } from "../supabaseClient";

export async function logProduction({
  product_id,
  user_id,
  mixes_made,
  manual_crates = 0,
  manual_cakes = 0,
  note = "",
  shift = "day",
}) {
  try {
    console.log("🚀 Logging production...");

    // 🔹 1. Get product
    const { data: product, error: pError } = await supabase
      .from("products")
      .select("*")
      .eq("id", product_id)
      .single();

    if (pError || !product) throw new Error("Product not found");

    let crates = 0;
    let totalCakes = 0;
    let remainderCakes = 0;

    // 🔥 2. HANDLE FORMULA vs MANUAL
    if (product.requires_formula) {
      let basins = 0;

      if (product.basins_per_mix) {
        basins = mixes_made * product.basins_per_mix;
      } else if (product.mixes_per_basin) {
        basins = mixes_made / product.mixes_per_basin;
      } else {
        throw new Error("Invalid product formula");
      }

      const cratesPerBasin = 3;
      const cakesPerCrate = product.cakes_per_crate || 40;

      totalCakes = Math.floor(basins * cratesPerBasin * cakesPerCrate);
      crates = Math.floor(totalCakes / cakesPerCrate);
      remainderCakes = totalCakes % cakesPerCrate;

    } else {
      // 🔥 MANUAL ENTRY (cookies)
      const cakesPerCrate = product.cakes_per_crate || 20;

      totalCakes = Number(manual_cakes);
      crates = Math.floor(totalCakes / cakesPerCrate);
      remainderCakes = totalCakes % cakesPerCrate;
    }

    // 🔹 3. FLOUR (KG → sacks)
    let flourKg = mixes_made * (product.flour_kg_per_mix || 0);
    let flourSacks = flourKg / 50;

    // 🔹 4. INSERT LOG
    const { error: insertError } = await supabase
      .from("production_logs")
      .insert([{
        product_id,
        user_id,
        mixes_made,
        cakes_produced: totalCakes,
        crates_produced: crates,
        remainder_cakes: remainderCakes,
        flour_used: flourSacks,
        shift,
        note,
      }]);

    if (insertError) throw insertError;

    // 🔹 5. UPDATE INVENTORY (STORE)
    const { data: location } = await supabase
      .from("inventory_locations")
      .select("*")
      .eq("name", "store")
      .single();

    const { data: existing } = await supabase
      .from("inventory")
      .select("*")
      .eq("product_id", product_id)
      .eq("location_id", location.id)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("inventory")
        .update({
          quantity_cakes: existing.quantity_cakes + totalCakes,
          quantity_crates: existing.quantity_crates + crates,
        })
        .eq("id", existing.id);
    } else {
      await supabase.from("inventory").insert([{
        product_id,
        location_id: location.id,
        quantity_cakes: totalCakes,
        quantity_crates: crates,
      }]);
    }

    console.log("✅ Production success");

  } catch (err) {
    console.error("❌ Production error:", err.message);
    throw err;
  }
}