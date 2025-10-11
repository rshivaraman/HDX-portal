import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

export default function Admin() {
  return (
    <div>
      <Navbar />
      <main className="p-6">
        <h1 className="text-3xl font-bold text-blue-700 mb-4">Admin Panel</h1>
        <p className="mb-4">
          CRUD operations for Players, Events, and Thresholds will appear here.
        </p>
        <p className="text-gray-700">Integration with Supabase tables coming next.</p>
      </main>
      <Footer />
    </div>
  );
}