import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useRouter } from 'next/navigation';


export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const router = useRouter();

  const handleLogin = async () => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return alert(error.message);

    // Redirect based on role
    const { data: profile } = await supabase
      .from('players')
      .select('role')
      .eq('email', email)
      .single();

    if (profile.role === 'admin') router.push('/dashboard');
    else router.push('/profile');
  };

  return (
    <>
      
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
        <h2 className="text-3xl font-bold mb-4">Login</h2>
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="border p-2 mb-2 rounded" />
        <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="border p-2 mb-2 rounded" />
        <button onClick={handleLogin} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Login</button>
      </div>
    </>
  );
}