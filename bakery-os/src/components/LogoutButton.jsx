import { supabase } from "../supabaseClient";

export default function LogoutButton() {
  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.reload(); // resets app state
  }

  return (
    <button onClick={handleLogout}>
      Logout
    </button>
  );
}