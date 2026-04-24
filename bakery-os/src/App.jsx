import { useEffect } from "react";
import { supabase } from "./supabaseClient";

import Admin from "./pages/Admin";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import Production from "./pages/Production";
import Sales from "./pages/Sales";
import Transport from "./pages/Transport";

function App() {
  return <Login />;
}

export default App;