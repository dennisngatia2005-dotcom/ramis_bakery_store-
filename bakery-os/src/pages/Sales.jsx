import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import LogoutButton from "../components/LogoutButton";

import {
  getActiveSalesDeliveries,
  confirmDelivery,
  prepareReturn,
  findCustomer,
  getCustomerBalance,
  processSale,
} from "../services/salesService";

export default function Sales() {
  const [deliveries, setDeliveries] = useState([]);
  const [selectedDelivery, setSelectedDelivery] = useState(null);

  const [receivedMap, setReceivedMap] = useState({});
  const [broken, setBroken] = useState(0);

  const [returnEmpty, setReturnEmpty] = useState(0);
  const [returnWithCakes, setReturnWithCakes] = useState(0);

  const [products, setProducts] = useState([]);

  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);
  const [customer, setCustomer] = useState(null);
  const [balance, setBalance] = useState(0);

  const [product, setProduct] = useState("");
  const [qty, setQty] = useState(0);
  const [type, setType] = useState("retail");

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();

    const channel = supabase
      .channel("sales-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "deliveries" },
        loadData
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  async function loadData() {
    try {
      const d = await getActiveSalesDeliveries();
      setDeliveries(d);

      const { data: p } = await supabase.from("products").select("*");
      setProducts(p || []);
    } catch (err) {
      console.error("LOAD DATA ERROR:", err);
    }
  }

  /* =========================
     DELIVERY CONFIRMATION
  ========================= */

  function updateReceived(product_id, value) {
    setReceivedMap((prev) => ({
      ...prev,
      [product_id]: Number(value),
    }));
  }

  async function handleConfirmDelivery(e) {
    e.preventDefault();

    try {
      setLoading(true);

      const items = selectedDelivery.delivery_items.map((item) => ({
        product_id: item.product_id,
        crates_received: receivedMap[item.product_id] || 0,
      }));

      await confirmDelivery({
        delivery_id: selectedDelivery.id,
        items,
        broken_cakes: Number(broken),
      });

      alert("Delivery confirmed");

      setSelectedDelivery(null);
      setReceivedMap({});
      setBroken(0);

      loadData();

    } catch (err) {
      console.error(err);
      alert(err.message);
    } finally {
      setLoading(false);
    }
  }

  /* =========================
     RETURN PREPARATION
  ========================= */

  async function handlePrepareReturn(e) {
    e.preventDefault();

    try {
      setLoading(true);

      await prepareReturn({
        delivery_id: selectedDelivery.id,
        empty_crates: Number(returnEmpty),
        crates_with_cakes: Number(returnWithCakes),
      });

      alert("Return prepared");

      setSelectedDelivery(null);
      setReturnEmpty(0);
      setReturnWithCakes(0);

      loadData();

    } catch (err) {
      console.error(err);
      alert(err.message);
    } finally {
      setLoading(false);
    }
  }

  /* =========================
     CUSTOMER SEARCH
  ========================= */

  async function handleSearch() {
    try {
      const res = await findCustomer(search);
      setResults(res);
    } catch (err) {
      console.error(err);
    }
  }

  async function selectCustomer(c) {
    try {
      setCustomer(c);
      const bal = await getCustomerBalance(c.id);
      setBalance(bal);
    } catch (err) {
      console.error(err);
    }
  }

  /* =========================
     SALES PROCESSING
  ========================= */

  async function handleSale(e) {
    e.preventDefault();

    try {
      setLoading(true);

      const price =
        type === "retail"
          ? products.find((p) => p.id === product)?.retail_price
          : products.find((p) => p.id === product)?.wholesale_price;

      await processSale({
        customer_id: customer.id,
        product_id: product,
        quantity: Number(qty),
        price,
        sale_type: type,
      });

      alert("Sale successful");

      const bal = await getCustomerBalance(customer.id);
      setBalance(bal);
      setQty(0);

    } catch (err) {
      console.error(err);
      alert(err.message);
    } finally {
      setLoading(false);
    }
  }

  /* =========================
     UI
  ========================= */

  return (
    <div className="container">
      <div className="section-header">
        <div className="section-title">
          <span>Department</span>
          Sales
        </div>
        <LogoutButton />
      </div>

      {/* ================= DELIVERY SECTION ================= */}
      <div className="card">
        <h3>Deliveries</h3>

        {deliveries.length === 0 && <p>No active deliveries</p>}

        {deliveries.map((d) => (
          <div key={d.id} className="row-item">
            <strong>{d.status}</strong>
            <button onClick={() => setSelectedDelivery(d)}>
              Open
            </button>
          </div>
        ))}
      </div>

      {/* ================= CONFIRM DELIVERY ================= */}
      {selectedDelivery?.status === "awaiting_sales_confirmation" && (
        <div className="card">
          <h3>Confirm Delivery</h3>

          <form onSubmit={handleConfirmDelivery}>
            {selectedDelivery.delivery_items.map((item) => (
              <div key={item.id} className="form-group">
                <label>
                  {item.products.name} (sent: {item.crates_sent})
                </label>
                <input
                  className="input"
                  type="number"
                  placeholder="Crates received"
                  onChange={(e) =>
                    updateReceived(item.product_id, e.target.value)
                  }
                />
              </div>
            ))}

            <input
              className="input"
              type="number"
              placeholder="Broken cakes"
              value={broken}
              onChange={(e) => setBroken(e.target.value)}
            />

            <button className="btn btn-primary btn-full" disabled={loading}>
              {loading ? "Processing..." : "Confirm Delivery"}
            </button>
          </form>
        </div>
      )}

      {/* ================= RETURN SECTION ================= */}
      {selectedDelivery?.status === "at_market" && (
        <div className="card">
          <h3>Prepare Return (Optional)</h3>

          <form onSubmit={handlePrepareReturn}>
            <input
              className="input"
              type="number"
              placeholder="Empty crates"
              value={returnEmpty}
              onChange={(e) => setReturnEmpty(e.target.value)}
            />

            <input
              className="input"
              type="number"
              placeholder="Crates with cakes"
              value={returnWithCakes}
              onChange={(e) => setReturnWithCakes(e.target.value)}
            />

            <button className="btn btn-secondary btn-full" disabled={loading}>
              {loading ? "Processing..." : "Submit Return"}
            </button>
          </form>
        </div>
      )}

      {/* ================= CUSTOMER SALES ================= */}
      <div className="card">
        <h3>Sales</h3>

        <input
          className="input"
          placeholder="Search customer"
          onChange={(e) => setSearch(e.target.value)}
        />
        <button className="btn btn-secondary" onClick={handleSearch}>
          Search
        </button>

        {results.map((c) => (
          <div key={c.id} onClick={() => selectCustomer(c)}>
            {c.name}
          </div>
        ))}

        {customer && (
          <>
            <p><strong>{customer.name}</strong></p>
            <p>Balance: KES {balance}</p>

            <form onSubmit={handleSale}>
              <select
                className="input"
                onChange={(e) => setProduct(e.target.value)}
              >
                <option>Select product</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>

              <input
                className="input"
                type="number"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
              />

              <select
                className="input"
                onChange={(e) => setType(e.target.value)}
              >
                <option value="retail">Retail</option>
                <option value="wholesale">Wholesale</option>
              </select>

              <button className="btn btn-primary btn-full" disabled={loading}>
                {loading ? "Processing..." : "Sell"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}