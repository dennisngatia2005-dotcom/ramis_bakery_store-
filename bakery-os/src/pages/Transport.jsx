
import { useEffect, useState, useCallback } from "react";
import { supabase } from "../supabaseClient";
import LogoutButton from "../components/LogoutButton";
import { createDelivery, startDelivery, arriveDelivery, confirmReturn, getActiveDeliveries } from "../services/deliveryService";

export default function Transport() {
  const [storeStock, setStoreStock] = useState([]);
  const [selected, setSelected] = useState({});
  const [delivery, setDelivery] = useState(null);
  const [timer, setTimer] = useState("");
  const [returnMap, setReturnMap] = useState({});

  const loadData = useCallback(async () => {
    try {
      const { data: store } = await supabase.from("inventory_locations").select("id").eq("name", "store").maybeSingle();
      if (store) {
        const { data: stock } = await supabase.from("inventory").select(`*, products(name)`).eq("location_id", store.id);
        setStoreStock(stock || []);
      }
      const active = await getActiveDeliveries();
      setDelivery(active?.[0] || null);
    } catch (err) { console.error(err); }
  }, []);

  useEffect(() => {
    loadData();
    const channel = supabase.channel("transport-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "deliveries" }, loadData)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadData]);

  useEffect(() => {
    let interval;
    if (delivery?.status === "in_transit" && delivery?.departed_at) {
      interval = setInterval(() => {
        const start = new Date(delivery.departed_at);
        const diff = Math.floor((new Date() - start) / 1000);
        if (diff < 0) return;
        setTimer(`${Math.floor(diff / 60)}m ${diff % 60}s`);
      }, 1000);
    } else { setTimer(""); }
    return () => clearInterval(interval);
  }, [delivery?.status, delivery?.departed_at]);

  async function handleCollect() {
    try {
      const items = Object.entries(selected)
        .filter(([_, qty]) => Number(qty) > 0)
        .map(([pid, qty]) => ({ product_id: pid, crates: Number(qty) }));
      
      if (items.length === 0) return alert("Select crates first");
      await createDelivery(items);
      setSelected({});
      loadData();
    } catch (err) { alert(err.message); }
  }

  async function handleReturn() {
    try {
      const returns = delivery.delivery_items.map((item) => ({
        item_id: item.id,
        product_id: item.product_id,
        returned: Number(returnMap[item.id] || 0),
        with_cakes: Number(returnMap[`${item.id}_cakes`] || 0)
      }));
      await confirmReturn(delivery.id, returns);
      setReturnMap({});
      loadData();
    } catch (err) { alert(err.message); }
  }

  return (
    <div className="container">
      <div className="section-header">
        <div className="section-title">Transport Dashboard</div>
        <LogoutButton />
      </div>

      <div className="card">
        {/* STEP 1: COLLECTION */}
        {!delivery && (
          <>
            <div className="card-title">Store Stock</div>
            {storeStock.map((item) => (
              <div key={item.id} className="form-group">
                <label>{item.products?.name} ({item.quantity_crates || 0} crates)</label>
                <input 
                  className="input" 
                  type="number" 
                  value={selected[item.product_id] || ""} 
                  placeholder="0" 
                  onChange={(e) => setSelected({...selected, [item.product_id]: e.target.value})} 
                />
              </div>
            ))}
            <button className="btn btn-primary btn-full" onClick={handleCollect}>🚚 Collect & Start</button>
          </>
        )}

        {/* STEP 2: COLLECTED */}
        {delivery?.status === "collected" && (
          <button className="btn btn-primary btn-full" onClick={() => startDelivery(delivery.id)}>Start Delivery</button>
        )}

        {/* STEP 3: IN TRANSIT */}
        {delivery?.status === "in_transit" && (
          <>
            <div className="timer-display">⏱ {timer}</div>
            <button className="btn btn-primary btn-full" onClick={() => arriveDelivery(delivery.id)}>Arrived</button>
          </>
        )}

        {/* STEP 4: WAITING FOR SALES */}
        {delivery?.status === "awaiting_sales_confirmation" && (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <span style={{ fontSize: '30px' }}>⏳</span>
            <p style={{ marginTop: '10px' }}>Waiting for sales confirmation...</p>
          </div>
        )}

        {/* STEP 5: AT MARKET */}
        {delivery?.status === "at_market" && (
           <div style={{ textAlign: 'center', padding: '20px' }}>
            <span style={{ fontSize: '30px' }}>📦</span>
            <p style={{ marginTop: '10px' }}>Sales ongoing at market</p>
          </div>
        )}

        {/* STEP 6: RETURN */}
        {delivery?.status === "awaiting_return" && (
          <>
            <div className="card-title">Confirm Return</div>
            {delivery.delivery_items.map((item) => (
              <div key={item.id} className="form-group">
                <label>{item.products?.name}</label>
                <input className="input" type="number" placeholder="Crates returned" onChange={(e) => setReturnMap({...returnMap, [item.id]: e.target.value})} />
                <input className="input" type="number" placeholder="Crates with cakes" style={{marginTop:'5px'}} onChange={(e) => setReturnMap({...returnMap, [`${item.id}_cakes`]: e.target.value})} />
              </div>
            ))}
            <button className="btn btn-secondary btn-full" onClick={handleReturn}>Confirm Return</button>
          </>
        )}
      </div>
    </div>
  );
}
