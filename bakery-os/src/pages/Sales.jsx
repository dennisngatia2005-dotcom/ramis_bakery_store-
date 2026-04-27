import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import LogoutButton from "../components/LogoutButton";

import {
  getActiveSalesDeliveries,
  confirmDelivery,
  prepareReturn,
  getTodayProduction,
  getTodaySalesByProduct,
  findCustomer,
  getCustomerBalance,
  processSaleCart,
  processExchange,
} from "../services/salesService";

export default function Sales() {

  /* ===============================================================
     STATE
  =============================================================== */

  const [tab, setTab] = useState("stock");
  const [loading, setLoading] = useState(false);

  // Delivery arrival banner — shown when driver marks himself as arrived
  const [arrivalAlert, setArrivalAlert] = useState(false);

  // ── Data ────────────────────────────────────────────────────────
  const [deliveries, setDeliveries]     = useState([]);
  const [products, setProducts]         = useState([]);
  const [inventory, setInventory]       = useState([]);
  const [todayProdMap, setTodayProdMap] = useState({});   // product_id → cakes produced today
  const [todaySalesMap, setTodaySalesMap] = useState({}); // product_id → { quantity, revenue }

  // ── Delivery confirmation ────────────────────────────────────────
  const [selectedDelivery, setSelectedDelivery] = useState(null);
  const [receivedMap, setReceivedMap]   = useState({}); // product_id → crates received
  const [brokenMap, setBrokenMap]       = useState({}); // product_id → broken cakes per item
  const [deliveryBroken, setDeliveryBroken] = useState(0); // overall broken cakes for delivery record

  // ── Return ──────────────────────────────────────────────────────
  const [returnEmpty, setReturnEmpty]         = useState(0);
  const [returnWithCakes, setReturnWithCakes] = useState(0);

  // ── Customer ────────────────────────────────────────────────────
  const [search, setSearch]   = useState("");
  const [results, setResults] = useState([]);
  const [customer, setCustomer] = useState(null);
  const [balance, setBalance]   = useState(null); // null = not yet loaded

  // ── Cart ─────────────────────────────────────────────────────────
  // saleType applies to the WHOLE cart — retail or wholesale for this customer
  const [saleType, setSaleType]       = useState("retail");
  const [cartProduct, setCartProduct] = useState(null);  // product_id being added
  const [cartQty, setCartQty]         = useState("");
  // cart: [{ product_id, name, quantity, price_per_unit, sale_type, subtotal }]
  const [cart, setCart] = useState([]);

  // ── Exchange ────────────────────────────────────────────────────
  const [exchangeProduct, setExchangeProduct] = useState(null);
  const [exchangeQty, setExchangeQty]         = useState("");
  const [exchangeReason, setExchangeReason]   = useState("");


  /* ===============================================================
     DERIVED CART VALUES
     Recomputed on every render — no stale state risk.
  =============================================================== */
  const cartTotal          = cart.reduce((sum, i) => sum + i.subtotal, 0);
  const balanceAfterCart   = (balance ?? 0) - cartTotal;
  const cartIsAffordable   = balanceAfterCart >= 0;


  /* ===============================================================
     LOAD DATA
     Called on mount and whenever any subscribed table changes.
  =============================================================== */
  useEffect(() => {
    loadData();

    // Subscribe to deliveries, inventory, and sales so every screen
    // stays live without the user manually refreshing.
    const channel = supabase
      .channel("sales-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "deliveries" },
        (payload) => {
          // Show arrival banner when driver marks himself as arrived
          if (payload.new?.status === "awaiting_sales_confirmation") {
            setArrivalAlert(true);
          }
          loadData();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "inventory" },
        loadData
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sales" },
        loadData
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  async function loadData() {
    // Deliveries
    const d = await getActiveSalesDeliveries();
    setDeliveries(d);

    // Products
    const { data: p } = await supabase.from("products").select("*");
    setProducts(p || []);

    // Inventory with location and product names
    const { data: inv } = await supabase
      .from("inventory")
      .select("*, inventory_locations(name), products(name, retail_price)");
    setInventory(inv || []);

    // Today's production and sales for stock screen
    const [prodMap, salesMap] = await Promise.all([
      getTodayProduction(),
      getTodaySalesByProduct(),
    ]);
    setTodayProdMap(prodMap);
    setTodaySalesMap(salesMap);
  }


  /* ===============================================================
     DELIVERY — CONFIRM RECEIPT
  =============================================================== */
  function updateReceived(product_id, value) {
    setReceivedMap((prev) => ({ ...prev, [product_id]: Number(value) }));
  }

  function updateItemBroken(product_id, value) {
    setBrokenMap((prev) => ({ ...prev, [product_id]: Number(value) }));
  }

  async function handleConfirmDelivery(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const items = selectedDelivery.delivery_items.map((item) => ({
        product_id: item.product_id,
        crates_received: receivedMap[item.product_id] || 0,
        item_broken_cakes: brokenMap[item.product_id] || 0,
      }));

      await confirmDelivery({
        delivery_id: selectedDelivery.id,
        items,
        broken_cakes: deliveryBroken,
      });

      alert("Delivery confirmed ✅");
      setSelectedDelivery(null);
      setReceivedMap({});
      setBrokenMap({});
      setDeliveryBroken(0);
      loadData();
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  }


  /* ===============================================================
     DELIVERY — PREPARE RETURN
  =============================================================== */
  async function handleReturn(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await prepareReturn({
        delivery_id: selectedDelivery.id,
        empty_crates: Number(returnEmpty),
        crates_with_cakes: Number(returnWithCakes),
      });

      alert("Return submitted ✅");
      setSelectedDelivery(null);
      setReturnEmpty(0);
      setReturnWithCakes(0);
      loadData();
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  }


  /* ===============================================================
     CUSTOMER SEARCH + SELECT
  =============================================================== */
  async function handleSearch() {
    if (!search.trim()) return;
    const res = await findCustomer(search.trim());
    setResults(res || []);
  }

  async function selectCustomer(c) {
    setCustomer(c);
    setBalance(null);
    setCart([]); // clear any previous customer's cart
    setExchangeProduct(null);
    setExchangeQty("");
    setExchangeReason("");

    const bal = await getCustomerBalance(c.id);
    setBalance(bal);
  }


  /* ===============================================================
     CART — ADD ITEM
     If the same product is added twice, quantities are merged.
     When saleType changes, ALL existing cart item prices are updated.
  =============================================================== */
  function handleSaleTypeChange(newType) {
    setSaleType(newType);
    // Reprice everything already in the cart
    setCart((prev) =>
      prev.map((item) => {
        const p = products.find((p) => p.id === item.product_id);
        if (!p) return item;
        const newPrice = newType === "retail" ? p.retail_price : p.wholesale_price;
        return {
          ...item,
          price_per_unit: newPrice,
          sale_type: newType,
          subtotal: newPrice * item.quantity,
        };
      })
    );
  }

  function addToCart() {
    if (!cartProduct) {
      alert("Please select a product to add.");
      return;
    }
    const qty = Number(cartQty);
    if (!qty || qty <= 0) {
      alert("Please enter a valid quantity.");
      return;
    }

    const p = products.find((p) => p.id === cartProduct);
    if (!p) return;

    const price    = saleType === "retail" ? p.retail_price : p.wholesale_price;
    const subtotal = price * qty;

    setCart((prev) => {
      const existing = prev.find((i) => i.product_id === cartProduct);
      if (existing) {
        // Merge — customer is adding more of the same product
        return prev.map((i) =>
          i.product_id === cartProduct
            ? { ...i, quantity: i.quantity + qty, subtotal: i.subtotal + subtotal }
            : i
        );
      }
      return [
        ...prev,
        {
          product_id: cartProduct,
          name: p.name,
          quantity: qty,
          price_per_unit: price,
          sale_type: saleType,
          subtotal,
        },
      ];
    });

    // Reset add-item inputs
    setCartProduct(null);
    setCartQty("");
  }

  function removeFromCart(product_id) {
    setCart((prev) => prev.filter((i) => i.product_id !== product_id));
  }


  /* ===============================================================
     CART — COMPLETE SALE
     Submits the entire cart in one call. On success, clears the cart
     and refreshes the customer's balance.
  =============================================================== */
  async function handleCompleteSale() {
    if (cart.length === 0) {
      alert("Cart is empty. Add at least one product.");
      return;
    }
    if (!cartIsAffordable) {
      alert(
        `Customer balance is KES ${(balance ?? 0).toFixed(2)} but cart total is KES ${cartTotal.toFixed(2)}. ` +
        `They need KES ${Math.abs(balanceAfterCart).toFixed(2)} more.`
      );
      return;
    }

    setLoading(true);
    try {
      await processSaleCart({ customer_id: customer.id, items: cart });
      alert("Sale complete ✅");
      setCart([]);
      const bal = await getCustomerBalance(customer.id);
      setBalance(bal);
      loadData();
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  }


  /* ===============================================================
     EXCHANGE
  =============================================================== */
  async function handleExchange() {
    setLoading(true);
    try {
      await processExchange({
        customer_id: customer.id,
        product_id: exchangeProduct,
        quantity: Number(exchangeQty),
        reason: exchangeReason,
      });

      alert("Exchange recorded ✅");
      setExchangeProduct(null);
      setExchangeQty("");
      setExchangeReason("");
      loadData();
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  }


  /* ===============================================================
     STOCK HELPERS
     marketStock and storeStock are derived from inventory on every render.
  =============================================================== */
  const marketStock = inventory.filter((i) => i.inventory_locations?.name === "market");
  const storeStock  = inventory.filter((i) => i.inventory_locations?.name === "store");


  /* ===============================================================
     RENDER
  =============================================================== */
  return (
    <div>

      {/* ── DELIVERY ARRIVAL BANNER ─────────────────────────────────
          Shown at the very top of the screen the moment the driver
          marks himself as arrived. Disappears when dismissed.
          Tapping "Go to Delivery" switches the tab for them.       */}
      {arrivalAlert && (
        <div className="alert-banner">
          🚨 Delivery has arrived! Crates are ready for confirmation.
          <button
            className="btn btn-primary"
            onClick={() => { setArrivalAlert(false); setTab("delivery"); }}
          >
            Go to Delivery
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => setArrivalAlert(false)}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ── NAV ─────────────────────────────────────────────────── */}
      <nav>
        <div className="logo">Sales <span>Dept</span></div>

        <div className="nav-tabs">
          <div className={`nav-tab ${tab === "stock"    ? "active" : ""}`} onClick={() => setTab("stock")}>Stock</div>
          <div className={`nav-tab ${tab === "delivery" ? "active" : ""}`} onClick={() => setTab("delivery")}>
            Delivery {deliveries.some(d => d.status === "awaiting_sales_confirmation") && "🔴"}
          </div>
          <div className={`nav-tab ${tab === "customers" ? "active" : ""}`} onClick={() => setTab("customers")}>Customers</div>
        </div>

        <LogoutButton />
      </nav>

      <div className="container">

        {/* ══════════════════════════════════════════════════════════
            STOCK TAB
            Shows every product with: produced today, sold today,
            at market, at store, and remaining market value in KES.
            All columns come from live data — updates in real time.
        ══════════════════════════════════════════════════════════ */}
        {tab === "stock" && (
    <div className="card">
      <div className="card-title">Live Stock Dashboard</div>

      {/* ── SUMMARY METRIC CARDS ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "12px", marginBottom: "1.5rem" }}>
        {[
          { label: "Produced today", value: Object.values(todayProdMap).reduce((s, v) => s + v, 0) },
          { label: "Sold today",     value: Object.values(todaySalesMap).reduce((s, v) => s + (v.quantity || 0), 0) },
          { label: "At market",      value: marketStock.reduce((s, i) => s + (i.quantity_cakes ?? 0), 0) },
          { label: "At store",       value: storeStock.reduce((s, i) => s + (i.quantity_cakes ?? 0), 0) },
          {
            label: "Market value",
            value: "KES " + marketStock.reduce((s, i) => {
              const p = products.find(p => p.id === i.product_id);
              return s + (i.quantity_cakes ?? 0) * (p?.retail_price || 0);
            }, 0).toLocaleString(),
          },
        ].map((m) => (
          <div key={m.label} style={{color: "var(--color-text, #333)", background: "var(--color-background-secondary, #f5f5f5)", borderRadius: "8px", padding: "1rem" }}>
            <p style={{ fontSize: "12px", color: "var(--color-text-secondary)", margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.04em" }}>{m.label}</p>
            <p style={{ fontSize: "22px", fontWeight: 500, margin: 0 }}>{m.value}</p>
          </div>
        ))}
      </div>

      {/* ── TABLE ── */}
      <div style={{ border: "0.5px solid #e0e0e0", borderRadius: "12px", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
          <thead>
            <tr style={{color: "var(--color-text, #333)", background: "var(--color-background-secondary, #f5f5f5)" }}>
              {["Product", "Produced", "Sold", "At market", "At store", "Market value"].map(h => (
                <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: "12px", fontWeight: 500, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: "0.5px solid #e0e0e0" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {products.map((p) => {
              const mkt      = marketStock.find((i) => i.product_id === p.id);
              const str      = storeStock.find((i) => i.product_id === p.id);
              const produced = todayProdMap[p.id] || 0;
              const sold     = todaySalesMap[p.id]?.quantity || 0;
              const mktCakes = mkt?.quantity_cakes ?? 0;
              const strCakes = str?.quantity_cakes ?? 0;
              const value    = mktCakes * (p.retail_price || 0);
              const rate     = produced > 0 ? Math.round((sold / produced) * 100) : 0;
              const badgeColor = mktCakes < 10 ? { bg: "#FCEBEB", text: "#A32D2D" }
                              : mktCakes < 25  ? { bg: "#FAEEDA", text: "#854F0B" }
                              :                  { bg: "#EAF3DE", text: "#3B6D11" };
              return (
                <tr key={p.id} style={{ borderBottom: "0.5px solid #e0e0e0" }}>
                  <td style={{ padding: "12px 14px", fontWeight: 500 }}>{p.name}</td>
                  <td style={{ padding: "12px 14px" }}>{produced}</td>
                  <td style={{ padding: "12px 14px" }}>
                    {sold} <span style={{ fontSize: "11px", opacity: 0.6 }}>({rate}%)</span>
                  </td>
                  <td style={{ padding: "12px 14px" }}>
                    <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: "999px", fontSize: "12px", fontWeight: 500, background: badgeColor.bg, color: badgeColor.text }}>
                      {mktCakes}
                    </span>
                  </td>
                  <td style={{ padding: "12px 14px" }}>{strCakes}</td>
                  <td style={{ padding: "12px 14px", fontWeight: 500, color: "#185FA5" }}>KES {value.toLocaleString()}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  )}


        {/* ══════════════════════════════════════════════════════════
            DELIVERY TAB
            Lists active deliveries. Opening one shows either:
            - The confirmation form (awaiting_sales_confirmation)
            - The return form (at_market)
        ══════════════════════════════════════════════════════════ */}
        {tab === "delivery" && (
          <div className="card">
            <div className="card-title">Active Deliveries</div>

            {deliveries.length === 0 && (
              <p>No active deliveries right now.</p>
            )}

            {deliveries.map((d) => (
              <div key={d.id} className="row-item">
                <span className={`badge badge-${d.status}`}>{d.status.replace(/_/g, " ")}</span>
                <button
                  className="btn btn-secondary"
                  onClick={() => setSelectedDelivery(d)}
                >
                  Open
                </button>
              </div>
            ))}

            {/* ── CONFIRM RECEIPT FORM ── */}
            {selectedDelivery && selectedDelivery.status === "awaiting_sales_confirmation" && (
              <form onSubmit={handleConfirmDelivery}>
                <div className="divider" />
                <div className="card-title">Confirm What You Received</div>

                {selectedDelivery.delivery_items.map((item) => (
                  <div key={item.id} className="form-group">
                    <label>
                      {item.products?.name} — Driver sent: <strong>{item.crates_sent} crates</strong>
                    </label>
                    <input
                      type="number"
                      className="input"
                      placeholder="Crates you physically counted"
                      min="0"
                      max={item.crates_sent}
                      onChange={(e) => updateReceived(item.product_id, e.target.value)}
                    />
                    <input
                      type="number"
                      className="input"
                      placeholder="Broken cakes in this crate"
                      min="0"
                      onChange={(e) => updateItemBroken(item.product_id, e.target.value)}
                    />
                  </div>
                ))}

                <input
                  type="number"
                  className="input"
                  placeholder="Total broken cakes across all crates"
                  min="0"
                  onChange={(e) => setDeliveryBroken(Number(e.target.value))}
                />

                <button className="btn btn-primary btn-full" disabled={loading}>
                  {loading ? "Confirming..." : "Confirm Delivery"}
                </button>
              </form>
            )}

            {/* ── PREPARE RETURN FORM ── */}
            {selectedDelivery && selectedDelivery.status === "at_market" && (
              <form onSubmit={handleReturn}>
                <div className="divider" />
                <div className="card-title">Prepare Return to Driver</div>

                <input
                  type="number"
                  className="input"
                  placeholder="Empty crates you are handing back"
                  value={returnEmpty}
                  min="0"
                  onChange={(e) => setReturnEmpty(e.target.value)}
                />

                <input
                  type="number"
                  className="input"
                  placeholder="Crates still holding unsold cakes"
                  value={returnWithCakes}
                  min="0"
                  onChange={(e) => setReturnWithCakes(e.target.value)}
                />

                <button className="btn btn-secondary btn-full" disabled={loading}>
                  {loading ? "Submitting..." : "Submit Return"}
                </button>
              </form>
            )}
          </div>
        )}


        {/* ══════════════════════════════════════════════════════════
            CUSTOMERS TAB
            Search → select customer → see balance →
            build cart → complete sale → exchange
        ══════════════════════════════════════════════════════════ */}
        {tab === "customers" && (
          <div className="card">

            {/* ── SEARCH ── */}
            <div className="search-bar">
              <input
                placeholder="Search customer by name (Mpesa name)"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
              <button className="btn btn-primary" onClick={handleSearch}>
                Search
              </button>
            </div>

            {results.map((c) => (
              <div
                key={c.id}
                className="row-item"
                onClick={() => selectCustomer(c)}
                style={{ cursor: "pointer" }}
              >
                <span>{c.name}</span>
                {c.phone && <span style={{ opacity: 0.6 }}>{c.phone}</span>}
              </div>
            ))}

            {/* ── CUSTOMER PANEL ── */}
            {customer && (
              <>
                <div className="divider" />

                {/* Customer name + balance */}
                <div className="card-title">{customer.name}</div>
                <div className="balance-display">
                  <span>Balance: </span>
                  {balance === null ? (
                    <span>Loading...</span>
                  ) : (
                    <span style={{ color: balance >= 0 ? "green" : "red", fontWeight: "bold" }}>
                      KES {Number(balance).toFixed(2)}
                      {balance < 0 && " — OWES MONEY"}
                    </span>
                  )}
                </div>

                <div className="divider" />

                {/* ── SALE TYPE ── applies to whole cart */}
                <div className="card-title">New Sale</div>
                <div className="form-group">
                  <label>Sale Type (applies to entire cart)</label>
                  <select
                    className="input"
                    value={saleType}
                    onChange={(e) => handleSaleTypeChange(e.target.value)}
                  >
                    <option value="retail">Retail — KES per unit</option>
                    <option value="wholesale">Wholesale — KES per unit</option>
                  </select>
                </div>

                {/* ── ADD ITEM TO CART ── */}
                <div className="form-group">
                  <label>Add product to cart</label>
                  <select
                    className="input"
                    value={cartProduct || ""}
                    onChange={(e) => setCartProduct(e.target.value || null)}
                  >
                    <option value="">— Select product —</option>
                    {products.map((p) => {
                      const price = saleType === "retail" ? p.retail_price : p.wholesale_price;
                      return (
                        <option key={p.id} value={p.id}>
                          {p.name} @ KES {price}
                        </option>
                      );
                    })}
                  </select>
                  <input
                    type="number"
                    className="input"
                    placeholder="Quantity"
                    min="1"
                    value={cartQty}
                    onChange={(e) => setCartQty(e.target.value)}
                  />
                  <button className="btn btn-secondary" onClick={addToCart}>
                    + Add to Cart
                  </button>
                </div>

                {/* ── CART DISPLAY ── */}
                {cart.length > 0 && (
                  <div className="cart">
                    <div className="card-title">Cart</div>

                    {cart.map((item) => (
                      <div key={item.product_id} className="row-item">
                        <span>
                          {item.name} × {item.quantity}{" "}
                          <span style={{ opacity: 0.6 }}>
                            @ KES {item.price_per_unit} = KES {item.subtotal.toFixed(2)}
                          </span>
                        </span>
                        <button
                          className="btn btn-danger"
                          onClick={() => removeFromCart(item.product_id)}
                        >
                          Remove
                        </button>
                      </div>
                    ))}

                    <div className="divider" />

                    {/* Running totals */}
                    <div className="row-item">
                      <span>Cart Total:</span>
                      <strong>KES {cartTotal.toFixed(2)}</strong>
                    </div>
                    <div className="row-item">
                      <span>Balance After Sale:</span>
                      <strong style={{ color: cartIsAffordable ? "green" : "red" }}>
                        KES {balanceAfterCart.toFixed(2)}
                      </strong>
                    </div>

                    {!cartIsAffordable && (
                      <div style={{ color: "red", marginTop: "8px" }}>
                        ⛔ Customer needs KES {Math.abs(balanceAfterCart).toFixed(2)} more before this sale can go through.
                      </div>
                    )}

                    <button
                      className="btn btn-primary btn-full"
                      onClick={handleCompleteSale}
                      disabled={loading || !cartIsAffordable}
                      style={{ marginTop: "12px" }}
                    >
                      {loading ? "Processing..." : "✅ Complete Sale"}
                    </button>
                  </div>
                )}

                <div className="divider" />

                {/* ── EXCHANGE SECTION ── */}
                <div className="card-title">Process Exchange</div>

                <select
                  className="input"
                  value={exchangeProduct || ""}
                  onChange={(e) => setExchangeProduct(e.target.value || null)}
                >
                  <option value="">— Select product to exchange —</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>

                <input
                  type="number"
                  className="input"
                  placeholder="Quantity being returned"
                  min="1"
                  value={exchangeQty}
                  onChange={(e) => setExchangeQty(e.target.value)}
                />

                <input
                  className="input"
                  placeholder="Reason (e.g. wrong type, damaged)"
                  value={exchangeReason}
                  onChange={(e) => setExchangeReason(e.target.value)}
                />

                <button
                  className="btn btn-secondary btn-full"
                  disabled={loading}
                  onClick={handleExchange}
                >
                  {loading ? "Processing..." : "Process Exchange"}
                </button>
              </>
            )}

          </div>
        )}

      </div>
    </div>
  );
}
