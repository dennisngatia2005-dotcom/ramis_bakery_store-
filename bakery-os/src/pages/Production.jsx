import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { logProduction } from "../services/productionService";
import LogoutButton from "../components/LogoutButton";

const defaultUserID = "18eb419f-0427-4fbc-9f48-ab0eee711e1f";

export default function Production() {
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [mixes, setMixes] = useState(0);
  const [loading, setLoading] = useState(false);

  // 🔹 Load products safely
  useEffect(() => {
    async function fetchProducts() {
      try {
        const { data, error } = await supabase
          .from("products")
          .select("*");

        if (error) {
          console.error(error);
          return;
        }

        setProducts(data || []);
      } catch (err) {
        console.error("Fetch error:", err);
      }
    }

    fetchProducts();
  }, []);

  // 🔹 Safe product lookup
  const product = products?.find((p) => p.id === selectedProduct);

  // 🔹 Preview calculation
  let preview = null;

  if (product && mixes > 0) {
    const cratesPerBasin = 3;
    const cakesPerCrate = 40;

    const basins = mixes * (product.basins_per_mix || 0);
    const crates = Math.floor(basins * cratesPerBasin);
    const cakes = crates * cakesPerCrate;
    const flourUsed = mixes * (product.sacks_per_mix || 0);

    preview = { crates, cakes, flourUsed };
  }

  // 🔹 Submit handler
  async function handleSubmit(e) {
    e.preventDefault();

    if (!selectedProduct || mixes <= 0) {
      alert("Select product and enter valid mixes");
      return;
    }

    try {
      setLoading(true);

      await logProduction({
        product_id: selectedProduct,
        user_id: defaultUserID,
        mixes_made: mixes,
      });

      alert("Production logged!");

      setMixes(0);
      setSelectedProduct("");
    } catch (err) {
      console.error(err);
      alert(err.message || "Error logging production");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container">
      <div className="section-header">
        <div className="section-title">
          <LogoutButton />
          <span>Department</span>
          Production
        </div>
      </div>

      <div className="card" style={{ maxWidth: 520, margin: "0 auto" }}>
        <div className="card-title">Create Production Mix</div>

        <form onSubmit={handleSubmit}>
          {/* Product */}
          <div className="form-group">
            <label>Product</label>
            <select
              className="input"
              value={selectedProduct}
              onChange={(e) => setSelectedProduct(e.target.value)}
              required
            >
              <option value="">Select Product</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Mixes */}
          <div className="form-group">
            <label>Mixes Made</label>
            <input
              className="input"
              type="number"
              min="1"
              value={mixes}
              onChange={(e) => setMixes(Number(e.target.value))}
              required
            />
          </div>

          {/* Preview */}
          {preview && (
            <div className="card" style={{ marginTop: "10px" }}>
              <div className="card-title">Preview</div>
              <p>Crates: {preview.crates}</p>
              <p>Cakes: {preview.cakes}</p>
              <p>Flour: {preview.flourUsed.toFixed(2)} sacks</p>
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary btn-full"
            disabled={loading}
          >
            {loading ? "Submitting..." : "Submit"}
          </button>
        </form>
      </div>
    </div>
  );
}