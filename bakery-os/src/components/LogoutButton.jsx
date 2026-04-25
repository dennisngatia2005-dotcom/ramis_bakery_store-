import { supabase } from "../supabaseClient";

export default function LogoutButton() {
  async function handleLogout() {
    try {
      // 1. GET CURRENT USER
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        // 2. FIND ACTIVE SESSION
        const { data: session } = await supabase
          .from("staff_sessions")
          .select("*")
          .eq("user_id", user.id)
          .is("logout_time", null)
          .order("login_time", { ascending: false })
          .limit(1)
          .maybeSingle();

        // 3. CLOSE SESSION
        if (session) {
          await supabase
            .from("staff_sessions")
            .update({
              logout_time: new Date().toISOString(),
            })
            .eq("id", session.id);
        }
      }

      // 4. LOG OUT
      await supabase.auth.signOut();

      window.location.reload();
    } catch (err) {
      console.error(err);
      alert("Logout failed");
    }
  }

  return (
    <button onClick={handleLogout} className="btn btn-ghost">
      Logout
    </button>
  );
}