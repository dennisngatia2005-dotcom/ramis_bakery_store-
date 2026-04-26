import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import LogoutButton from "../components/LogoutButton";

import {
  createDelivery,
  startDelivery,
  arriveDelivery,
  confirmReturn,
  getActiveDeliveries,
} from "../services/deliveryService";

export default function Transport() {
  const [storeStock, setStoreStock] = useState([]);
  const [selected, setSelected] = useState({});
  const [delivery, setDelivery] = useState(null);
  const [timer, setTimer] = useState("");

  const [returnMap, setReturnMap] = useState({});

  useEffect(() => {
    loadData();

    const channel = supabase
      .channel("transport-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "deliveries" },
        loadData
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  useEffect(() => {
    if (delivery?.status === "in_transit") {
      const interval = setInterval(() => {
        const start = new Date(delivery.departed_at);
        const diff = Math.floor((new Date() - start) / 1000);

        const mins = Math.floor(diff / 60);
        const secs = diff % 60;

        setTimer(`${mins}m ${secs}s`);
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [delivery]);

  async function loadData() {
    try {
      const { data: store } = await supabase
        .from("inventory_locations")
        .select("*")
        .eq("name", "store")
        .single();

      const { data } = await supabase
        .from("inventory")
        .select(`*, products(name)`)
        .eq("location_id", store.id);

      setStoreStock(data || []);

      const { data: d } = await supabase
        .from("deliveries")
        .select(`
          *,
          delivery_items(*, products(name))
        `)
        .neq("status", "completed")
        .order("created_at", { ascending: false });

      setDelivery(d?.[0] || null);

    } catch (err) {
      console.error("LOAD ERROR:", err);
    }
  }

  function updateSelection(product_id, value) {
    setSelected((prev) => ({
      ...prev,
      [product_id]: Number(value),
    }));
  }

  function updateReturn(item_id, value) {
    setReturnMap((prev) => ({
      ...prev,
      [item_id]: Number(value),
    }));
  }

  async function handleCollect() {
    try {
      const items = Object.entries(selected)
        .filter(([_, qty]) => qty > 0)
        .map(([product_id, crates]) => ({
          product_id,
          crates,
        }));

      if (items.length === 0) {
        alert("Select crates first");
        return;
      }

      const d = await createDelivery(items);
      setDelivery(d);
      setSelected({});

    } catch (err) {
      console.error(err);
      alert(err.message);
    }
  }

  async function handleReturn() {
    try {
      const returns = delivery.delivery_items.map((item) => ({
        item_id: item.id,
        product_id: item.product_id,
        returned: returnMap[item.id] || 0,
        with_cakes: item.crates_with_cakes || 0,
      }));

      await confirmReturn(delivery.id, returns);

      alert("Return completed");
      setDelivery(null);
      setReturnMap({});

    } catch (err) {
      console.error(err);
      alert(err.message);
    }
  }

  return (
    <div className="container">
      <div className="section-header">
        <div className="section-title">Transport</div>
        <LogoutButton />
      </div>

      <div className="card">

        {/* STEP 1 */}
        {!delivery && (
          <>
            <div className="card-title">Store Stock</div>

            {storeStock.map((item) => (
              <div key={item.id} className="form-group">
                <label>
                  {item.products?.name} ({item.quantity_crates} crates)
                </label>
                <input
                  className="input"
                  type="number"
                  placeholder="Crates to take"
                  onChange={(e) =>
                    updateSelection(item.product_id, e.target.value)
                  }
                />
              </div>
            ))}

            <button className="btn btn-primary btn-full" onClick={handleCollect}>
              🚚 Collect & Start Trip
            </button>
          </>
        )}

        {/* STEP 2 */}
        {delivery?.status === "collected" && (
          <button
            className="btn btn-primary btn-full"
            onClick={() => startDelivery(delivery.id)}
          >
            Start Delivery
          </button>
        )}

        {/* STEP 3 */}
        {delivery?.status === "in_transit" && (
          <>
            <div className="timer-display">{timer}</div>
            <button
              className="btn btn-primary btn-full"
              onClick={() => arriveDelivery(delivery.id)}
            >
              Arrived
            </button>
          </>
        )}

        {/* WAIT */}
        {delivery?.status === "awaiting_sales_confirmation" && (
          <p>⏳ Waiting for sales confirmation...</p>
        )}

        {/* SALES DONE */}
        {delivery?.status === "at_market" && (
          <p>📦 Sales ongoing at market</p>
        )}

        {/* STEP 6 — RETURN */}
        {delivery?.status === "awaiting_return" && (
          <>
            <div className="card-title">Confirm Return</div>

            {delivery.delivery_items.map((item) => (
              <div key={item.id} className="form-group">
                <label>
                  {item.products?.name}
                </label>
                <input
                  className="input"
                  type="number"
                  placeholder="Crates returned"
                  onChange={(e) =>
                    updateReturn(item.id, e.target.value)
                  }
                />
              </div>
            ))}

            <button
              className="btn btn-secondary btn-full"
              onClick={handleReturn}
            >
              Confirm Return
            </button>
          </>
        )}

      </div>
    </div>
  );
}