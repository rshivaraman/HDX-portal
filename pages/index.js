'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showReset, setShowReset] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetMsg, setResetMsg] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) router.replace('/profile');
    };
    checkSession();
  }, [router]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);

    if (error) {
      if (error.message.includes('Email not confirmed')) {
        setErrorMsg('Please confirm your email before logging in.');
      } else {
        setErrorMsg(error.message);
      }
      console.error('Login error:', error);
      return;
    }

    if (data?.user) {
      if (!data.user.email_confirmed_at) {
        setErrorMsg('Your email is not confirmed yet. Check your inbox.');
        return;
      }

      router.push('/profile');
    } else {
      setErrorMsg('Login failed. Please check your credentials.');
    }
  };

  const handlePasswordReset = async (e) => {
    e.preventDefault();
    setResetLoading(true);
    setResetMsg('');

    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${window.location.origin}/reset-password`, // You can handle reset here
    });

    setResetLoading(false);

    if (error) {
      console.error('Password reset error:', error);
      setResetMsg('❌ ' + error.message);
    } else {
      setResetMsg('✅ Password reset email sent! Check your inbox.');
      setResetEmail('');
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 px-4 relative">
      {/* Reset Password Modal */}
      {showReset && (
        <div className="absolute inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
          <div className="bg-gray-900 w-full max-w-md rounded-2xl shadow-xl p-6 text-center relative">
            <h2 className="text-2xl font-bold text-blue-400 mb-4">Reset Password</h2>
            <p className="text-gray-400 text-sm mb-4">
              Enter your email to receive a password reset link.
            </p>
            <form onSubmit={handlePasswordReset} className="flex flex-col gap-3">
              <input
                type="email"
                placeholder="Enter your email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl border border-gray-700 bg-gray-800 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
              />
              <button
                type="submit"
                disabled={resetLoading}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 text-white font-semibold hover:from-purple-500 hover:to-blue-500 transition-all shadow-lg"
              >
                {resetLoading ? 'Sending...' : 'Send Reset Link'}
              </button>
            </form>

            {resetMsg && (
              <p
                className={`mt-4 text-sm ${
                  resetMsg.startsWith('✅') ? 'text-green-400' : 'text-red-400'
                }`}
              >
                {resetMsg}
              </p>
            )}

            <button
              onClick={() => setShowReset(false)}
              className="absolute top-2 right-3 text-gray-400 hover:text-white text-xl"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Login Card */}
      <div className="bg-gray-900 w-full max-w-md rounded-2xl shadow-2xl p-8 flex flex-col items-center">
        <Image src="/logo.png" alt="HDX Logo" width={80} height={80} className="mb-4 rounded-full border-2 border-blue-400 shadow-md" />
        <h1 className="text-3xl font-bold text-blue-400 mb-6 tracking-wide text-center">HDX Alliance Login</h1>

        <form onSubmit={handleLogin} className="w-full flex flex-col gap-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-4 py-3 rounded-xl border border-gray-700 bg-gray-800 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full px-4 py-3 rounded-xl border border-gray-700 bg-gray-800 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 mt-2 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 text-white font-semibold hover:from-purple-500 hover:to-blue-500 transition-all shadow-lg"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        {errorMsg && <p className="text-red-500 text-sm mt-3 text-center">{errorMsg}</p>}

        <p className="text-gray-400 text-sm mt-4 text-center">
          Forgot your password?{' '}
          <button
            onClick={() => setShowReset(true)}
            className="text-blue-400 hover:text-blue-500 font-semibold underline"
          >
            Reset here
          </button>
        </p>

        <p className="text-gray-400 text-sm mt-2 text-center">
          Don't have an account?{' '}
          <a href="/signup" className="text-blue-400 hover:text-blue-500 font-semibold">
            Sign Up
          </a>
        </p>
      </div>
    </div>
  );
}
