import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

export default function Admin() {
  const [salesPerHour, setSalesPerHour] = useState([]);
  const [revenueToday, setRevenueToday] = useState(0);
  const [cakesSold, setCakesSold] = useState(0);
  const [topProduct, setTopProduct] = useState(null);
  const [stockValue, setStockValue] = useState(0);
  const [productRanking, setProductRanking] = useState([]);
  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    await fetchSalesToday();
    await fetchTopProduct();
    await fetchStockValue();
    await fetchSalesPerHour();
    await fetchProductRanking();
  }
  //fetch product ranking
  async function fetchProductRanking() {
    const { data: sales } = await supabase
      .from("sales")
      .select("product_id, quantity");

    const { data: products } = await supabase
      .from("products")
      .select("*");

    const totals = {};

    sales.forEach((s) => {
      totals[s.product_id] =
        (totals[s.product_id] || 0) + s.quantity;
    });

    const ranking = Object.entries(totals)
      .map(([id, qty]) => {
        const product = products.find((p) => p.id === id);
        return {
          name: product?.name || "Unknown",
          quantity: qty,
        };
      })
      .sort((a, b) => b.quantity - a.quantity);

    setProductRanking(ranking);
  }
  //fetch sales per hour for today
  async function fetchSalesPerHour() {
    const today = new Date().toISOString().split("T")[0];

    const { data } = await supabase
      .from("sales")
      .select("created_at, total_amount");

    const hours = Array(24).fill(0);

    data.forEach((sale) => {
      if (sale.created_at.startsWith(today)) {
        const hour = new Date(sale.created_at).getHours();
        hours[hour] += sale.total_amount;
      }
    });

    setSalesPerHour(hours);
  }
  // 📊 Revenue + cakes sold today
  async function fetchSalesToday() {
    const today = new Date().toISOString().split("T")[0];

    const { data, error } = await supabase
      .from("sales")
      .select("*");

    if (error) {
      console.error(error);
      return;
    }

    const todaySales = data.filter((s) =>
      s.created_at.startsWith(today)
    );

    const revenue = todaySales.reduce(
      (sum, s) => sum + s.total_amount,
      0
    );

    const cakes = todaySales.reduce(
      (sum, s) => sum + s.quantity,
      0
    );

    setRevenueToday(revenue);
    setCakesSold(cakes);
  }

  // 🏆 Top product
  async function fetchTopProduct() {
    const { data, error } = await supabase
      .from("sales")
      .select("product_id, quantity");

    if (error) {
      console.error(error);
      return;
    }

    const totals = {};

    data.forEach((s) => {
      totals[s.product_id] =
        (totals[s.product_id] || 0) + s.quantity;
    });

    let max = 0;
    let topId = null;

    for (let id in totals) {
      if (totals[id] > max) {
        max = totals[id];
        topId = id;
      }
    }

    if (!topId) return;

    const { data: product } = await supabase
      .from("products")
      .select("*")
      .eq("id", topId)
      .single();

    setTopProduct(product);
  }

  // 📦 Stock value
  async function fetchStockValue() {
    const { data: inventory } = await supabase
      .from("inventory")
      .select("*");

    const { data: products } = await supabase
      .from("products")
      .select("*");

    let total = 0;

    inventory.forEach((item) => {
      const product = products.find(
        (p) => p.id === item.product_id
      );

      if (product) {
        total += item.quantity_cakes * product.retail_price;
      }
    });

    setStockValue(total);
  }

  return (
    <div className="container">
      <div className="section-header">
        <div className="section-title">
          <span>Department</span>
          Admin Dashboard
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-title">Summary</div>
          <div className="card-content">
            <p>Revenue Today: <strong>KES {revenueToday}</strong></p>
            <p>Cakes Sold Today: <strong>{cakesSold}</strong></p>
            <p>Stock Value: <strong>KES {stockValue}</strong></p>
            <p>Top Product: <strong>{topProduct ? topProduct.name : 'N/A'}</strong></p>
          </div>
        </div>

        <div className="card">
          <div className="card-title">Sales Per Hour</div>
          <div className="card-content">
            {salesPerHour.map((val, i) => (
              <p key={i}>
                {i}:00 — KES {val}
              </p>
            ))}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: '1.5rem' }}>
        <div className="card-title">Top Products</div>
        <div className="card-content">
          {productRanking.map((p, i) => (
            <div key={i} className="row-item">
              <span>{p.name}</span>
              <strong>{p.quantity} sold</strong>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}