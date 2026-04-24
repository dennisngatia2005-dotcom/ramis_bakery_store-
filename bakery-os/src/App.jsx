import { useEffect, useState } from "react";
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

  useEffect(() => {
    async function init() {
      const { data: sessionData } = await supabase.auth.getSession();

      if (sessionData.session) {
        const user = sessionData.session.user;
        setUser(user);

        await fetchRole(user.id);
      }

      setLoading(false);
    }

    init();

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session) {
          const user = session.user;
          setUser(user);

          await fetchRole(user.id);
        } else {
          setUser(null);
          setRole(null);
        }
      }
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  // 🔥 central role fetch (IMPORTANT)
  async function fetchRole(userId) {
    const { data, error } = await supabase
      .from("users")
      .select("role")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      console.error("Role fetch error:", error);
      setRole(null);
      return;
    }

    if (!data) {
      console.error("User NOT in users table:", userId);

      // ⚠️ prevent infinite loading
      setRole("unknown");
      return;
    }

    setRole(data.role);
  }

  // 🔥 LOADING STATE (critical)
  if (loading) return <div>Initializing...</div>;

  if (!user) return <Login setUser={setUser} />;

  if (!role) return <div>Loading role...</div>;

  if (role === "worker") return <Production />;
  if (role === "sales") return <Sales />;
  if (role === "delivery") return <Transport />;
  if (role === "admin") return <Admin />;

  // 🔥 fallback (prevents infinite loop)
  return <div>User role not configured</div>;
}

export default App;