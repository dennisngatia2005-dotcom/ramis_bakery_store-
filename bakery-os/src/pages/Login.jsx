import { useState } from "react";
import { supabase } from "../supabaseClient";

export default function Login({ setUser }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleLogin(e) {
    e.preventDefault();

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      const user = data.user;

      // 🔹 Get role from users table
      const { data: userData } = await supabase
        .from("users")
        .select("*")
        .eq("id", user.id)
        .single();

      const role = userData?.role || "unknown";

      // 🔹 Determine shift
      const hour = new Date().getHours();

      let shift = "fulltime";
      if (role === "worker") {
        shift = hour >= 6 && hour < 18 ? "day" : "night";
      }

      // 🔹 Insert session
      await supabase.from("staff_sessions").insert([
        {
          user_id: user.id,
          role,
          shift,
          login_time: new Date().toISOString(),
        },
      ]);

      setUser(user);

    } catch (err) {
      console.error("LOGIN ERROR:", err);
      alert(err.message);
    }
  }

  return (
    <div className="container">
      <div className="card" style={{ maxWidth: 420, margin: "2rem auto" }}>
        <div className="card-title">Login</div>

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label>Email</label>
            <input
              className="input"
              type="email"
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              className="input"
              type="password"
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button className="btn btn-primary btn-full">
            Login
          </button>
        </form>
      </div>
    </div>
  );
}