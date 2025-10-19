'use client';
import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://cdlwqgzvbrobhhtvmgum.supabase.co';
const SUPABASE_SERVICE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNkbHdxZ3p2YnJvYmhodHZtZ3VtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTkxMzU1MCwiZXhwIjoyMDc1NDg5NTUwfQ.Pfw74Yr95LLUDFsSPuxem_y4GYtKj8MAxzs1n9FvXWQ';

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

export default function SignUp() {
  const router = useRouter();

  const [form, setForm] = useState({
    full_name: '',
    email: '',
    password: '',
    confirm_password: '',
    country: '',
    discord_id: '',
    troop_type: '',
    hero_name: '',
    igg_id: '',
    bio: '',
    farm_account: false,
    troop_specialist: '',
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const troopOptions = ['Infantry', 'Rider', 'Ranged', 'Farm', 'Mixed'];

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm({ ...form, [name]: type === 'checkbox' ? checked : value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.full_name || !form.email || !form.password || !form.confirm_password) {
      setMessage('❌ Full Name, Email, and Password are required.');
      return;
    }
    if (form.password !== form.confirm_password) {
      setMessage('❌ Password and Confirm Password do not match.');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      // 1️⃣ Create user in Supabase Auth
      const { data: user, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: form.email,
        password: form.password,
        user_metadata: {
          full_name: form.full_name,
          country: form.country,
          discord_id: form.discord_id,
          troop_type: form.troop_type,
          hero_name: form.hero_name,
          igg_id: form.igg_id,
          bio: form.bio,
          farm_account: form.farm_account,
          troop_specialist: form.troop_specialist,
        },
        email_confirm: true,
      });

      if (authError) throw new Error(authError.message);

      // 2️⃣ Check if player already exists (email link)
      const { data: existingPlayer, error: fetchError } = await supabaseAdmin
        .from('players')
        .select('email')
        .eq('email', form.email)
        .maybeSingle();

      if (fetchError) throw new Error(fetchError.message);

      // 3️⃣ Update if exists, otherwise insert new
      if (existingPlayer) {
        const { error: updateError } = await supabaseAdmin
          .from('players')
          .update({
            full_name: form.full_name,
            country: form.country,
            discord_id: form.discord_id,
            troop_type: form.troop_type,
            hero_name: form.hero_name,
            igg_id: form.igg_id,
            bio: form.bio,
            has_farm: form.farm_account,
            troop_specialist: form.troop_specialist,
          })
          .eq('email', form.email);

        if (updateError) throw new Error(updateError.message);
      } else {
        const { error: insertError } = await supabaseAdmin.from('players').insert([
          {
            email: form.email,
            full_name: form.full_name,
            country: form.country,
            discord_id: form.discord_id,
            troop_type: form.troop_type,
            hero_name: form.hero_name,
            igg_id: form.igg_id,
            bio: form.bio,
            has_farm: form.farm_account,
            troop_specialist: form.troop_specialist,
          },
        ]);
        if (insertError) throw new Error(insertError.message);
      }

      setMessage('✅ Sign up successful! Redirecting to login...');
      setTimeout(() => router.push('/login'), 1500);
    } catch (err) {
      console.error(err);
      setMessage('❌ Failed to sign up: ' + err.message);
    }

    setLoading(false);
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 px-4">
      <div className="bg-gray-900 w-full max-w-lg rounded-2xl shadow-2xl p-8 flex flex-col items-center">
        <Image
          src="/logo.png"
          alt="HDX Logo"
          width={80}
          height={80}
          className="mb-4 rounded-full border-2 border-blue-400 shadow-md"
        />
        <h1 className="text-3xl font-bold text-blue-400 mb-6 text-center">
          HDX Alliance Sign Up
        </h1>

        {message && (
          <p
            className={`mb-4 text-center ${
              message.startsWith('✅') ? 'text-green-400' : 'text-red-400'
            }`}
          >
            {message}
          </p>
        )}

        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
          <input
            name="full_name"
            placeholder="Full Name (Required)"
            value={form.full_name}
            onChange={handleChange}
            required
            className="w-full px-4 py-3 rounded-xl border border-gray-700 bg-gray-800 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
          />
          <input
            type="email"
            name="email"
            placeholder="Email (Required)"
            value={form.email}
            onChange={handleChange}
            required
            className="w-full px-4 py-3 rounded-xl border border-gray-700 bg-gray-800 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
          />
          <input
            type="password"
            name="password"
            placeholder="Password (Required)"
            value={form.password}
            onChange={handleChange}
            required
            className="w-full px-4 py-3 rounded-xl border border-gray-700 bg-gray-800 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
          />
          <input
            type="password"
            name="confirm_password"
            placeholder="Confirm Password"
            value={form.confirm_password}
            onChange={handleChange}
            required
            className="w-full px-4 py-3 rounded-xl border border-gray-700 bg-gray-800 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
          />

          <input
            name="country"
            placeholder="Country (Optional)"
            value={form.country}
            onChange={handleChange}
            className="w-full px-4 py-3 rounded-xl border border-gray-700 bg-gray-800 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
          />

          <input
            name="discord_id"
            placeholder="Discord ID (Optional)"
            value={form.discord_id}
            onChange={handleChange}
            className="w-full px-4 py-3 rounded-xl border border-gray-700 bg-gray-800 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
          />

          <input
            name="troop_type"
            placeholder="Troop Type (Optional)"
            value={form.troop_type}
            onChange={handleChange}
            className="w-full px-4 py-3 rounded-xl border border-gray-700 bg-gray-800 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
          />

          <input
            name="hero_name"
            placeholder="Hero Name (Optional)"
            value={form.hero_name}
            onChange={handleChange}
            className="w-full px-4 py-3 rounded-xl border border-gray-700 bg-gray-800 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
          />

          <input
            name="igg_id"
            placeholder="IGG ID (Optional)"
            value={form.igg_id}
            onChange={handleChange}
            className="w-full px-4 py-3 rounded-xl border border-gray-700 bg-gray-800 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
          />

          <textarea
            name="bio"
            placeholder="Bio (Optional)"
            value={form.bio}
            onChange={handleChange}
            className="w-full px-4 py-3 rounded-xl border border-gray-700 bg-gray-800 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400 transition resize-none"
          />

          <select
            name="troop_specialist"
            value={form.troop_specialist}
            onChange={handleChange}
            className="w-full px-4 py-3 rounded-xl border border-gray-700 bg-gray-800 text-white focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
          >
            <option value="">Troop Specialist (Optional)</option>
            {troopOptions.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          <label className="flex items-center gap-2 text-gray-300">
            <input
              type="checkbox"
              name="farm_account"
              checked={form.farm_account}
              onChange={handleChange}
              className="accent-blue-400"
            />
            Has Farm Account
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 mt-2 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 text-white font-semibold hover:from-purple-500 hover:to-blue-500 transition-all shadow-lg"
          >
            {loading ? 'Signing up...' : 'Sign Up'}
          </button>
        </form>

        <p className="text-gray-400 text-sm mt-4 text-center">
          Already have an account?{' '}
          <a href="/login" className="text-blue-400 hover:text-blue-500 font-semibold">
            Login
          </a>
        </p>
      </div>
    </div>
  );
              }
