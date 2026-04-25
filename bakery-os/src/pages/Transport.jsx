import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import LogoutButton from "../components/LogoutButton";

import {
  collectCrates,
  startDelivery,
  arriveDelivery,
  confirmReturn,
  getActiveDeliveries,
} from "../services/deliveryService";

export default function Transport() {
  const [products, setProducts] = useState([]);
  const [delivery, setDelivery] = useState(null);

  const [product, setProduct] = useState("");
  const [crates, setCrates] = useState(0);
  const [returnCrates, setReturnCrates] = useState(0);

  const [timer, setTimer] = useState("");

  useEffect(() => {
    loadData();

    const channel = supabase
      .channel("transport-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "deliveries" },
        () => loadData()
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  useEffect(() => {
    if (delivery?.status === "in_transit") {
      const interval = setInterval(() => {
        const start = new Date(delivery.departed_at);
        const now = new Date();
        const diff = Math.floor((now - start) / 1000);
        const mins = Math.floor(diff / 60);
        const secs = diff % 60;
        setTimer(`${mins}m ${secs}s`);
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [delivery]);

  async function loadData() {
    const { data: p } = await supabase.from("products").select("*");
    setProducts(p || []);

    const d = await getActiveDeliveries();
    setDelivery(d[0] || null);
  }

  async function handleCollect(e) {
    e.preventDefault();
    const d = await collectCrates({
      product_id: product,
      crates: Number(crates),
    });
    setDelivery(d);
  }

  async function handleStart() {
    await startDelivery(delivery.id);
  }

  async function handleArrive() {
    await arriveDelivery(delivery.id);
  }

  async function handleReturn(e) {
    e.preventDefault();
    await confirmReturn({
      delivery_id: delivery.id,
      product_id: delivery.product_id,
      crates_returned: Number(returnCrates),
    });
    setDelivery(null);
  }

  return (
    <div className="container">
      <div className="section-header">
        <div className="section-title">
          <span>Department</span>
          Transport
        </div>
        <LogoutButton />
      </div>

      <div className="card">
        {!delivery && (
          <>
            <h3>Collect Crates</h3>

            <form onSubmit={handleCollect}>
              <select className="input" onChange={(e) => setProduct(e.target.value)}>
                <option>Select Product</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>

              <input
                className="input"
                type="number"
                placeholder="Crates"
                value={crates}
                onChange={(e) => setCrates(e.target.value)}
              />

              <button className="btn btn-primary btn-full">
                Collect Crates
              </button>
            </form>
          </>
        )}

        {delivery?.status === "collected" && (
          <button className="btn btn-primary btn-full" onClick={handleStart}>
            Start Delivery
          </button>
        )}

        {delivery?.status === "in_transit" && (
          <>
            <p>⏱ {timer}</p>
            <button className="btn btn-primary btn-full" onClick={handleArrive}>
              Arrived
            </button>
          </>
        )}

        {delivery?.status === "at_market" && (
          <form onSubmit={handleReturn}>
            <input
              className="input"
              type="number"
              placeholder="Empty Crates"
              value={returnCrates}
              onChange={(e) => setReturnCrates(e.target.value)}
            />
            <button className="btn btn-secondary btn-full">
              Confirm Return
            </button>
          </form>
        )}
      </div>
    </div>
  );
}