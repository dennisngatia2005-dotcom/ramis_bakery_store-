import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import LogoutButton from "../components/LogoutButton";

import {
  getArrivedDeliveries,
  confirmDelivery,
  findCustomer,
  getCustomerBalance,
  processSale,
} from "../services/salesService";

export default function Sales() {
  const [deliveries, setDeliveries] = useState([]);
  const [selected, setSelected] = useState(null);

  const [crates, setCrates] = useState(0);
  const [broken, setBroken] = useState(0);

  const [products, setProducts] = useState([]);

  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);
  const [customer, setCustomer] = useState(null);
  const [balance, setBalance] = useState(0);

  const [product, setProduct] = useState("");
  const [qty, setQty] = useState(0);
  const [type, setType] = useState("retail");

  useEffect(() => {
    loadData();

    const channel = supabase
      .channel("sales-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "deliveries" },
        () => loadData()
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  async function loadData() {
    setDeliveries(await getArrivedDeliveries());

    const { data: p } = await supabase.from("products").select("*");
    setProducts(p || []);
  }

  async function handleConfirm(e) {
    e.preventDefault();

    await confirmDelivery({
      delivery_id: selected.id,
      product_id: selected.product_id,
      crates_received: Number(crates),
      broken_cakes: Number(broken),
    });

    setSelected(null);
  }

  async function handleSearch() {
    const res = await findCustomer(search);
    setResults(res);
  }

  async function selectCustomer(c) {
    setCustomer(c);
    setBalance(await getCustomerBalance(c.id));
  }

  async function handleSale(e) {
    e.preventDefault();

    const price = type === "retail" ? 50 : 43;

    await processSale({
      customer_id: customer.id,
      product_id: product,
      quantity: Number(qty),
      price,
      sale_type: type,
    });

    setBalance(await getCustomerBalance(customer.id));
    setQty(0);
  }

  return (
    <div className="container">
      <div className="section-title">
        <LogoutButton /> Sales
      </div>

      {/* Deliveries */}
      <div className="card">
        <h3>Incoming Deliveries</h3>

        {deliveries.map(d=>(
          <div key={d.id} className="row-item">
            {d.crates_sent} crates
            <button onClick={()=>setSelected(d)}>Confirm</button>
          </div>
        ))}
      </div>

      {selected && (
        <div className="card">
          <form onSubmit={handleConfirm}>
            <input type="number" placeholder="Crates received" value={crates} onChange={(e)=>setCrates(e.target.value)} />
            <input type="number" placeholder="Broken cakes" value={broken} onChange={(e)=>setBroken(e.target.value)} />
            <button>Confirm</button>
          </form>
        </div>
      )}

      {/* Customer */}
      <div className="card">
        <input placeholder="Search customer" onChange={(e)=>setSearch(e.target.value)} />
        <button onClick={handleSearch}>Search</button>

        {results.map(c=>(
          <div key={c.id} onClick={()=>selectCustomer(c)}>
            {c.name}
          </div>
        ))}

        {customer && (
          <>
            <p>Balance: KES {balance}</p>

            <form onSubmit={handleSale}>
              <select onChange={(e)=>setProduct(e.target.value)}>
                {products.map(p=>(
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>

              <input type="number" value={qty} onChange={(e)=>setQty(e.target.value)} />

              <select onChange={(e)=>setType(e.target.value)}>
                <option value="retail">Retail</option>
                <option value="wholesale">Wholesale</option>
              </select>

              <button>Sell</button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}