import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { logProduction } from "../services/productionService";
import LogoutButton from "../components/LogoutButton";

function getShift() {
  const hour = new Date().getHours();
  return hour >= 6 && hour < 18 ? "day" : "night";
}

export default function Production() {
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState("");

  const [mixes, setMixes] = useState(0);
  const [manualCakes, setManualCakes] = useState(0);

  const [note, setNote] = useState("");
  const [history, setHistory] = useState([]);

  const [loading, setLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // 🔹 Load products
  useEffect(() => {
    async function fetchProducts() {
      try {
        const { data, error } = await supabase
          .from("products")
          .select("*");

        if (error) throw error;
        setProducts(data || []);
      } catch (err) {
        console.error("Products load error:", err);
      }
    }

    fetchProducts();
  }, []);

  // 🔹 Load today's history
  async function loadHistory() {
    try {
      const today = new Date().toISOString().split("T")[0];

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data, error } = await supabase
        .from("production_logs")
        .select(`
          *,
          products(name)
        `)
        .eq("user_id", user.id)
        .gte("created_at", today)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setHistory(data || []);
    } catch (err) {
      console.error("History load error:", err);
    }
  }

  useEffect(() => {
    loadHistory();
  }, []);

  // 🔹 PREVIEW CALCULATION
  const product = products.find((p) => p.id === selectedProduct);

  let preview = null;

  if (product && mixes > 0) {
    if (product.basins_per_mix) {
      const basins = mixes * product.basins_per_mix;
      const totalCakes = Math.floor(basins * 3 * 40);
      const crates = Math.floor(totalCakes / 40);
      const remainder = totalCakes % 40;

      preview = { crates, remainder, totalCakes };
    }
  }

  if (!product?.basins_per_mix && manualCakes > 0) {
    const crates = Math.floor(manualCakes / 40);
    const remainder = manualCakes % 40;

    preview = { crates, remainder, totalCakes: manualCakes };
  }

  // 🔹 SUBMIT
  async function handleSubmit(e) {
    e.preventDefault();

    try {
      setLoading(true);

      if (!selectedProduct) {
        alert("Select product");
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error("Not logged in");

      await logProduction({
        product_id: selectedProduct,
        user_id: user.id,
        mixes_made: mixes,
        manual_cakes: manualCakes,
        note,
        shift: getShift(),
      });

      // reset
      setMixes(0);
      setManualCakes(0);
      setNote("");
      setSelectedProduct("");

      await loadHistory();

    } catch (err) {
      console.error("Submit error:", err);
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

      {/* ================= FORM ================= */}
      <div className="card">
        <form onSubmit={handleSubmit}>

          {/* PRODUCT */}
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

          {/* MIXES OR MANUAL */}
          {product?.basins_per_mix ? (
            <div className="form-group">
              <label>Mixes Made</label>
              <input
                className="input"
                type="number"
                value={mixes}
                onChange={(e) => setMixes(Number(e.target.value))}
              />
            </div>
          ) : (
            <div className="form-group">
              <label>Total Cakes Produced</label>
              <input
                className="input"
                type="number"
                value={manualCakes}
                onChange={(e) => setManualCakes(Number(e.target.value))}
              />
            </div>
          )}

          {/* NOTE */}
          <div className="form-group">
            <label>Note</label>
            <input
              className="input"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional"
            />
          </div>

          {/* PREVIEW */}
          {preview && (
            <div className="card" style={{ marginTop: "10px" }}>
              <div className="card-title">Preview</div>
              <p>📦 Full Crates: <strong>{preview.crates}</strong></p>
              {preview.remainder > 0 && (
                <p>🍰 Partial: {preview.remainder} cakes</p>
              )}
              <p>🎂 Total Cakes: {preview.totalCakes}</p>
            </div>
          )}

          {/* BUTTON */}
          <button
            className="btn btn-primary btn-full"
            disabled={loading}
          >
            {loading ? "Logging Production..." : "Submit"}
          </button>
        </form>
      </div>

      {/* ================= HISTORY TOGGLE ================= */}
      <div style={{ marginTop: "20px" }}>
        <button
          className="btn btn-secondary btn-full"
          onClick={() => setShowHistory(!showHistory)}
        >
          {showHistory ? "Hide Today’s Work" : "View Today’s Work"}
        </button>
      </div>

      {/* ================= HISTORY ================= */}
      {showHistory && (
        <div className="card" style={{ marginTop: "15px" }}>
          <div className="card-title">Today’s Production</div>

          {history.length === 0 && <p>No logs yet</p>}

          {history.map((h) => (
            <div key={h.id} style={{ marginBottom: "12px" }}>
              <p>
                <strong>{h.products?.name}</strong>
              </p>

              <p>
                {h.mixes_made > 0 && `${h.mixes_made} mixes • `}
                {h.crates_produced} crates • {h.cakes_produced} {h.products?.name}
              </p>

              {h.remainder_cakes > 0 && (
                <p>Extra: {h.remainder_cakes} cakes</p>
              )}

              {h.note && <p>📝 {h.note}</p>}

              <small>
                {new Date(h.created_at).toLocaleTimeString()}
              </small>

              <div className="divider"></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}