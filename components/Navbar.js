'use client';
import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Navbar() {
  const [session, setSession] = useState(null);
  const [role, setRole] = useState(null);
  const [fullName, setFullName] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [eventsDropdownOpen, setEventsDropdownOpen] = useState(false);

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);

      if (session?.user?.email) {
        const { data, error } = await supabase
          .from('players')
          .select('role, full_name')
          .eq('email', session.user.email)
          .single();

        if (!error && data) {
          setRole(data.role);
          setFullName(data.full_name);
        }
      }
    };

    getSession();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session) {
        setRole(null);
        setFullName('');
      }
    });

    return () => authListener.subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  const handleMenuClick = () => {
    setMobileMenuOpen(false);
    setEventsDropdownOpen(false);
  };

  return (
    <nav className="fixed top-0 left-0 w-full bg-gray-900 text-white shadow-lg z-50">
      <div className="max-w-7xl mx-auto flex justify-between items-center px-6 py-3">
        {/* Logo + Title */}
        <Link href="/" className="flex items-center gap-3 hover:opacity-90 transition-all duration-300" onClick={handleMenuClick}>
          <Image
            src="/logo.png"
            alt="HDX Logo"
            width={40}
            height={40}
            className="rounded-lg border border-blue-500 shadow-sm object-cover"
          />
          <span className="font-bold tracking-wide text-blue-400 text-2xl">
            HDX Alliance Portal
          </span>
        </Link>

        {/* Desktop Menu */}
        <div className="hidden md:flex items-center space-x-8">
          {!session ? (
            <>
              <Link href="/login" className="hover:text-blue-400 transition-colors">Login</Link>
              <Link href="/signup" className="hover:text-blue-400 transition-colors">Sign Up</Link>
            </>
          ) : (
            <>
              <span className="text-sm text-gray-300">
                Logged in as: <span className="font-semibold text-blue-300">{fullName}</span>
              </span>
              <Link href="/profile" className="hover:text-blue-400 transition-colors">Profile</Link>
              <Link href="/dashboard" className="hover:text-blue-400 transition-colors">Dashboard</Link>
							<Link href="/bulkreg" onClick={handleMenuClick} className="block hover:text-blue-400 transition">Bulk User Registration</Link>
              {/* Events Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setEventsDropdownOpen(!eventsDropdownOpen)}
                  className="hover:text-blue-400 transition-colors flex items-center gap-1 focus:outline-none"
                >
                  Events
                  <span className={`transform transition-transform duration-200 ${eventsDropdownOpen ? 'rotate-180' : 'rotate-0'}`}>▾</span>
                </button>

                <div
                  className={`absolute mt-2 right-0 w-48 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-50 transform transition-all duration-300 origin-top ${
                    eventsDropdownOpen ? 'scale-y-100 opacity-100' : 'scale-y-0 opacity-0 pointer-events-none'
                  }`}
                >
                  <Link href="/events" onClick={handleMenuClick} className="block px-4 py-2 hover:bg-gray-700 rounded-t-md">Event Performance</Link>
                  <Link href="/eventplayers" onClick={handleMenuClick} className="block px-4 py-2 hover:bg-gray-700">Event Players Selection</Link>
                  <Link href="/eventmgmt" onClick={handleMenuClick} className="block px-4 py-2 hover:bg-gray-700 rounded-b-md">Event Management</Link>
                </div>
              </div>

              <Link href="/playerdata" className="hover:text-blue-400 transition-colors">Player Data</Link>
              <Link href="/hof" className="hover:text-blue-400 transition-colors">Hall of Fame</Link>

              {role === 'admin' && (
                <span className="text-yellow-400 font-semibold text-sm">(Admin)</span>
              )}

              <button
                onClick={handleLogout}
                className="bg-blue-600 px-4 py-1.5 rounded-lg hover:bg-blue-700 transition-all shadow-md"
              >
                Logout
              </button>
            </>
          )}
        </div>

        {/* Mobile Toggle */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden focus:outline-none transition-transform duration-300 transform active:scale-90"
        >
          {mobileMenuOpen ? (
            <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile Menu with “Door Push” Animation */}
      <div
        className={`md:hidden bg-gray-800 border-t border-gray-700 overflow-hidden transform transition-all duration-500 ease-in-out origin-top ${
          mobileMenuOpen ? 'max-h-[500px] scale-y-100 opacity-100' : 'max-h-0 scale-y-0 opacity-0'
        }`}
      >
        <div className="px-6 py-3 space-y-3">
          {!session ? (
            <>
              <Link href="/login" onClick={handleMenuClick} className="block hover:text-blue-400 transition">Login</Link>
              <Link href="/signup" onClick={handleMenuClick} className="block hover:text-blue-400 transition">Sign Up</Link>
            </>
          ) : (
            <>
              <span className="block text-gray-300 mb-2">
                Logged in as: <span className="font-semibold text-blue-300">{fullName}</span>
              </span>
              <Link href="/profile" onClick={handleMenuClick} className="block hover:text-blue-400 transition">Profile</Link>
              <Link href="/dashboard" onClick={handleMenuClick} className="block hover:text-blue-400 transition">Dashboard</Link>

              {/* “Events” submenu inside mobile */}
              <details className="bg-gray-900 rounded-lg">
                <summary className="cursor-pointer px-4 py-2 hover:text-blue-400 select-none">Events</summary>
                <div className="px-4 py-2 space-y-2">
                  <Link href="/events" onClick={handleMenuClick} className="block hover:text-blue-400">Event Performance</Link>
                  <Link href="/eventplayers" onClick={handleMenuClick} className="block hover:text-blue-400">Event Players Selection</Link>
                  <Link href="/eventmgmt" onClick={handleMenuClick} className="block hover:text-blue-400">Event Management</Link>
                </div>
              </details>

              <Link href="/playerdata" onClick={handleMenuClick} className="block hover:text-blue-400 transition">Player Data</Link>
              <Link href="/hof" onClick={handleMenuClick} className="block hover:text-blue-400 transition">Hall of Fame</Link>

              {role === 'admin' && (
                <span className="block text-yellow-400 font-semibold">(Admin)</span>
              )}
              <button
                onClick={() => {
                  handleLogout();
                  handleMenuClick();
                }}
                className="w-full bg-blue-600 px-3 py-2 rounded-lg hover:bg-blue-700 mt-2 shadow-md"
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
