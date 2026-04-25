import { useEffect, useState, useCallback } from "react";
import { supabase } from "./supabaseClient";

import Login from "./pages/Login";
import Production from "./pages/Production";
import Sales from "./pages/Sales";
import Transport from "./pages/Transport";
import Admin from "./pages/Admin";

function App() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  // Use useCallback so we can use this inside useEffect safely
  const fetchRole = useCallback(async (userId) => {
    const { data, error } = await supabase
      .from("users")
      .select("role")
      .eq("id", userId)
      .maybeSingle();

    if (error || !data) {
      console.error("Role error:", error || "User not in table");
      setRole("unknown");
    } else {
      setRole(data.role);
    }
  }, []);

  useEffect(() => {
  let mounted = true;

  async function checkUser() {
    try {
      // 1. Get the current session immediately
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session && mounted) {
        setUser(session.user);
        // 2. WAIT for the role to finish fetching before we do anything else
        await fetchRole(session.user.id);
      }
    } catch (err) {
      console.error("Auth init error", err);
    } finally {
      // 3. ONLY stop loading once we've tried to get the session AND role
      if (mounted) setLoading(false);
    }
  }

  checkUser();

  // Listener for LIVE changes (Login/Logout/Token Refresh)
  const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
    if (session) {
      setUser(session.user);
      await fetchRole(session.user.id);
    } else {
      setUser(null);
      setRole(null);
    }
    if (mounted) setLoading(false);
  });

  return () => {
    mounted = false;
    subscription.unsubscribe();
  };
}, [fetchRole]);



  // Priority 1: App is still checking storage
  if (loading) {
    return <div style={{ background: 'black', height: '100vh', color: 'white' }}>Initializing...</div>;
  }

  // Priority 2: No user logged in
  if (!user) {
    return <Login />; // Removed setUser prop, let onAuthStateChange handle it
  }

  // Priority 3: User exists but role is still fetching
  if (role === null) {
    return <div style={{ background: 'black', height: '100vh', color: 'white' }}>Loading User Permissions...</div>;
  }

  // Priority 4: Role-based Routing
  if (role === "worker") return <Production />;
  if (role === "sales") return <Sales />;
  if (role === "delivery") return <Transport />;
  if (role === "admin") return <Admin />;

  return <div style={{ color: 'white' }}>Error: Role "{role}" not recognized.</div>;
}

export default App;
