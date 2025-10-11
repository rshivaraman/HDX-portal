'use client';
import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useRouter } from 'next/navigation';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const router = useRouter();

  const handleLogin = async () => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert('Login failed: ' + error.message);
    else {
      router.push('/profile');
    }
  };

  return (
    <>

      <div className="max-w-md mx-auto mt-20 p-6 bg-white shadow-lg rounded-xl">
        <h2 className="text-2xl font-semibold mb-4 text-center">Login</h2>
        <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className="border p-2 rounded mb-2 w-full"/>
        <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} className="border p-2 rounded mb-2 w-full"/>
        <button onClick={handleLogin} className="bg-blue-600 text-white py-2 rounded w-full hover:bg-blue-700">Login</button>
      </div>
    </>
  );
}