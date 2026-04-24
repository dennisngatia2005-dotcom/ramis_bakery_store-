import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { logProduction } from '../services/productionService';
const defaultuserID = '18eb419f-0427-4fbc-9f48-ab0eee711e1f';
export default function Production() {
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [mixes, setMixes] = useState(0);

  // Load products
  useEffect(() => {
    async function fetchProducts() {
      const { data } = await supabase.from('products').select('*');
      console.log('Products:', data);
      setProducts(data);
    }
    fetchProducts();
  }, []);

  async function handleSubmit(e) {
  e.preventDefault();

  if (!selectedProduct || mixes <= 0) {
    alert("Select product and enter valid mixes");
    return;
  }

  try {
    await logProduction({
      product_id: selectedProduct,
      user_id: defaultuserID,
      mixes_made: Number(mixes),
    });

    alert("Production logged!");
    setMixes(0);
  } catch (err) {
    console.error(err);
    alert("Error logging production");
  }
}

  return (
    <div className="container">
      <div className="section-header">
        <div className="section-title">
          <span>Department</span>
          Production
        </div>
      </div>

      <div className="card" style={{ maxWidth: 520, margin: '0 auto' }}>
        <div className="card-title">Create Production Mix</div>
        <form onSubmit={handleSubmit}>
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

          <div className="form-group">
            <label>Mixes Made</label>
            <input
              className="input"
              type="number"
              placeholder="Mixes made"
              value={mixes}
              onChange={(e) => setMixes(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn btn-primary btn-full">
            Submit
          </button>
        </form>
      </div>
    </div>
  );
}