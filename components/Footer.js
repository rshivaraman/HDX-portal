export default function Footer() {
  return (
    <footer className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 text-gray-300 border-t border-gray-800 mt-10 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 py-8 flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
        
        {/* Left: Logo and Info */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg">
            HDX
          </div>
          <div>
            <h2 className="text-lg font-semibold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
              HDX Alliance Portal
            </h2>
            <p className="text-sm text-gray-400">
              Powered by Supabase ⚡ Built for Doomsday Survivors.
            </p>
          </div>
        </div>

        {/* Center: Quick Links */}
        <div className="flex flex-wrap justify-center gap-6 text-sm">
          <a href="/dashboard" className="hover:text-blue-400 transition">Dashboard</a>
          <a href="/events" className="hover:text-blue-400 transition">Events</a>
          <a href="/eventplayers" className="hover:text-blue-400 transition">Event Players</a>
          <a href="/hof" className="hover:text-blue-400 transition">Hall of Fame</a>
          <a href="/profile" className="hover:text-blue-400 transition">Profile</a>
        </div>

        {/* Right: Social Links */}
        <div className="flex items-center space-x-4">
          <a
            href="https://discord.gg/"
            target="_blank"
            rel="noopener noreferrer"
            className="group relative text-gray-400 hover:text-blue-400 transition"
          >
            Discord
            <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-blue-400 to-purple-400 transition-all duration-300 group-hover:w-full"></span>
          </a>
          <a
            href="#"
            className="group relative text-gray-400 hover:text-blue-400 transition"
          >
            Support
            <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-blue-400 to-purple-400 transition-all duration-300 group-hover:w-full"></span>
          </a>
        </div>
      </div>

      {/* Bottom: Copyright */}
      <div className="border-t border-gray-800 text-center py-3 text-xs text-gray-500">
        © {new Date().getFullYear()} HDX Alliance. All rights reserved. Crafted with 💙 by the HDX Dev Team.
      </div>
    </footer>
  );
}