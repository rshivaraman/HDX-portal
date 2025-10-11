import { supabase } from "../lib/supabase";
import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

export default function Players() {
  const [players, setPlayers] = useState([]);

  useEffect(() => {
    fetchPlayers();
  }, []);

  const fetchPlayers = async () => {
    const { data, error } = await supabase.from("players").select("*");
    if (error) console.log(error);
    else setPlayers(data);
  };

  return (
    <div>
      <Navbar />
      <main className="p-6">
        <h1 className="text-3xl font-bold text-blue-700 mb-4">Players</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {players.map((p) => (
            <div key={p.id} className="p-4 bg-white shadow rounded">
              <h2 className="font-bold text-xl">{p.name}</h2>
              <p>Troop: {p.troop_type}</p>
              <p>Hero: {p.hero_name}</p>
              <p>Might: {p.might}</p>
              <p>Farm Account: {p.farm_account}</p>
            </div>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}