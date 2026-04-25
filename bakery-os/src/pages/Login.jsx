import { useState } from "react";
import { supabase } from "../supabaseClient";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  function getShift(role) {
    if (role !== "worker") return "fulltime";
    const hour = new Date().getHours();
    return (hour >= 6 && hour < 18) ? "day" : "night";
  }

  async function handleLogin(e) {
    e.preventDefault();
    if (isLoggingIn) return; // Prevent double clicks
    
    setIsLoggingIn(true);

    try {
      // 1. LOGIN
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      const user = data.user;

      // 2. GET USER ROLE 
      // We fetch this here to create the staff_session record before the App redirects
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .single();

      if (userError) throw new Error("User profile not found in database.");

      const shift = getShift(userData.role);

      // 3. CREATE STAFF SESSION RECORD
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

      if (sessionError) throw new Error("Could not initialize staff session.");

      // SUCCESS: 
      // We don't need to do anything else. 
      // supabase.auth.onAuthStateChange inside App.jsx will detect the new session 
      // and automatically switch the view from <Login /> to the correct Department.

    } catch (err) {
      alert(err.message);
      setIsLoggingIn(false); // Only stop loading if there is an error
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
              placeholder="Enter your email"
              value={email}
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
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-full"
            disabled={isLoggingIn}
          >
            {isLoggingIn ? "Authenticating..." : "Login"}
          </button>
        </form>
      </div>
    </div>
  );
}
