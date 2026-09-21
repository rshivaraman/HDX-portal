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

  // ---------------------------------------------------------
  // FETCH SESSION + PLAYER
  // ---------------------------------------------------------
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
            .maybeSingle();

          if (!error && data && mounted) {
            setRole(data.role);

            setPlayer({
              full_name: data.full_name || '',
              profile_image_url: data.profile_image_url || '',
            });
          }
        } else {
          setRole(null);

          setPlayer({
            full_name: '',
            profile_image_url: '',
          });
        }
      } catch (error) {
        console.error('Navbar session error:', error);

        if (mounted) {
          setSession(null);
          setRole(null);

          setPlayer({
            full_name: '',
            profile_image_url: '',
          });
        }
      } finally {
        if (mounted) {
          setLoadingProfile(false);
        }
      }
    };

    getSessionAndPlayer();

    // -------------------------------------------------------
    // AUTH STATE LISTENER
    // -------------------------------------------------------
    const {
      data: listener,
    } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        if (!mounted) return;

        setSession(newSession);

        if (newSession?.user?.email) {
          setLoadingProfile(true);

          const { data, error } = await supabase
            .from('players')
            .select('role, full_name, profile_image_url')
            .eq('email', newSession.user.email)
            .maybeSingle();

          if (!mounted) return;

          if (!error && data) {
            setRole(data.role);

            setPlayer({
              full_name: data.full_name || '',
              profile_image_url:
                data.profile_image_url || '',
            });
          } else {
            setRole(null);

            setPlayer({
              full_name: '',
              profile_image_url: '',
            });
          }

          setLoadingProfile(false);
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
      listener?.subscription?.unsubscribe();
    };
  }, []);

  // ---------------------------------------------------------
  // LOGOUT
  // ---------------------------------------------------------
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

  // ---------------------------------------------------------
  // MENU CLICK
  // ---------------------------------------------------------
  const handleMenuClick = () => {
    setMobileMenuOpen(false);
    setEventsDropdownOpen(false);
    setAdminOpsOpen(false);
  };

  // ---------------------------------------------------------
  // CLOSE MOBILE MENU WHEN OPENING DESKTOP DROPDOWN
  // ---------------------------------------------------------
  const toggleAdminOps = () => {
    setAdminOpsOpen((prev) => !prev);
    setEventsDropdownOpen(false);
  };

  const toggleEvents = () => {
    setEventsDropdownOpen((prev) => !prev);
    setAdminOpsOpen(false);
  };

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
          z-50
          w-full
          bg-gray-900
          text-white
          shadow-xl
        "
      >
        {/* ===================================================
            MAIN NAVBAR ROW

            Fixed height is intentional.

            h-20 = 80px

            This gives us a predictable height so the
            spacer below the fixed navbar can match it.
            =================================================== */}
        <div
          className="
            h-20
            max-w-7xl
            mx-auto
            flex
            items-center
            justify-between
            px-4
            sm:px-6
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
              shrink
              hover:opacity-90
              transition-all
              duration-300
            "
          >
            <Image
              src="/logo.jpg"
              alt="Agni Alliance Portal"
              width={40}
              height={40}
              priority
              className="
                w-10
                h-10
                shrink-0
                rounded-lg
                border
                border-blue-500
                shadow-md
                object-cover
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
                truncate
              "
            >
              Agni Alliance Portal
            </span>
          </Link>

          {/* =================================================
              DESKTOP MENU

              IMPORTANT:
              lg instead of md.

              This prevents the full desktop menu from
              being squeezed into tablet/landscape screens.
              ================================================= */}
          <div
            className="
              hidden
              lg:flex
              items-center
              gap-5
              xl:gap-6
              whitespace-nowrap
            "
          >
            {!session ? (
              <>
                <Link
                  href="/login"
                  className="hover:text-blue-400 transition"
                >
                  Login
                </Link>

                <Link
                  href="/signup"
                  className="hover:text-blue-400 transition"
                >
                  Sign Up
                </Link>
              </>
            ) : (
              <>
                {/* =========================================
                    PROFILE INFO
                    ========================================= */}
                <div
                  className={`
                    flex
                    items-center
                    gap-3
                    shrink-0
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
                      src={player.profile_image_url}
                      alt="Profile"
                      width={36}
                      height={36}
                      className="
                        w-9
                        h-9
                        shrink-0
                        rounded-full
                        border
                        border-blue-500
                        shadow-sm
                        object-cover
                      "
                    />
                  ) : (
                    <div
                      className="
                        w-9
                        h-9
                        shrink-0
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
                  className="hover:text-blue-400 transition"
                >
                  Profile
                </Link>

                {/* DASHBOARD */}
                <Link
                  href="/dashboard"
                  className="hover:text-blue-400 transition"
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
                  className="hover:text-blue-400 transition"
                >
                  Hall of Fame
                </Link>

                {/* LOGOUT */}
                <button
                  type="button"
                  onClick={handleLogout}
                  className="
                    shrink-0
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
                  "
                >
                  Logout
                </button>
              </>
            )}
          </div>

          {/* =================================================
              MOBILE / TABLET TOGGLE

              lg:hidden means tablets and smaller landscape
              screens get the hamburger menu.
              ================================================= */}
          <button
            type="button"
            onClick={() => {
              setMobileMenuOpen((prev) => !prev);
              setAdminOpsOpen(false);
              setEventsDropdownOpen(false);
            }}
            aria-label={
              mobileMenuOpen
                ? 'Close navigation menu'
                : 'Open navigation menu'
            }
            aria-expanded={mobileMenuOpen}
            className="
              lg:hidden
              shrink-0
              focus:outline-none
              transition-transform
              duration-300
              transform
              active:scale-90
              ml-3
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
            MOBILE / TABLET MENU
            =================================================== */}
        <div
          className={`
            lg:hidden
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
          <div className="px-6 py-4 space-y-3">
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
                {/* =========================================
                    MOBILE PROFILE
                    ========================================= */}
                <div className="flex items-center gap-3 pb-2">
                  {player.profile_image_url ? (
                    <Image
                      src={player.profile_image_url}
                      alt="Profile"
                      width={36}
                      height={36}
                      className="
                        w-9
                        h-9
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

                {/* =========================================
                    MOBILE ADMIN OPS
                    ========================================= */}
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

                {/* =========================================
                    MOBILE EVENTS
                    ========================================= */}
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
          NAVBAR SPACER

          CRITICAL FIX

          The Navbar is fixed, so it does not occupy normal
          document space.

          This spacer reserves exactly 80px for it, preventing
          every page's content from being hidden underneath
          the Navbar.

          Do NOT remove this.
          ===================================================== */}
      <div
        aria-hidden="true"
        className="h-20 w-full shrink-0"
      />
    </>
  );
}
