import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { makeSale } from "../services/salesService";
import LogoutButton from "../components/LogoutButton";
const DEFAULT_USER_ID = "18eb419f-0427-4fbc-9f48-ab0eee711e1f";

export default function Sales() {
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);

  const [product, setProduct] = useState("");
  const [customer, setCustomer] = useState("");
  const [quantity, setQuantity] = useState(0);
  const [priceType, setPriceType] = useState("retail");

  useEffect(() => {
    async function load() {
      const { data: p } = await supabase.from("products").select("*");
      const { data: c } = await supabase.from("customers").select("*");

      setProducts(p || []);
      setCustomers(c || []);
    }
    load();
  }, []);

  async function handleSale(e) {
    e.preventDefault();

    try {
      const total = await makeSale({
        product_id: product,
        customer_id: customer,
        sales_user_id: DEFAULT_USER_ID,
        quantity: Number(quantity),
        price_type: priceType,
      });

      alert(`Sale recorded: KES ${total}`);
      setQuantity(0);
    } catch (err) {
      console.error(err);
      alert(err.message);
    }
  }

  return (
    <div className="container">
      <div className="section-header">
        <div className="section-title">
          <LogoutButton />
          <span>Department</span>
          Sales
        </div>
      </div>

      <div className="card">
        <div className="card-title">Make Sale</div>
        <div className="card-content">
          <form onSubmit={handleSale}>
            <div className="form-group">
              <label>Customer</label>
              <select
                className="input"
                onChange={(e) => setCustomer(e.target.value)}
                value={customer}
                required
              >
                <option value="">Select Customer</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Product</label>
              <select
                className="input"
                onChange={(e) => setProduct(e.target.value)}
                value={product}
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
              <label>Quantity</label>
              <input
                className="input"
                type="number"
                placeholder="Quantity"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label>Price Type</label>
              <select
                className="input"
                onChange={(e) => setPriceType(e.target.value)}
                value={priceType}
              >
                <option value="retail">Retail</option>
                <option value="wholesale">Wholesale</option>
              </select>
            </div>

            <button type="submit" className="btn btn-primary btn-full">Sell</button>
          </form>
          <p>Balance: KES {customers.find((c) => c.id === customer)?.balance || 0}</p>
        </div>
      </div>
    </div>
  );
}