'use client';
import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import Image from 'next/image';

export default function SignUp() {
  const [form, setForm] = useState({
    full_name: '',
    email: '',
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

  const troopOptions = ['Infantry', 'Rider', 'Ranged', 'Garrison', 'Mixed'];

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm({ ...form, [name]: type === 'checkbox' ? checked : value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.full_name || !form.email) {
      setMessage('❌ Full Name and Email are mandatory.');
      return;
    }

    setLoading(true);
    setMessage('');

    const { error } = await supabase.from('players').insert([
      {
        full_name: form.full_name,
        email: form.email,
        country: form.country || null,
        discord_id: form.discord_id || null,
        troop_type: form.troop_type || null,
        hero_name: form.hero_name || null,
        igg_id: form.igg_id || null,
        bio: form.bio || null,
        farm_account: form.farm_account,
        troop_specialist: form.troop_specialist || null,
        role: 'member',
        join_date: new Date().toISOString().split('T')[0],
      },
    ]);

    if (error) {
      setMessage('❌ Database error: ' + error.message);
    } else {
      setMessage('✅ Sign up successful!');
      setForm({
        full_name: '',
        email: '',
        country: '',
        discord_id: '',
        troop_type: '',
        hero_name: '',
        igg_id: '',
        bio: '',
        farm_account: false,
        troop_specialist: '',
      });
    }

    setLoading(false);
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 px-4">
      <div className="bg-gray-900 w-full max-w-lg rounded-2xl shadow-2xl p-8 flex flex-col items-center">
        {/* Logo */}
        <Image
          src="/logo.png"
          alt="HDX Logo"
          width={80}
          height={80}
          className="mb-4 rounded-full border-2 border-blue-400 shadow-md"
        />

        {/* Title */}
        <h1 className="text-3xl font-bold text-blue-400 mb-6 text-center">
          HDX Alliance Sign Up
        </h1>

        {/* Feedback Message */}
        {message && (
          <p
            className={`mb-4 text-center ${
              message.startsWith('✅') ? 'text-green-400' : 'text-red-400'
            }`}
          >
            {message}
          </p>
        )}

        {/* Form */}
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
            className="w-full px-4 py-3 rounded-xl border border-gray-700 bg-gray-800 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
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