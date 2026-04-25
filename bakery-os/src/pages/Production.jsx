import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { logProduction } from "../services/productionService";
import LogoutButton from "../components/LogoutButton";

const defaultUserID = "18eb419f-0427-4fbc-9f48-ab0eee711e1f";

function getShift() {
  const hour = new Date().getHours();
  return hour >= 6 && hour < 18 ? "day" : "night";
}

export default function Production() {
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [mixes, setMixes] = useState(0);
  const [note, setNote] = useState("");
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  // 🔹 Load products
  useEffect(() => {
    async function fetchProducts() {
      const { data } = await supabase.from("products").select("*");
      setProducts(data || []);
    }
    fetchProducts();
  }, []);

  // 🔹 Load today's history
  async function loadHistory() {
    const today = new Date().toISOString().split("T")[0];

    const { data } = await supabase
      .from("production_logs")
      .select("*")
      .eq("user_id", defaultUserID)
      .gte("created_at", today)
      .order("created_at", { ascending: false });

    setHistory(data || []);
  }

  useEffect(() => {
    loadHistory();
  }, []);

  const product = products.find((p) => p.id === selectedProduct);

  // 🔹 Preview
  let preview = null;

  if (product && mixes > 0) {
    const basins = mixes * (product.basins_per_mix || 0);
    const totalCakes = Math.floor(basins * 3 * 40); // 3 trays per basin, 40 cakes per tray

    const crates = Math.floor(totalCakes / 40);
    const remainder = totalCakes % 40;

    preview = { crates, remainder, totalCakes };
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (!selectedProduct || mixes <= 0) {
      alert("Enter valid data");
      return;
    }

    try {
      setLoading(true);

      await logProduction({
        product_id: selectedProduct,
        user_id: defaultUserID,
        mixes_made: mixes,
        note,
        shift: getShift(),
      });

      alert("Production logged");

      setMixes(0);
      setNote("");
      setSelectedProduct("");

      loadHistory();
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container">
      <div className="section-header">
        <div className="section-title">
          <span>Department</span>
          Production
        </div>
        <LogoutButton />
      </div>

      <div className="card">
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Product</label>
            <select
              className="input"
              value={selectedProduct}
              onChange={(e) => setSelectedProduct(e.target.value)}
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
            <label>Mixes</label>
            <input
              className="input"
              type="number"
              value={mixes}
              onChange={(e) => setMixes(Number(e.target.value))}
            />
          </div>

          <div className="form-group">
            <label>Note</label>
            <input
              className="input"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional"
            />
          </div>

          {/* Preview */}
          {preview && (
            <div className="card" style={{ marginTop: "10px" }}>
              <p>Full Crates: {preview.crates}</p>

              {preview.remainder > 0 && (
                <p>Partial Crate: {preview.remainder} cakes</p>
              )}

              <p>Total Cakes: {preview.totalCakes}</p>
            </div>
          )}

          <button className="btn btn-primary btn-full">
            {loading ? "Submitting..." : "Submit"}
          </button>
        </form>
      </div>

      {/* 🔥 HISTORY */}
      <div className="card" style={{ marginTop: "20px" }}>
        <div className="card-title">Today’s Work</div>

        {history.length === 0 && <p>No logs yet</p>}

        {history.map((h) => (
          <div key={h.id} style={{ marginBottom: "10px" }}>
            <p><strong>{h.mixes_made} mixes</strong></p>
            <p>{h.crates_produced} crates</p>

            {h.remainder_cakes > 0 && (
              <p>{h.remainder_cakes} extra cakes</p>
            )}

            {h.note && <p>Note: {h.note}</p>}

            <small>
              {new Date(h.created_at).toLocaleTimeString()}
            </small>

            <hr />
          </div>
        ))}
      </div>
    </div>
  );
}