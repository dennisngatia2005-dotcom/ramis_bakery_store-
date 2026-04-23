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
    <div>
      <h2>Transport</h2>

      {/* START DELIVERY */}
      <form onSubmit={handleStart}>
        <h3>Start Delivery</h3>

        <select onChange={(e) => setProduct(e.target.value)}>
          <option>Select Product</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        <input
          type="number"
          placeholder="Crates"
          value={crates}
          onChange={(e) => setCrates(e.target.value)}
        />

        <button type="submit">Start</button>
      </form>

      {/* ACTIVE DELIVERIES */}
      <h3>Active Deliveries</h3>
      {deliveries.map((d) => (
        <div key={d.id}>
          <p>
            Product ID: {d.product_id} — {d.crates_sent} crates
        </p>
          <button onClick={() => setSelectedDelivery(d)}>
            Complete
          </button>
        </div>
      ))}

      {/* COMPLETE DELIVERY */}
      {selectedDelivery && (
        <form onSubmit={handleComplete}>
          <h3>Complete Delivery</h3>

          <input
            type="number"
            placeholder="Crates received"
            value={receivedCrates}
            onChange={(e) => setReceivedCrates(e.target.value)}
          />

          <input
            type="number"
            placeholder="Broken cakes"
            value={broken}
            onChange={(e) => setBroken(e.target.value)}
          />

          <button type="submit">Finish</button>
        </form>
      )}
    </div>
  );
}