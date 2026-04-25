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
        // 🔹 FIX: Supabase handles URL tokens automatically. 
        // Just call getSession() to get the current user/session.
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) throw error;

        if (session && mounted) {
          setUser(session.user);
          await fetchRole(session.user.id);
        }
      } catch (err) {
        console.error("Auth init error", err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    checkUser();

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

  if (loading) {
    return <div style={{ background: 'black', height: '100vh', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Initializing...</div>;
  }

  if (!user) {
    return <Login />;
  }

  if (role === null) {
    return <div style={{ background: 'black', height: '100vh', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading User Permissions...</div>;
  }

  // Role-based Routing
  if (role === "worker") return <Production />;
  if (role === "sales") return <Sales />;
  if (role === "delivery") return <Transport />;
  if (role === "admin") return <Admin />;

  return (
    <div style={{ background: 'black', height: '100vh', color: 'white', padding: '20px' }}>
      Error: Role "{role}" not recognized. Contact Admin.
    </div>
  );
}

export default App;
