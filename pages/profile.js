'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Profile() {
  const [profile, setProfile] = useState({
    full_name: '',
    country: '',
    discord_id: '',
    join_date: '',
    bio: '',
    profile_image_url: '',
    troop_type: '',
    hero_name: '',
    might: '',
    farm_account: false,
    igg_id: '',
  });
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);

  // ✅ Load user profile on mount
  useEffect(() => {
    const loadProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const userEmail = session?.user?.email;
      setEmail(userEmail);

      if (!userEmail) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('players')
        .select('*')
        .eq('email', userEmail)
        .single();

      if (!error && data) {
        setProfile({
          full_name: data.full_name || '',
          country: data.country || '',
          discord_id: data.discord_id || '',
          join_date: data.join_date || '',
          bio: data.bio || '',
          profile_image_url: data.profile_image_url || '',
          troop_type: data.troop_type || '',
          hero_name: data.hero_name || '',
          might: data.might || '',
          farm_account: data.farm_account || false,
          igg_id: data.igg_id || '',
        });
      }

      setLoading(false);
    };

    loadProfile();
  }, []);

  // ✅ Handle form field change
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setProfile({
      ...profile,
      [name]: type === 'checkbox' ? checked : value,
    });
  };

  // ✅ Save profile to Supabase
  const handleSave = async () => {
    if (!email) {
      alert('No logged-in user found.');
      return;
    }

    const { error } = await supabase
      .from('players')
      .upsert({ ...profile, email });

    if (error) {
      console.error(error);
      alert('Error saving profile!');
    } else {
      alert('Profile saved successfully!');
    }
  };

  if (loading) return <p className="text-center mt-10">Loading profile...</p>;

  return (
    <div className="max-w-3xl mx-auto mt-10 p-6 bg-gray-800 text-white rounded-lg shadow-lg">
      <h1 className="text-2xl font-bold mb-6 text-blue-400">My Profile</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Object.keys(profile).map((key) => (
          <div key={key}>
            <label className="block mb-1 capitalize">{key.replace('_', ' ')}</label>
            {typeof profile[key] === 'boolean' ? (
              <input
                type="checkbox"
                name={key}
                checked={profile[key]}
                onChange={handleChange}
                className="mr-2"
              />
            ) : (
              <input
                type="text"
                name={key}
                value={profile[key]}
                onChange={handleChange}
                className="w-full p-2 rounded bg-gray-700 text-white"
              />
            )}
          </div>
        ))}
      </div>

      <button
        onClick={handleSave}
        className="mt-6 bg-blue-600 px-4 py-2 rounded hover:bg-blue-700"
      >
        Save Profile
      </button>
    </div>
  );
}