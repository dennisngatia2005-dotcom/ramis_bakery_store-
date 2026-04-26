import { useEffect, useState } from "react";
import LogoutButton from "../components/LogoutButton";
import { supabase } from "../supabaseClient";

import {
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend, ResponsiveContainer
} from "recharts";

import {
  getSalesData,
  getInventoryData,
  getDeliveryData,
  getStaffData,
  getProductionData
} from "../services/adminService";

const COLORS = ["#e8b84b", "#5a9e6f", "#d4652a", "#c0392b"];

export default function Admin() {
  const [tab, setTab] = useState("sales");

  const [sales, setSales] = useState([]);
  const [payments, setPayments] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [staff, setStaff] = useState([]);
  const [production, setProduction] = useState([]);

  useEffect(() => {
    loadData();

    const channel = supabase
      .channel("admin-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "sales" }, loadData)
      .on("postgres_changes", { event: "*", schema: "public", table: "inventory" }, loadData)
      .on("postgres_changes", { event: "*", schema: "public", table: "deliveries" }, loadData)
      .on("postgres_changes", { event: "*", schema: "public", table: "staff_sessions" }, loadData)
      .on("postgres_changes", { event: "*", schema: "public", table: "production_logs" }, loadData)
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  async function loadData() {
    const s = await getSalesData();
    setSales(s.sales);
    setPayments(s.payments);

    setInventory(await getInventoryData());
    setDeliveries(await getDeliveryData());
    setStaff(await getStaffData());
    setProduction(await getProductionData());
  }

  /* ================= SALES ================= */

  const today = new Date().toDateString();

  const todaySales = sales.filter(
    s => new Date(s.created_at).toDateString() === today
  );

  const totalRevenueToday = todaySales.reduce((sum, s) => sum + Number(s.total_amount), 0);
  const totalRevenueAllTime = sales.reduce((sum, s) => sum + Number(s.total_amount), 0);

  const retailRevenue = todaySales
    .filter(s => s.sale_type === "retail")
    .reduce((sum, s) => sum + Number(s.total_amount), 0);

  const wholesaleRevenue = todaySales
    .filter(s => s.sale_type === "wholesale")
    .reduce((sum, s) => sum + Number(s.total_amount), 0);

  const salesPerHour = Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    total: todaySales
      .filter(s => new Date(s.created_at).getHours() === h)
      .reduce((sum, s) => sum + Number(s.total_amount), 0)
  }));

  const productData = Object.values(
    todaySales.reduce((acc, s) => {
      const name = s.products?.name || "Unknown";
      if (!acc[name]) acc[name] = { name, value: 0 };
      acc[name].value += s.quantity;
      return acc;
    }, {})
  );

  /* ================= STOCK ================= */

  const grouped = {};
  const soldByProduct = {};
  const producedToday = {};
  const revenueByProduct = {};

  sales.forEach(s => {
    const name = s.products?.name;
    if (!soldByProduct[name]) soldByProduct[name] = 0;
    if (!revenueByProduct[name]) revenueByProduct[name] = 0;

    soldByProduct[name] += s.quantity;
    revenueByProduct[name] += Number(s.total_amount);
  });

  production.forEach(p => {
    const name = p.products?.name;
    if (!producedToday[name]) producedToday[name] = 0;
    producedToday[name] += p.crates_produced;
  });

  inventory.forEach(i => {
    const name = i.products?.name || "Unknown";

    if (!grouped[name]) {
      grouped[name] = {
        store: 0,
        market: 0,
        transit: 0,
        total: 0,
        price: i.products?.retail_price || 0
      };
    }

    const loc = i.inventory_locations?.name;

    if (loc === "store") grouped[name].store += i.quantity_crates;
    if (loc === "market") grouped[name].market += i.quantity_crates;
    if (loc === "transit") grouped[name].transit += i.quantity_crates;

    grouped[name].total += i.quantity_crates;
  });

  /* ================= SHIFTS ================= */

  const shiftStats = {
    Day: { mixes: 0, cakes: 0, crates: 0, flour: 0 },
    Night: { mixes: 0, cakes: 0, crates: 0, flour: 0 }
  };

  production.forEach(p => {
    const rawShift = (p.shift || "").toLowerCase();
    const shift = rawShift === "night" ? "Night" : "Day";

    shiftStats[shift].mixes += p.mixes_made;
    shiftStats[shift].cakes += p.cakes_produced;
    shiftStats[shift].crates += p.crates_produced;
    shiftStats[shift].flour += Number(p.flour_used || 0);
  });

  /* ================= DELIVERY ================= */

  function getStatusColor(status) {
    if (status === "completed") return "badge-green";
    if (status === "in_transit") return "badge-orange";
    if (status === "awaiting_sales_confirmation") return "badge-yellow";
    if (status === "awaiting_return") return "badge-red";
    return "badge";
  }

  return (
    <div className="container">

      <div className="section-header">
        <div className="section-title">Admin Dashboard</div>
        <LogoutButton />
      </div>

      <div className="nav-tabs">
        {["sales", "stock", "shifts", "deliveries", "staff"].map(t => (
          <div key={t} className={`nav-tab ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>
            {t}
          </div>
        ))}
      </div>

      {/* SALES */}
      {tab === "sales" && (
        <div className="grid-2">
          <div className="card">
            <div className="card-title">Revenue</div>
            <p>Today: KES {totalRevenueToday}</p>
            <p>All Time: KES {totalRevenueAllTime}</p>
            <p>Retail: KES {retailRevenue}</p>
            <p>Wholesale: KES {wholesaleRevenue}</p>
          </div>

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
              <tbody>
                {sales.map(s => (
                  <tr key={s.id}>
                    <td>
                      {s.customers?.name} bought {s.quantity} {s.products?.name} for 
                      KES {s.total_amount} via {s.users?.name}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* STOCK */}
      {tab === "stock" && (
        <div className="grid-3">
          {Object.entries(grouped).map(([name, data]) => (
            <div key={name} className="card">
              <div className="card-title">{name}</div>
              <p>Produced Today: {producedToday[name] || 0}</p>
              <p>Sold: {soldByProduct[name] || 0}</p>
              <p>Remaining: {data.total - (soldByProduct[name] || 0)}</p>
              <p>Store: {data.store}</p>
              <p>Market: {data.market}</p>
              <p>Transit: {data.transit}</p>
              <hr />
              <p>Value: KES {data.total * data.price}</p>
              <p>Revenue: KES {revenueByProduct[name] || 0}</p>
            </div>
          ))}
        </div>
      )}

      {/* SHIFTS */}
      {tab === "shifts" && (
        <div className="grid-2">
          {Object.entries(shiftStats).map(([shift, data]) => (
            <div key={shift} className="card">
              <div className="card-title">{shift} Shift</div>
              <p>Mixes: {data.mixes}</p>
              <p>Cakes: {data.cakes}</p>
              <p>Crates: {data.crates}</p>
              <p>Flour Used: {data.flour}</p>
            </div>
          ))}
        </div>
      )}

      {/* DELIVERIES */}
      {tab === "deliveries" && (
        <div className="card">
          <div className="card-title">Delivery Tracking</div>
          <table className="log-table">
            <tbody>
              {deliveries.map(d => {
                const duration =
                  d.departed_at && d.arrived_at
                    ? Math.floor((new Date(d.arrived_at) - new Date(d.departed_at)) / 60000)
                    : null;

                return (
                  <tr key={d.id}>
                    <td>
                      <span className={`badge ${getStatusColor(d.status)}`}>
                        {d.status.replaceAll("_", " ")}
                      </span>
                    </td>
                    <td>{duration ? `${duration} min` : "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* STAFF */}
      {tab === "staff" && (
        <div className="card">
          <div className="card-title">Staff Activity</div>
          <table className="log-table">
            <tbody>
              {staff.map(s => (
                <tr key={s.id}>
                  <td>{s.users?.name}</td>
                  <td>{s.role}</td>
                  <td>{s.shift}</td>
                  <td>{new Date(s.login_time).toLocaleString()}</td>
                  <td>{s.logout_time ? new Date(s.logout_time).toLocaleString() : "Active"}</td>
                  <td>{s.duration_minutes || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

    </div>
  );
}