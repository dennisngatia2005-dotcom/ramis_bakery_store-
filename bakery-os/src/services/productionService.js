import { supabase } from '../supabaseClient';

export async function logProduction({
  product_id,
  user_id,
  mixes_made,
}) {
  // 1. Get product info
  const { data: product, error: productError } = await supabase
    .from('products')
    .select('*')
    .eq('id', product_id)
    .single();

  if (productError) throw productError;

  // 2. Compute values
  const cakes_produced = mixes_made * product.cakes_per_mix;
  const crates_produced = Math.floor(
    cakes_produced / product.cakes_per_crate
  );

  const flour_used = mixes_made * 2; // adjust later

  // 3. Insert production log
  const { error: insertError } = await supabase
    .from('production_logs')
    .insert([
      {
        product_id,
        user_id,
        mixes_made,
        cakes_produced,
        crates_produced,
        flour_used,
      },
    ]);

  if (insertError) throw insertError;

  // 4. Update inventory (STORE location)
  const { data: location } = await supabase
    .from('inventory_locations')
    .select('*')
    .eq('name', 'store')
    .single();

  const { data: existing } = await supabase
    .from('inventory')
    .select('*')
    .eq('product_id', product_id)
    .eq('location_id', location.id)
    .single();

  if (existing) {
    await supabase
      .from('inventory')
      .update({
        quantity_cakes:
          existing.quantity_cakes + cakes_produced,
        quantity_crates:
          existing.quantity_crates + crates_produced,
      })
      .eq('id', existing.id);
  } else {
    await supabase.from('inventory').insert([
      {
        product_id,
        location_id: location.id,
        quantity_cakes: cakes_produced,
        quantity_crates: crates_produced,
      },
    ]);
  }
}