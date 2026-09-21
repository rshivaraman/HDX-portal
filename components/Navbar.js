'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Navbar() {
  const [session, setSession] = useState(null);
  const [role, setRole] = useState(null);

  const [player, setPlayer] = useState({
    full_name: '',
    profile_image_url: '',
  });

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [eventsDropdownOpen, setEventsDropdownOpen] = useState(false);
  const [adminOpsOpen, setAdminOpsOpen] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);

  // =========================================================
  // FETCH SESSION + PLAYER DATA
  // =========================================================
  useEffect(() => {
    let mounted = true;

    const getSessionAndPlayer = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!mounted) return;

        setSession(session);
        setLoadingProfile(true);

        if (session?.user?.email) {
          const { data, error } = await supabase
            .from('players')
            .select('role, full_name, profile_image_url')
            .eq('email', session.user.email)
            .single();

          if (!mounted) return;

          if (!error && data) {
            setRole(data.role);

            setPlayer({
              full_name: data.full_name || '',
              profile_image_url:
                data.profile_image_url || '',
            });
          }
        }
      } catch (error) {
        console.error(
          'Failed to load session/player:',
          error
        );
      } finally {
        if (mounted) {
          setLoadingProfile(false);
        }
      }
    };

    getSessionAndPlayer();

    // =======================================================
    // AUTH STATE CHANGE
    // =======================================================
    const {
      data: listener,
    } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        if (!mounted) return;

        setSession(newSession);

        if (newSession?.user?.email) {
          setLoadingProfile(true);

          supabase
            .from('players')
            .select(
              'role, full_name, profile_image_url'
            )
            .eq(
              'email',
              newSession.user.email
            )
            .single()
            .then(({ data, error }) => {
              if (!mounted) return;

              if (!error && data) {
                setRole(data.role);

                setPlayer({
                  full_name:
                    data.full_name || '',
                  profile_image_url:
                    data.profile_image_url || '',
                });
              }

              setLoadingProfile(false);
            });
        } else {
          setRole(null);

          setPlayer({
            full_name: '',
            profile_image_url: '',
          });

          setLoadingProfile(false);
        }
      }
    );

    return () => {
      mounted = false;

      if (listener?.subscription) {
        listener.subscription.unsubscribe();
      }
    };
  }, []);

  // =========================================================
  // LOGOUT
  // =========================================================
  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Logout error:', error);
    }

    setSession(null);

    setPlayer({
      full_name: '',
      profile_image_url: '',
    });

    setRole(null);

    setMobileMenuOpen(false);
    setEventsDropdownOpen(false);
    setAdminOpsOpen(false);

    window.location.href = '/login';
  };

  // =========================================================
  // MENU CLICK
  // =========================================================
  const handleMenuClick = () => {
    setMobileMenuOpen(false);
    setEventsDropdownOpen(false);
    setAdminOpsOpen(false);
  };

  // =========================================================
  // TOGGLE ADMIN OPS
  // =========================================================
  const toggleAdminOps = () => {
    setAdminOpsOpen((previous) => !previous);
    setEventsDropdownOpen(false);
  };

  // =========================================================
  // TOGGLE EVENTS
  // =========================================================
  const toggleEvents = () => {
    setEventsDropdownOpen((previous) => !previous);
    setAdminOpsOpen(false);
  };

  // =========================================================
  // RENDER
  // =========================================================
  return (
    <>
      {/* =====================================================
          FIXED NAVBAR
          ===================================================== */}
      <nav
        className="
          fixed
          top-0
          left-0
          right-0
          w-full
          bg-gray-900
          text-white
          shadow-xl
          z-50
        "
      >
        {/* ===================================================
            NAVBAR MAIN ROW
            =================================================== */}
        <div
          className="
            max-w-7xl
            mx-auto
            flex
            justify-between
            items-center
            px-6
            py-3
          "
        >
          {/* =================================================
              LOGO + TITLE
              ================================================= */}
          <Link
            href="/"
            onClick={handleMenuClick}
            className="
              flex
              items-center
              gap-3
              min-w-0
              shrink-0
              hover:opacity-90
              transition-all
              duration-300
            "
          >
            <Image
              src="/logo.jpg"
              alt="Logo"
              width={40}
              height={40}
              priority
              className="
                rounded-lg
                border
                border-blue-500
                shadow-md
                object-cover
                shrink-0
              "
            />

            <span
              className="
                font-bold
                tracking-wide
                text-blue-400
                text-xl
                sm:text-2xl
                whitespace-nowrap
              "
            >
              Agni Alliance Portal
            </span>
          </Link>

          {/* =================================================
              DESKTOP MENU
              ================================================= */}
          <div
            className="
              hidden
              md:flex
              items-center
              space-x-6
              shrink-0
            "
          >
            {!session ? (
              <>
                <Link
                  href="/login"
                  className="
                    hover:text-blue-400
                    transition
                  "
                >
                  Login
                </Link>

                <Link
                  href="/signup"
                  className="
                    hover:text-blue-400
                    transition
                  "
                >
                  Sign Up
                </Link>
              </>
            ) : (
              <>
                {/* ===========================================
                    PROFILE INFO
                    =========================================== */}
                <div
                  className={`
                    flex
                    items-center
                    gap-3
                    transition-opacity
                    duration-500
                    ${
                      loadingProfile
                        ? 'opacity-0'
                        : 'opacity-100'
                    }
                  `}
                >
                  {player.profile_image_url ? (
                    <Image
                      src={
                        player.profile_image_url
                      }
                      alt="Profile"
                      width={36}
                      height={36}
                      className="
                        rounded-full
                        border
                        border-blue-500
                        shadow-sm
                        object-cover
                        shrink-0
                      "
                    />
                  ) : (
                    <div
                      className="
                        w-9
                        h-9
                        rounded-full
                        bg-gray-700
                        border
                        border-gray-600
                        flex
                        items-center
                        justify-center
                        text-gray-300
                        shrink-0
                      "
                    >
                      👤
                    </div>
                  )}

                  <div className="text-sm leading-tight">
                    <p className="text-blue-300 font-semibold">
                      {player.full_name}
                    </p>

                    {role && (
                      <p className="text-gray-400 text-xs">
                        Role:{' '}
                        <span className="text-yellow-400">
                          {role}
                        </span>
                      </p>
                    )}
                  </div>
                </div>

                {/* PROFILE */}
                <Link
                  href="/profile"
                  className="
                    hover:text-blue-400
                    transition
                    whitespace-nowrap
                  "
                >
                  Profile
                </Link>

                {/* DASHBOARD */}
                <Link
                  href="/dashboard"
                  className="
                    hover:text-blue-400
                    transition
                    whitespace-nowrap
                  "
                >
                  Dashboard
                </Link>

                {/* =========================================
                    ADMIN OPS
                    ========================================= */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={toggleAdminOps}
                    className="
                      hover:text-blue-400
                      transition-colors
                      flex
                      items-center
                      gap-1
                      focus:outline-none
                      whitespace-nowrap
                    "
                  >
                    Admin Ops

                    <span
                      className={`
                        transform
                        transition-transform
                        duration-200
                        ${
                          adminOpsOpen
                            ? 'rotate-180'
                            : 'rotate-0'
                        }
                      `}
                    >
                      ▾
                    </span>
                  </button>

                  <div
                    className={`
                      absolute
                      mt-2
                      right-0
                      w-56
                      bg-gray-800
                      border
                      border-gray-700
                      rounded-lg
                      shadow-lg
                      transform
                      transition-all
                      duration-300
                      origin-top
                      ${
                        adminOpsOpen
                          ? 'scale-y-100 opacity-100'
                          : 'scale-y-0 opacity-0 pointer-events-none'
                      }
                    `}
                  >
                    <Link
                      href="/bulkreg"
                      onClick={handleMenuClick}
                      className="
                        block
                        px-4
                        py-2
                        hover:bg-gray-700
                        rounded-t-md
                      "
                    >
                      Bulk User Registration
                    </Link>

                    <Link
                      href="/loginlogs"
                      onClick={handleMenuClick}
                      className="
                        block
                        px-4
                        py-2
                        hover:bg-gray-700
                      "
                    >
                      User Login Audits
                    </Link>

                    <Link
                      href="/playerdata"
                      onClick={handleMenuClick}
                      className="
                        block
                        px-4
                        py-2
                        hover:bg-gray-700
                        rounded-b-md
                      "
                    >
                      Player Data
                    </Link>
                  </div>
                </div>

                {/* =========================================
                    EVENTS
                    ========================================= */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={toggleEvents}
                    className="
                      hover:text-blue-400
                      transition-colors
                      flex
                      items-center
                      gap-1
                      focus:outline-none
                      whitespace-nowrap
                    "
                  >
                    Events

                    <span
                      className={`
                        transform
                        transition-transform
                        duration-200
                        ${
                          eventsDropdownOpen
                            ? 'rotate-180'
                            : 'rotate-0'
                        }
                      `}
                    >
                      ▾
                    </span>
                  </button>

                  <div
                    className={`
                      absolute
                      mt-2
                      right-0
                      w-52
                      bg-gray-800
                      border
                      border-gray-700
                      rounded-lg
                      shadow-lg
                      transform
                      transition-all
                      duration-300
                      origin-top
                      ${
                        eventsDropdownOpen
                          ? 'scale-y-100 opacity-100'
                          : 'scale-y-0 opacity-0 pointer-events-none'
                      }
                    `}
                  >
                    <Link
                      href="/events"
                      onClick={handleMenuClick}
                      className="
                        block
                        px-4
                        py-2
                        hover:bg-gray-700
                        rounded-t-md
                      "
                    >
                      Event Performance
                    </Link>

                    <Link
                      href="/eventplayers"
                      onClick={handleMenuClick}
                      className="
                        block
                        px-4
                        py-2
                        hover:bg-gray-700
                      "
                    >
                      Event Players Selection
                    </Link>

                    <Link
                      href="/eventmgmt"
                      onClick={handleMenuClick}
                      className="
                        block
                        px-4
                        py-2
                        hover:bg-gray-700
                      "
                    >
                      Event Management
                    </Link>

                    <Link
                      href="/coalition"
                      onClick={handleMenuClick}
                      className="
                        block
                        px-4
                        py-2
                        hover:bg-gray-700
                      "
                    >
                      Coalition Management
                    </Link>

                    <Link
                      href="/diceevent"
                      onClick={handleMenuClick}
                      className="
                        block
                        px-4
                        py-2
                        hover:bg-gray-700
                        rounded-b-md
                      "
                    >
                      DS Dice Event Management
                    </Link>
                  </div>
                </div>

                {/* HALL OF FAME */}
                <Link
                  href="/hof"
                  className="
                    hover:text-blue-400
                    transition
                    whitespace-nowrap
                  "
                >
                  Hall of Fame
                </Link>

                {/* LOGOUT */}
                <button
                  type="button"
                  onClick={handleLogout}
                  className="
                    bg-gradient-to-r
                    from-blue-600
                    to-purple-600
                    px-4
                    py-1.5
                    rounded-lg
                    hover:from-purple-600
                    hover:to-blue-600
                    transition-all
                    shadow-md
                    whitespace-nowrap
                  "
                >
                  Logout
                </button>
              </>
            )}
          </div>

          {/* =================================================
              MOBILE MENU BUTTON
              ================================================= */}
          <button
            type="button"
            onClick={() => {
              setMobileMenuOpen(
                (previous) => !previous
              );

              setEventsDropdownOpen(false);
              setAdminOpsOpen(false);
            }}
            aria-label={
              mobileMenuOpen
                ? 'Close menu'
                : 'Open menu'
            }
            aria-expanded={mobileMenuOpen}
            className="
              md:hidden
              shrink-0
              focus:outline-none
              transition-transform
              duration-300
              transform
              active:scale-90
            "
          >
            {mobileMenuOpen ? (
              <svg
                className="w-7 h-7"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            ) : (
              <svg
                className="w-7 h-7"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            )}
          </button>
        </div>

        {/* ===================================================
            MOBILE MENU
            =================================================== */}
        <div
          className={`
            md:hidden
            bg-gray-800
            border-t
            border-gray-700
            overflow-hidden
            transform
            transition-all
            duration-500
            ease-in-out
            origin-top
            ${
              mobileMenuOpen
                ? 'max-h-[700px] scale-y-100 opacity-100'
                : 'max-h-0 scale-y-0 opacity-0'
            }
          `}
        >
          <div className="px-6 py-3 space-y-3">
            {!session ? (
              <>
                <Link
                  href="/login"
                  onClick={handleMenuClick}
                  className="
                    block
                    hover:text-blue-400
                    transition
                  "
                >
                  Login
                </Link>

                <Link
                  href="/signup"
                  onClick={handleMenuClick}
                  className="
                    block
                    hover:text-blue-400
                    transition
                  "
                >
                  Sign Up
                </Link>
              </>
            ) : (
              <>
                {/* MOBILE PROFILE */}
                <div className="flex items-center gap-3">
                  {player.profile_image_url ? (
                    <Image
                      src={
                        player.profile_image_url
                      }
                      alt="Profile"
                      width={36}
                      height={36}
                      className="
                        rounded-full
                        border
                        border-blue-500
                        object-cover
                      "
                    />
                  ) : (
                    <div
                      className="
                        w-9
                        h-9
                        rounded-full
                        bg-gray-700
                        border
                        border-gray-600
                        flex
                        items-center
                        justify-center
                        text-gray-300
                      "
                    >
                      👤
                    </div>
                  )}

                  <div>
                    <p className="text-blue-300 font-semibold">
                      {player.full_name}
                    </p>

                    {role && (
                      <p className="text-yellow-400 text-xs">
                        ({role})
                      </p>
                    )}
                  </div>
                </div>

                {/* PROFILE */}
                <Link
                  href="/profile"
                  onClick={handleMenuClick}
                  className="
                    block
                    hover:text-blue-400
                    transition
                  "
                >
                  Profile
                </Link>

                {/* DASHBOARD */}
                <Link
                  href="/dashboard"
                  onClick={handleMenuClick}
                  className="
                    block
                    hover:text-blue-400
                    transition
                  "
                >
                  Dashboard
                </Link>

                {/* ADMIN OPS */}
                <details className="bg-gray-900 rounded-lg">
                  <summary
                    className="
                      cursor-pointer
                      px-4
                      py-2
                      hover:text-blue-400
                      select-none
                    "
                  >
                    Admin Ops
                  </summary>

                  <div className="px-4 py-2 space-y-2">
                    <Link
                      href="/bulkreg"
                      onClick={handleMenuClick}
                      className="
                        block
                        hover:text-blue-400
                      "
                    >
                      Bulk User Registration
                    </Link>

                    <Link
                      href="/loginlogs"
                      onClick={handleMenuClick}
                      className="
                        block
                        hover:text-blue-400
                      "
                    >
                      User Login Audits
                    </Link>

                    <Link
                      href="/playerdata"
                      onClick={handleMenuClick}
                      className="
                        block
                        hover:text-blue-400
                      "
                    >
                      Player Data
                    </Link>
                  </div>
                </details>

                {/* EVENTS */}
                <details className="bg-gray-900 rounded-lg">
                  <summary
                    className="
                      cursor-pointer
                      px-4
                      py-2
                      hover:text-blue-400
                      select-none
                    "
                  >
                    Events
                  </summary>

                  <div className="px-4 py-2 space-y-2">
                    <Link
                      href="/events"
                      onClick={handleMenuClick}
                      className="
                        block
                        hover:text-blue-400
                      "
                    >
                      Event Performance
                    </Link>

                    <Link
                      href="/eventplayers"
                      onClick={handleMenuClick}
                      className="
                        block
                        hover:text-blue-400
                      "
                    >
                      Event Players Selection
                    </Link>

                    <Link
                      href="/eventmgmt"
                      onClick={handleMenuClick}
                      className="
                        block
                        hover:text-blue-400
                      "
                    >
                      Event Management
                    </Link>

                    <Link
                      href="/coalition"
                      onClick={handleMenuClick}
                      className="
                        block
                        hover:text-blue-400
                      "
                    >
                      Coalition Management
                    </Link>

                    <Link
                      href="/diceevent"
                      onClick={handleMenuClick}
                      className="
                        block
                        hover:text-blue-400
                      "
                    >
                      DS Dice Event Management
                    </Link>
                  </div>
                </details>

                {/* HALL OF FAME */}
                <Link
                  href="/hof"
                  onClick={handleMenuClick}
                  className="
                    block
                    hover:text-blue-400
                    transition
                  "
                >
                  Hall of Fame
                </Link>

                {/* LOGOUT */}
                <button
                  type="button"
                  onClick={() => {
                    handleLogout();
                    handleMenuClick();
                  }}
                  className="
                    w-full
                    bg-gradient-to-r
                    from-blue-600
                    to-purple-600
                    px-3
                    py-2
                    rounded-lg
                    hover:from-purple-600
                    hover:to-blue-600
                    mt-2
                    shadow-md
                  "
                >
                  Logout
                </button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* =====================================================
          NAVBAR SPACE RESERVATION
          
          IMPORTANT:
          The navbar is fixed, so it doesn't occupy document
          space. This invisible element reserves that space
          for every page.

          Mobile: 80px
          Desktop: 72px
          ===================================================== */}
      <div
        aria-hidden="true"
        className="
          h-[80px]
          md:h-[72px]
          w-full
          shrink-0
        "
      />
    </>
  );
}
