// pages/_app.js
import '../styles/globals.css';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer'; // ✅ Import your Footer

export default function App({ Component, pageProps }) {
  return (
    <>
      <Navbar />

      {/* Main content area */}
      <main className="min-h-screen bg-gray-100">
        <Component {...pageProps} />
      </main>

      {/* Global Footer */}
      <Footer />  {/* ✅ Add footer here */}
    </>
  );
}