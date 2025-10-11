// pages/register.js
import { useState } from "react";
import { supabase } from "../lib/supabase";
import { useRouter } from "next/router";
import Footer from "../components/Footer";

export default function Register(){
  const router = useRouter();
  const [form, setForm] = useState({ name:"", email:"", password:"", country:"", igg_id:"", discord_id:"" });
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e) => {
    e.preventDefault();
    setErr("");
    if (!form.name || !form.email || !form.password) { setErr("Name, email, password required"); return; }
    setLoading(true);

    // sign up in Supabase Auth
    const { data, error } = await supabase.auth.signUp({ email: form.email, password: form.password });
    if (error) { setErr(error.message); setLoading(false); return; }

    // create players profile
    const { error: pErr } = await supabase.from("players").insert([{
      email: form.email,
      name: form.name,
      country: form.country,
      igg_id: form.igg_id,
      discord_id: form.discord_id,
      role: "player"
    }]);
    if (pErr) { setErr(pErr.message); setLoading(false); return; }

    setLoading(false);
    router.push("/");
  };

  return (
    <div>
      
      <div className="container">
        <div className="card" style={{ maxWidth:600, margin:"0 auto" }}>
          <h2>Sign Up</h2>
          {err && <div style={{ color:"red", marginBottom:8 }}>{err}</div>}
          <form onSubmit={handleRegister}>
            <input className="input" placeholder="Full name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} />
            <input className="input" placeholder="Country" value={form.country} onChange={e=>setForm({...form,country:e.target.value})} />
            <input className="input" placeholder="IGG ID" value={form.igg_id} onChange={e=>setForm({...form,igg_id:e.target.value})} />
            <input className="input" placeholder="Discord ID" value={form.discord_id} onChange={e=>setForm({...form,discord_id:e.target.value})} />
            <input className="input" placeholder="Email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} />
            <input className="input" placeholder="Password" type="password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} />
            <div style={{ marginTop:12 }}>
              <button className="btn" type="submit" disabled={loading}>{loading ? "Please wait..." : "Register"}</button>
            </div>
          </form>
        </div>
      </div>
      <Footer />
    </div>
  );
}