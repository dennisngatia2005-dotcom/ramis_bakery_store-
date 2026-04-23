import { supabase } from "../supabaseClient";

export async function makeSale({
  product_id,
  customer_id,
  sales_user_id,
  quantity,
  price_type,
}) {
  // 1. Get product
  const { data: product, error: productError } = await supabase
    .from("products")
    .select("*")
    .eq("id", product_id)
    .single();

  if (productError) throw productError;

  // 2. Determine price
  const price =
    price_type === "retail"
      ? product.retail_price
      : product.wholesale_price;

  const total_amount = price * quantity;

  // 3. Get market location
  const { data: location } = await supabase
    .from("inventory_locations")
    .select("*")
    .eq("name", "market")
    .single();

  // 4. Get inventory
  const { data: inventory, error: invError } = await supabase
    .from("inventory")
    .select("*")
    .eq("product_id", product_id)
    .eq("location_id", location.id)
    .single();

  if (invError || !inventory) {
    throw new Error("No inventory in market");
  }

  // 5. Check stock
  if (inventory.quantity_cakes < quantity) {
    throw new Error("Not enough stock");
  }

  // 6. Insert sale
  const { error: saleError } = await supabase
    .from("sales")
    .insert([
      {
        product_id,
        customer_id,
        sales_user_id,
        quantity,
        price_type,
        total_amount,
      },
    ]);

  if (saleError) throw saleError;

  // 7. Update inventory
  const { error: updateError } = await supabase
    .from("inventory")
    .update({
      quantity_cakes: inventory.quantity_cakes - quantity,
    })
    .eq("id", inventory.id);

  if (updateError) throw updateError;

  return total_amount;
}