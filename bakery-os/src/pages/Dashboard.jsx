import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import LogoutButton from "../components/LogoutButton";

export default function Dashboard() {
  const [inventory, setInventory] = useState([]);
  const [productionToday, setProductionToday] = useState(0);

  // Fetch inventory
  async function fetchInventory() {
    const { data, error } = await supabase
      .from("inventory")
      .select(`
        quantity_cakes,
        inventory_locations(name)
      `);

    if (error) {
      console.error(error);
      return;
    }

    setInventory(data);
  }

  // Fetch today's production
  async function fetchProduction() {
    const today = new Date().toISOString().split("T")[0];

    const { data, error } = await supabase
      .from("production_logs")
      .select("cakes_produced, created_at");

    if (error) {
      console.error(error);
      return;
    }

    const total = data
      .filter((p) => p.created_at.startsWith(today))
      .reduce((sum, p) => sum + p.cakes_produced, 0);

    setProductionToday(total);
  }

  // Initial load
  useEffect(() => {
    fetchInventory();
    fetchProduction();
  }, []);

  // 🔥 REAL-TIME SUBSCRIPTION
  useEffect(() => {
    const channel = supabase
      .channel("realtime-dashboard")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "inventory" },
        () => {
          fetchInventory();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "production_logs" },
        () => {
          fetchProduction();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Compute totals
  const storeCakes = inventory
    .filter((i) => i.inventory_locations.name === "store")
    .reduce((sum, i) => sum + i.quantity_cakes, 0);

  const marketCakes = inventory
    .filter((i) => i.inventory_locations.name === "market")
    .reduce((sum, i) => sum + i.quantity_cakes, 0);

  return (
    <div className="container">
      <div className="section-header">
        <div className="section-title">
          <span>Department</span>
          Dashboard
        </div>
        <LogoutButton />
      </div>

      <div className="grid-3">
        <div className="card">
          <div className="card-title">Store Cakes</div>
          <div className="card-content">
            <p>{storeCakes}</p>
          </div>
        </div>

        <div className="card">
          <div className="card-title">Market Cakes</div>
          <div className="card-content">
            <p>{marketCakes}</p>
          </div>
        </div>

        <div className="card">
          <div className="card-title">Production Today</div>
          <div className="card-content">
            <p>{productionToday}</p>
          </div>
        </div>
      </div>
    </div>
  );
}