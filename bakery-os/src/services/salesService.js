import { supabase } from "../supabaseClient";

/* =========================
   GET DELIVERIES
========================= */
export async function getActiveSalesDeliveries() {
  try {
    const { data, error } = await supabase
      .from("deliveries")
      .select(`
        *,
        delivery_items(*, products(name))
      `)
      .in("status", ["awaiting_sales_confirmation", "at_market"]);

    if (error) throw error;
    return data || [];

  } catch (err) {
    console.error("GET SALES DELIVERIES ERROR:", err);
    throw err;
  }
}

/* =========================
   STEP 4 — CONFIRM DELIVERY
========================= */
export async function confirmDelivery({
  delivery_id,
  items,
  broken_cakes,
}) {
  try {
    const { data: market } = await supabase
      .from("inventory_locations")
      .select("*")
      .eq("name", "market")
      .single();

    const { data: transit } = await supabase
      .from("inventory_locations")
      .select("*")
      .eq("name", "transit")
      .single();

    for (const item of items) {
      const { data: original } = await supabase
        .from("delivery_items")
        .select("*")
        .eq("delivery_id", delivery_id)
        .eq("product_id", item.product_id)
        .single();

      if (!original) throw new Error("Delivery item missing");

      if (item.crates_received > original.crates_sent) {
        throw new Error("Received more than sent");
      }

      const { data: transitInv } = await supabase
        .from("inventory")
        .select("*")
        .eq("product_id", item.product_id)
        .eq("location_id", transit.id)
        .single();

      if (!transitInv || transitInv.quantity_crates < item.crates_received) {
        throw new Error("Transit mismatch");
      }

      // remove from transit
      await supabase
        .from("inventory")
        .update({
          quantity_crates:
            transitInv.quantity_crates - item.crates_received,
        })
        .eq("id", transitInv.id);

      // add to market
      const { data: marketInv } = await supabase
        .from("inventory")
        .select("*")
        .eq("product_id", item.product_id)
        .eq("location_id", market.id)
        .maybeSingle();

      if (marketInv) {
        await supabase
          .from("inventory")
          .update({
            quantity_crates:
              marketInv.quantity_crates + item.crates_received,
          })
          .eq("id", marketInv.id);
      } else {
        await supabase.from("inventory").insert([
          {
            product_id: item.product_id,
            location_id: market.id,
            quantity_crates: item.crates_received,
          },
        ]);
      }

      // update item
      await supabase
        .from("delivery_items")
        .update({
          crates_sent: item.crates_received,
        })
        .eq("id", original.id);
    }

    await supabase
      .from("deliveries")
      .update({
        broken_cakes,
        sales_confirmed: true,
        status: "at_market",
      })
      .eq("id", delivery_id);

  } catch (err) {
    console.error("CONFIRM DELIVERY ERROR:", err);
    throw err;
  }
}

/* =========================
   STEP 5 — OPTIONAL RETURN
========================= */
export async function prepareReturn({
  delivery_id,
  empty_crates,
  crates_with_cakes,
}) {
  try {
    // If nothing to return → do nothing
    if (empty_crates === 0 && crates_with_cakes === 0) {
      return;
    }

    const { error } = await supabase
      .from("deliveries")
      .update({
        crates_returned: empty_crates,
        return_crates_with_cakes: crates_with_cakes,
        status: "awaiting_return",
      })
      .eq("id", delivery_id);

    if (error) throw error;

  } catch (err) {
    console.error("PREPARE RETURN ERROR:", err);
    throw err;
  }
}

/* =========================
   CUSTOMER + SALES
========================= */
export async function findCustomer(name) {
  const { data } = await supabase
    .from("customers")
    .select("*")
    .ilike("name", `%${name}%`);

  return data || [];
}

export async function getCustomerBalance(customer_id) {
  const { data: payments } = await supabase
    .from("payments")
    .select("amount")
    .eq("customer_id", customer_id);

  const { data: sales } = await supabase
    .from("sales")
    .select("total_amount")
    .eq("customer_id", customer_id);

  const paid =
    payments?.reduce((s, p) => s + Number(p.amount), 0) || 0;

  const spent =
    sales?.reduce((s, s2) => s + Number(s2.total_amount), 0) || 0;

  return paid - spent;
}

export async function processSale({
  customer_id,
  product_id,
  quantity,
  price,
  sale_type,
}) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Not logged in");

  const total = quantity * price;
  const balance = await getCustomerBalance(customer_id);

  if (balance < total) {
    throw new Error(`Customer needs KES ${total - balance} more`);
  }

  const { data: market } = await supabase
    .from("inventory_locations")
    .select("*")
    .eq("name", "market")
    .single();

  const { data: inv } = await supabase
    .from("inventory")
    .select("*")
    .eq("product_id", product_id)
    .eq("location_id", market.id)
    .single();

  if (!inv || inv.quantity_cakes < quantity) {
    throw new Error("Not enough stock");
  }

  await supabase
    .from("inventory")
    .update({
      quantity_cakes: inv.quantity_cakes - quantity,
    })
    .eq("id", inv.id);

  await supabase.from("sales").insert([
    {
      customer_id,
      product_id,
      quantity,
      price_per_unit: price,
      total_amount: total,
      sale_type,
      user_id: user.id,
    },
  ]);
}