import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import LogoutButton from "../components/LogoutButton";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend, ResponsiveContainer
} from "recharts";

const COLORS = ["#e8b84b", "#5a9e6f", "#d4652a", "#c0392b"];

export default function Admin() {
  const [tab, setTab] = useState("sales");

  const [sales, setSales] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [products, setProducts] = useState([]);
  const [locations, setLocations] = useState([]);

  const [flour, setFlour] = useState(0);

  useEffect(() => {
    loadData();

    const channel = supabase
      .channel("admin-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "sales" }, loadData)
      .on("postgres_changes", { event: "*", schema: "public", table: "deliveries" }, loadData)
      .on("postgres_changes", { event: "*", schema: "public", table: "inventory" }, loadData)
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  async function loadData() {
    const { data: s } = await supabase
      .from("sales")
      .select("*, customers(name)")
      .order("created_at", { ascending: true });

    const { data: d } = await supabase.from("deliveries").select("*");
    const { data: i } = await supabase.from("inventory").select("*");
    const { data: p } = await supabase.from("products").select("*");
    const { data: l } = await supabase.from("inventory_locations").select("*");

    setSales(s || []);
    setDeliveries(d || []);
    setInventory(i || []);
    setProducts(p || []);
    setLocations(l || []);

    const totalMixes = i?.reduce((sum, item) => sum + item.quantity_crates, 0) || 0;
    setFlour(Math.max(0, 100 - Math.floor(totalMixes / 6)));
  }

  const getProductName = (id) =>
    products.find(p => p.id === id)?.name || "Unknown";

  const getLocationName = (id) =>
    locations.find(l => l.id === id)?.name || "Unknown";

  /* ================= SALES DATA ================= */

  const salesPerHour = Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    total: sales
      .filter(s => new Date(s.created_at).getHours() === h)
      .reduce((sum, s) => sum + Number(s.total_amount), 0)
  }));

  const productData = Object.values(
    sales.reduce((acc, s) => {
      const name = getProductName(s.product_id);
      if (!acc[name]) acc[name] = { name, value: 0 };
      acc[name].value += s.quantity;
      return acc;
    }, {})
  );

  /* ================= GROUP STOCK ================= */

  const groupedStock = locations.map(loc => ({
    name: loc.name,
    items: inventory.filter(i => i.location_id === loc.id)
  }));

  /* ================= UI ================= */

  return (
    <div className="container">

      {/* HEADER */}
      <div className="section-header">
        <div className="section-title">
          <span>System</span>
          Admin Dashboard
        </div>
        <LogoutButton />
      </div>

      {/* TABS */}
      <div className="nav-tabs">
        {["sales", "stock", "deliveries"].map(t => (
          <div
            key={t}
            className={`nav-tab ${tab === t ? "active" : ""}`}
            onClick={() => setTab(t)}
          >
            {t}
          </div>
        ))}
      </div>

      {/* ================= SALES ================= */}
      {tab === "sales" && (
        <div className="grid-2">

          <div className="card">
            <div className="card-title">Sales per Hour</div>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={salesPerHour}>
                <CartesianGrid stroke="#2e2c28" />
                <XAxis dataKey="hour" />
                <YAxis />
                <Tooltip />
                <Line dataKey="total" stroke="#e8b84b" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="card">
            <div className="card-title">Product Performance</div>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={productData} dataKey="value" nameKey="name">
                  {productData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Legend />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="card">
            <div className="card-title">Sales Feed</div>

            <table className="log-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Product</th>
                  <th>Qty</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {sales.map(s => (
                  <tr key={s.id}>
                    <td>{s.customers?.name}</td>
                    <td>{getProductName(s.product_id)}</td>
                    <td>{s.quantity}</td>
                    <td>KES {s.total_amount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= STOCK ================= */}
      {tab === "stock" && (
        <div className="grid-3">

          {groupedStock.map(loc => (
            <div key={loc.name} className="card">
              <div className="card-title">{loc.name.toUpperCase()}</div>

              {loc.items.length === 0 ? (
                <p className="empty">No stock</p>
              ) : (
                loc.items.map(i => (
                  <div key={i.id} className="row-item">
                    {getProductName(i.product_id)}  
                    |{i.quantity_crates} crates  
                    |{i.quantity_cakes} cakes
                  </div>
                ))
              )}
            </div>
          ))}

          <div className="card">
            <div className="card-title">Flour Status</div>

            <div className="stat-value">{flour}</div>
            <div className="stat-sub">Sacks Remaining</div>

            {flour < 10 && (
              <div className="badge badge-red">LOW STOCK</div>
            )}
          </div>
        </div>
      )}

      {/* ================= DELIVERIES ================= */}
      {tab === "deliveries" && (
        <div className="card">

          <div className="card-title">Delivery Lifecycle</div>

          <table className="log-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Crates</th>
                <th>Status</th>
                <th>Time</th>
              </tr>
            </thead>

            <tbody>
              {deliveries.map(d => {
                let badge = "badge-yellow";
                if (d.status === "completed") badge = "badge-green";
                if (d.status === "in_transit") badge = "badge-orange";
                if (d.status === "arrived") badge = "badge-yellow";

                const duration =
                  d.departed_at && d.arrived_at
                    ? Math.floor(
                        (new Date(d.arrived_at) - new Date(d.departed_at)) / 60000
                      )
                    : null;

                return (
                  <tr key={d.id}>
                    <td>{getProductName(d.product_id)}</td>
                    <td>{d.crates_sent}</td>
                    <td>
                      <span className={`badge ${badge}`}>
                        {d.status}
                      </span>
                    </td>
                    <td>
                      {duration ? `${duration} min` : "-"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

        </div>
      )}
    </div>
  );
}