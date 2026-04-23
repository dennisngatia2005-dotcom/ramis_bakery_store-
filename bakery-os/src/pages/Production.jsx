import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { logProduction } from '../services/productionService';

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

    try {
      await logProduction({
        product_id: selectedProduct,
        user_id: null, // we’ll fix auth later
        mixes_made: Number(mixes),
      });

      alert('Production logged!');
      setMixes(0);
    } catch (err) {
      console.error(err);
      alert('Error logging production');
    }
  }

  return (
    <div>
      <h2>Production</h2>

      <form onSubmit={handleSubmit}>
        <select
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

        <input
          type="number"
          placeholder="Mixes made"
          value={mixes}
          onChange={(e) => setMixes(e.target.value)}
        />

        <button type="submit">Submit</button>
      </form>
    </div>
  );
}