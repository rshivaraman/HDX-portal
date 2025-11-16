'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showReset, setShowReset] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetMsg, setResetMsg] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  // Load remembered email
  useEffect(() => {
    const savedEmail = localStorage.getItem('rememberedEmail');
    if (savedEmail) {
      setEmail(savedEmail);
      setRemember(true);
    }
  }, []);

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) router.replace('/profile');
    };
    checkSession();
  }, [router]);

  const showToast = (message, type = 'success', duration = 3000) => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type }), duration);
  };

  // 🔹 Log login attempts to audit table
  const logLoginEvent = async (success, message = '', playerData = {}) => {
    try {
      const ipData = await fetch('https://api.ipify.org?format=json')
        .then(r => r.json())
        .catch(() => ({ ip: 'Unknown' }));

      await supabase.from('login_audit_logs').insert({
        user_id: playerData?.user_id || null,
        email: playerData?.email || email,
        ip_address: ipData?.ip || 'Unknown',
        user_agent: navigator.userAgent,
        success,
        message,
      });
    } catch (err) {
      console.error('Audit log failed:', err);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (error) {
      const msg = error.message.includes('Email not confirmed')
        ? 'Please confirm your email before logging in.'
        : error.message;
      setErrorMsg(msg);
      await logLoginEvent(false, msg);
      showToast(msg, 'error');
      return;
    }

    if (data?.user) {
      if (!data.user.email_confirmed_at) {
        const msg = 'Your email is not confirmed yet. Check your inbox.';
        setErrorMsg(msg);
        await logLoginEvent(false, msg);
        showToast(msg, 'error');
        return;
      }

      // Remember username if checked
      if (remember) {
        localStorage.setItem('rememberedEmail', email);
      } else {
        localStorage.removeItem('rememberedEmail');
      }

      // Get player info
      const { data: playerData } = await supabase
        .from('players')
        .select('id, email, player_name, igg_id, country, user_id')
        .eq('email', email)
        .single();

      await logLoginEvent(true, 'Login successful', playerData || {});
      showToast('Login successful!', 'success');
      router.push('/profile');
    } else {
      const msg = 'Login failed. Please check your credentials.';
      setErrorMsg(msg);
      await logLoginEvent(false, msg);
      showToast(msg, 'error');
    }
  };

  const handlePasswordReset = async (e) => {
    e.preventDefault();
    setResetLoading(true);
    setResetMsg('');

    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    setResetLoading(false);
    if (error) {
      console.error('Password reset error:', error);
      setResetMsg('❌ ' + error.message);
      showToast(error.message, 'error');
    } else {
      setResetMsg('✅ Password reset email sent! Check your inbox.');
      setResetEmail('');
      showToast('Password reset email sent!', 'success');
    }
  };

  return (
    <div className="relative flex items-center justify-center min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 px-4">
      {/* Toast */}
      {toast.show && (
        <div
          className={`fixed top-5 left-1/2 transform -translate-x-1/2 px-6 py-3 rounded-xl shadow-lg text-white font-semibold z-50 transition-all duration-300 ${
            toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'
          }`}
        >
          {toast.message}
        </div>
      )}

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
        <Image
          src="/logo.png"
          alt="HDX Logo"
          width={80}
          height={80}
          className="mb-4 rounded-full border-2 border-blue-400 shadow-md"
        />
        <h1 className="text-3xl font-bold text-blue-400 mb-6 tracking-wide text-center">
          HDX Alliance Login
        </h1>

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

          {/* Remember Me */}
          <label className="flex items-center gap-2 text-gray-400 text-sm mt-1 cursor-pointer">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="form-checkbox h-4 w-4 text-blue-500 rounded border-gray-600 focus:ring-blue-400"
            />
            Remember my email
          </label>

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
          Don’t have an account?{' '}
          <a href="/signup" className="text-blue-400 hover:text-blue-500 font-semibold">
            Sign Up
          </a>
        </p>
      </div>
    </div>
  );
}
