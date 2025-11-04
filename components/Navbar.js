'use client';
import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Navbar() {
  const [session, setSession] = useState(null);
  const [role, setRole] = useState(null);
  const [player, setPlayer] = useState({ full_name: '', profile_image_url: '' });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [eventsDropdownOpen, setEventsDropdownOpen] = useState(false);
  const [adminOpsOpen, setAdminOpsOpen] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);

  // ✅ Fetch session and player data (auto-refresh on login)
  useEffect(() => {
    const getSessionAndPlayer = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      setLoadingProfile(true);

      if (session?.user?.email) {
        const { data, error } = await supabase
          .from('players')
          .select('role, full_name, profile_image_url')
          .eq('email', session.user.email)
          .single();

        if (!error && data) {
          setRole(data.role);
          setPlayer({
            full_name: data.full_name,
            profile_image_url: data.profile_image_url,
          });
        }
      }

      setLoadingProfile(false);
    };

    getSessionAndPlayer();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession?.user?.email) {
        supabase
          .from('players')
          .select('role, full_name, profile_image_url')
          .eq('email', newSession.user.email)
          .single()
          .then(({ data, error }) => {
            if (!error && data) {
              setRole(data.role);
              setPlayer({
                full_name: data.full_name,
                profile_image_url: data.profile_image_url,
              });
            }
          });
      } else {
        setRole(null);
        setPlayer({ full_name: '', profile_image_url: '' });
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  // ✅ Logout handler
  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setPlayer({ full_name: '', profile_image_url: '' });
    setRole(null);
    window.location.href = '/login';
  };

  const handleMenuClick = () => {
    setMobileMenuOpen(false);
    setEventsDropdownOpen(false);
    setAdminOpsOpen(false);
  };

  return (
    <nav className="fixed top-0 left-0 w-full bg-gray-900 text-white shadow-xl z-50">
      <div className="max-w-7xl mx-auto flex justify-between items-center px-6 py-3">
        {/* Logo + Title */}
        <Link
          href="/"
          onClick={handleMenuClick}
          className="flex items-center gap-3 hover:opacity-90 transition-all duration-300"
        >
          <Image
            src="/logo.png"
            alt="HDX Logo"
            width={40}
            height={40}
            className="rounded-lg border border-blue-500 shadow-md object-cover"
          />
          <span className="font-bold tracking-wide text-blue-400 text-2xl">
            HDX Alliance Portal
          </span>
        </Link>

        {/* Desktop Menu */}
        <div className="hidden md:flex items-center space-x-6">
          {!session ? (
            <>
              <Link href="/login" className="hover:text-blue-400 transition">Login</Link>
              <Link href="/signup" className="hover:text-blue-400 transition">Sign Up</Link>
            </>
          ) : (
            <>
              {/* Profile Info with Fade-in */}
              <div
                className={`flex items-center gap-3 transition-opacity duration-500 ${
                  loadingProfile ? 'opacity-0' : 'opacity-100'
                }`}
              >
                {player.profile_image_url ? (
                  <Image
                    src={player.profile_image_url}
                    alt="Profile"
                    width={36}
                    height={36}
                    className="rounded-full border border-blue-500 shadow-sm object-cover"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-gray-700 border border-gray-600 flex items-center justify-center text-gray-300">
                    👤
                  </div>
                )}
                <div className="text-sm leading-tight">
                  <p className="text-blue-300 font-semibold">{player.full_name}</p>
                  {role && (
                    <p className="text-gray-400 text-xs">
                      Role: <span className="text-yellow-400">{role}</span>
                    </p>
                  )}
                </div>
              </div>

              <Link href="/profile" className="hover:text-blue-400 transition">Profile</Link>
              <Link href="/dashboard" className="hover:text-blue-400 transition">Dashboard</Link>

              {/* 🔹 Admin Ops Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setAdminOpsOpen(!adminOpsOpen)}
                  className="hover:text-blue-400 transition-colors flex items-center gap-1 focus:outline-none"
                >
                  Admin Ops
                  <span
                    className={`transform transition-transform duration-200 ${
                      adminOpsOpen ? 'rotate-180' : 'rotate-0'
                    }`}
                  >
                    ▾
                  </span>
                </button>

                <div
                  className={`absolute mt-2 right-0 w-56 bg-gray-800 border border-gray-700 rounded-lg shadow-lg transform transition-all duration-300 origin-top ${
                    adminOpsOpen
                      ? 'scale-y-100 opacity-100'
                      : 'scale-y-0 opacity-0 pointer-events-none'
                  }`}
                >
                  <Link
                    href="/bulkreg"
                    onClick={handleMenuClick}
                    className="block px-4 py-2 hover:bg-gray-700 rounded-t-md"
                  >
                    Bulk User Registration
                  </Link>
                  <Link
                    href="/loginlogs"
                    onClick={handleMenuClick}
                    className="block px-4 py-2 hover:bg-gray-700"
                  >
                    User Login Audits
                  </Link>
                  <Link
                    href="/playerdata"
                    onClick={handleMenuClick}
                    className="block px-4 py-2 hover:bg-gray-700 rounded-b-md"
                  >
                    Player Data
                  </Link>
                </div>
              </div>

              {/* 🔹 Events Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setEventsDropdownOpen(!eventsDropdownOpen)}
                  className="hover:text-blue-400 transition-colors flex items-center gap-1 focus:outline-none"
                >
                  Events
                  <span
                    className={`transform transition-transform duration-200 ${
                      eventsDropdownOpen ? 'rotate-180' : 'rotate-0'
                    }`}
                  >
                    ▾
                  </span>
                </button>

                <div
                  className={`absolute mt-2 right-0 w-52 bg-gray-800 border border-gray-700 rounded-lg shadow-lg transform transition-all duration-300 origin-top ${
                    eventsDropdownOpen
                      ? 'scale-y-100 opacity-100'
                      : 'scale-y-0 opacity-0 pointer-events-none'
                  }`}
                >
                  <Link href="/events" onClick={handleMenuClick} className="block px-4 py-2 hover:bg-gray-700 rounded-t-md">
                    Event Performance
                  </Link>
                  <Link href="/eventplayers" onClick={handleMenuClick} className="block px-4 py-2 hover:bg-gray-700">
                    Event Players Selection
                  </Link>
                  <Link href="/eventmgmt" onClick={handleMenuClick} className="block px-4 py-2 hover:bg-gray-700 rounded-b-md">
                    Event Management
                  </Link>
                </div>
              </div>

              <Link href="/hof" className="hover:text-blue-400 transition">Hall of Fame</Link>

              <button
                onClick={handleLogout}
                className="bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-1.5 rounded-lg hover:from-purple-600 hover:to-blue-600 transition-all shadow-md"
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

      {/* Mobile Menu */}
      <div
        className={`md:hidden bg-gray-800 border-t border-gray-700 overflow-hidden transform transition-all duration-500 ease-in-out origin-top ${
          mobileMenuOpen ? 'max-h-[600px] scale-y-100 opacity-100' : 'max-h-0 scale-y-0 opacity-0'
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
              <div className="flex items-center gap-3">
                {player.profile_image_url ? (
                  <Image
                    src={player.profile_image_url}
                    alt="Profile"
                    width={36}
                    height={36}
                    className="rounded-full border border-blue-500 object-cover"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-gray-700 border border-gray-600 flex items-center justify-center text-gray-300">
                    👤
                  </div>
                )}
                <div>
                  <p className="text-blue-300 font-semibold">{player.full_name}</p>
                  {role && <p className="text-yellow-400 text-xs">({role})</p>}
                </div>
              </div>

              <Link href="/profile" onClick={handleMenuClick} className="block hover:text-blue-400 transition">Profile</Link>
              <Link href="/dashboard" onClick={handleMenuClick} className="block hover:text-blue-400 transition">Dashboard</Link>

              {/* Admin Ops dropdown */}
              <details className="bg-gray-900 rounded-lg">
                <summary className="cursor-pointer px-4 py-2 hover:text-blue-400 select-none">Admin Ops</summary>
                <div className="px-4 py-2 space-y-2">
                  <Link href="/bulkreg" onClick={handleMenuClick} className="block hover:text-blue-400">Bulk User Registration</Link>
                  <Link href="/loginlogs" onClick={handleMenuClick} className="block hover:text-blue-400">User Login Audits</Link>
                  <Link href="/playerdata" onClick={handleMenuClick} className="block hover:text-blue-400">Player Data</Link>
                </div>
              </details>

              {/* Events dropdown */}
              <details className="bg-gray-900 rounded-lg">
                <summary className="cursor-pointer px-4 py-2 hover:text-blue-400 select-none">Events</summary>
                <div className="px-4 py-2 space-y-2">
                  <Link href="/events" onClick={handleMenuClick} className="block hover:text-blue-400">Event Performance</Link>
                  <Link href="/eventplayers" onClick={handleMenuClick} className="block hover:text-blue-400">Event Players Selection</Link>
                  <Link href="/eventmgmt" onClick={handleMenuClick} className="block hover:text-blue-400">Event Management</Link>
                </div>
              </details>

              <Link href="/hof" onClick={handleMenuClick} className="block hover:text-blue-400 transition">Hall of Fame</Link>

              <button
                onClick={() => {
                  handleLogout();
                  handleMenuClick();
                }}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 px-3 py-2 rounded-lg hover:from-purple-600 hover:to-blue-600 mt-2 shadow-md"
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
