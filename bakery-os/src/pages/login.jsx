import { useState } from "react";
import { supabase } from "../supabaseClient";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleLogin(e) {
    e.preventDefault();

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      alert(error.message);
      return;
    }
    // {"id":"41d93840-5d9e-437e-b174-593118d83afa","aud":"authenticated","role":"authenticated","email":"andreas@gmail.com","email_confirmed_at":"2026-04-24T01:04:10.697329Z","phone":"","confirmed_at":"2026-04-24T01:04:10.697329Z","last_sign_in_at":"2026-04-24T02:32:53.733807699Z","app_metadata":{"provider":"email","providers":["email"]},"user_metadata":{"email_verified":true},"identities":[{"identity_id":"55224eb7-dec9-46ae-b6b0-6da98115a410","id":"41d93840-5d9e-437e-b174-593118d83afa","user_id":"41d93840-5d9e-437e-b174-593118d83afa","identity_data":{"email":"andreas@gmail.com","email_verified":false,"phone_verified":false,"sub":"41d93840-5d9e-437e-b174-593118d83afa"},"provider":"email","last_sign_in_at":"2026-04-24T01:04:10.692396Z","created_at":"2026-04-24T01:04:10.692453Z","updated_at":"2026-04-24T01:04:10.692453Z","email":"andreas@gmail.com"}],"created_at":"2026-04-24T01:04:10.677572Z","updated_at":"2026-04-24T02:32:53.754462Z","is_anonymous":false}
    alert(JSON.stringify(data.user));
  }

  return (
    <div className="container">
      <div className="card" style={{ maxWidth: 420, margin: '2rem auto' }}>
        <div className="card-title">Login</div>
        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label>Email</label>
            <input
              className="input"
              type="email"
              placeholder="Enter your email"
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              className="input"
              type="password"
              placeholder="Enter your password"
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn btn-primary btn-full">
            Login
          </button>
        </form>
      </div>
    </div>
  );
}