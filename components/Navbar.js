'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Navbar() {
  const [session, setSession] = useState(null);
  const [role, setRole] = useState(null);

  // Fetch session and role
  const loadSession = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    setSession(session);

    if (session?.user?.email) {
      const { data, error } = await supabase
        .from('players')
        .select('role')
        .eq('email', session.user.email)
        .single();

      if (!error && data) {
        setRole(data.role); // make sure it matches exactly 'admin' in Supabase
      }
    }
  };

  useEffect(() => {
    loadSession();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user?.email) {
        supabase
          .from('players')
          .select('role')
          .eq('email', session.user.email)
          .single()
          .then(({ data, error }) => {
            if (!error && data) setRole(data.role);
          });
      } else {
        setRole(null);
      }
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setRole(null);
    window.location.href = '/';
  };

  return (
    <nav className="bg-gray-900 text-white py-3 shadow-md">
      <div className="max-w-6xl mx-auto flex justify-between items-center px-4">
        <h1 className="text-xl font-bold text-blue-400">HDX Alliance Portal</h1>

        <div className="space-x-6">
          {!session ? (
            <>
              <Link href="/login" className="hover:text-blue-400">Login</Link>
              <Link href="/signup" className="hover:text-blue-400">Sign Up</Link>
            </>
          ) : (
            <>
              <Link href="/profile" className="hover:text-blue-400">Profile</Link>
              {role === 'admin' && (
                <Link href="/dashboard" className="hover:text-blue-400">Dashboard</Link>
              )}
              <Link href="/hof" className="hover:text-blue-400">Hall of Fame</Link>
              <button
                onClick={handleLogout}
                className="bg-blue-600 px-3 py-1 rounded hover:bg-blue-700"
              >
                Logout
              </button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}