import { supabase } from '../supabaseClient';

export async function logProduction({
  product_id,
  user_id,
  mixes_made,
}) {
  // 🔹 1. Get product safely
  const { data: product, error: productError } = await supabase
    .from('products')
    .select('*')
    .eq('id', product_id)
    .maybeSingle();

  if (productError || !product) {
    throw new Error("Product not found");
  }

  // 🔹 2. Validate formulas
  if (
    product.basins_per_mix == null ||
    product.sacks_per_mix == null
  ) {
    throw new Error("Product formula not configured");
  }

  const cratesPerBasin = 3;
  const cakesPerCrate = 40;

  // 🔹 3. Compute (SAFE rounding)
  const basins = mixes_made * product.basins_per_mix;

  const crates = Math.floor(basins * cratesPerBasin);
  const cakes = Math.floor(crates * cakesPerCrate);
  const flourUsed = mixes_made * product.sacks_per_mix;

  console.log({
    mixes_made,
    basins,
    crates,
    cakes,
    flourUsed,
  });

  // 🔹 4. Insert production log
  const { error: insertError } = await supabase
    .from('production_logs')
    .insert([
      {
        product_id,
        user_id,
        mixes_made,
        cakes_produced: cakes,
        crates_produced: crates,
        flour_used: flourUsed,
      },
    ]);

  if (insertError) throw insertError;

  // 🔹 5. Get STORE location
  const { data: location, error: locError } = await supabase
    .from('inventory_locations')
    .select('*')
    .eq('name', 'store')
    .maybeSingle();

  if (locError || !location) {
    throw new Error("Store location not found");
  }

  // 🔹 6. Get or create inventory row
  const { data: existing } = await supabase
    .from('inventory')
    .select('*')
    .eq('product_id', product_id)
    .eq('location_id', location.id)
    .maybeSingle();

  if (existing) {
    const { error: updateError } = await supabase
      .from('inventory')
      .update({
        quantity_cakes: existing.quantity_cakes + cakes,
        quantity_crates: existing.quantity_crates + crates,
      })
      .eq('id', existing.id);

    if (updateError) throw updateError;
  } else {
    const { error: insertInvError } = await supabase
      .from('inventory')
      .insert([
        {
          product_id,
          location_id: location.id,
          quantity_cakes: cakes,
          quantity_crates: crates,
        },
      ]);

    if (insertInvError) throw insertInvError;
  }
}