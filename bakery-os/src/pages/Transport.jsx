import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import {
  startDelivery,
  completeDelivery,
  getActiveDeliveries,
} from "../services/deliveryService";

const DEFAULT_USER_ID = "e18eb419f-0427-4fbc-9f48-ab0eee711e1f";

export default function Transport() {
  const [products, setProducts] = useState([]);
  const [deliveries, setDeliveries] = useState([]);

  const [product, setProduct] = useState("");
  const [crates, setCrates] = useState(0);

  const [selectedDelivery, setSelectedDelivery] = useState(null);
  const [receivedCrates, setReceivedCrates] = useState(0);
  const [broken, setBroken] = useState(0);

  // Load products + deliveries
  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const { data: p } = await supabase.from("products").select("*");
    setProducts(p || []);

    const d = await getActiveDeliveries();
    setDeliveries(d || []);
  }

  // Start delivery
  async function handleStart(e) {
    e.preventDefault();

    try {
      await startDelivery({
        product_id: product,
        delivery_user_id: DEFAULT_USER_ID,
        crates_sent: Number(crates),
      });

      alert("Delivery started");
      setCrates(0);
      loadData();
    } catch (err) {
      alert(err.message);
    }
  }

  // Complete delivery
  async function handleComplete(e) {
    e.preventDefault();

    try {
      await completeDelivery({
        delivery_id: selectedDelivery.id,
        product_id: selectedDelivery.product_id,
        crates_received: Number(receivedCrates),
        broken_cakes: Number(broken),
      });

      alert("Delivery completed");
      setSelectedDelivery(null);
      loadData();
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <div className="container">
      <div className="section-header">
        <div className="section-title">
          <span>Department</span>
          Transport
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-title">Start Delivery</div>
          <form onSubmit={handleStart}>
            <div className="form-group">
              <label>Product</label>
              <select
                className="input"
                onChange={(e) => setProduct(e.target.value)}
                value={product}
                required
              >
                <option value="">Select Product</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Crates</label>
              <input
                className="input"
                type="number"
                placeholder="Crates"
                value={crates}
                onChange={(e) => setCrates(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="btn btn-primary btn-full">
              Start Delivery
            </button>
          </form>
        </div>

        <div className="card">
          <div className="card-title">Complete Delivery</div>
          {selectedDelivery ? (
            <form onSubmit={handleComplete}>
              <div className="form-group">
                <label>Crates Received</label>
                <input
                  className="input"
                  type="number"
                  placeholder="Crates received"
                  value={receivedCrates}
                  onChange={(e) => setReceivedCrates(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>Broken Cakes</label>
                <input
                  className="input"
                  type="number"
                  placeholder="Broken cakes"
                  value={broken}
                  onChange={(e) => setBroken(e.target.value)}
                  required
                />
              </div>

              <button type="submit" className="btn btn-secondary btn-full">
                Complete Delivery
              </button>
            </form>
          ) : (
            <p className="empty">Select an active delivery to complete</p>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: '1.5rem' }}>
        <div className="card-title">Active Deliveries</div>
        <div className="card-content">
          {deliveries.length === 0 ? (
            <p className="empty">No active deliveries</p>
          ) : (
            deliveries.map((d) => (
              <div key={d.id} className="row-item">
                <span>
                  Product ID: {d.product_id} — {d.crates_sent} crates
                </span>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setSelectedDelivery(d)}
                >
                  Complete
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}