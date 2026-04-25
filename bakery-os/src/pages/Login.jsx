import { useState } from "react";
import { supabase } from "../supabaseClient";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // 🔹 SHIFT DETECTOR
  function getShift(role) {
    if (role !== "worker") return "fulltime";

    const hour = new Date().getHours();

    if (hour >= 6 && hour < 18) {
      return "day";
    } else {
      return "night";
    }
  }

  async function handleLogin(e) {
    e.preventDefault();
    setIsLoggingIn(true);

    // 1. LOGIN
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      alert(error.message);
      setIsLoggingIn(false);
      return;
    }

    const user = data.user;

    // 2. GET USER ROLE
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("id, role, name")
      .eq("id", user.id)
      .single();

    if (userError) {
      console.error(userError);
      alert("User record not found");
      setIsLoggingIn(false);
      return;
    }

    const shift = getShift(userData.role);

    // 3. CREATE SESSION
    const { error: sessionError } = await supabase
      .from("staff_sessions")
      .insert([
        {
          user_id: user.id,
          role: userData.role,
          shift: shift,
          login_time: new Date().toISOString(),
        },
      ]);

    if (sessionError) {
      console.error(sessionError);
      alert("Failed to start session");
      setIsLoggingIn(false);
      return;
    }

    // 🔥 success → App.js handles redirect automatically
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

          <button
            type="submit"
            className="btn btn-primary btn-full"
            disabled={isLoggingIn}
          >
            {isLoggingIn ? "Logging in..." : "Login"}
          </button>
        </form>
      </div>
    </div>
  );
}