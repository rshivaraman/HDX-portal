// pages/_app.js
import '../styles/globals.css';
import Navbar from '../components/Navbar';

export default function App({ Component, pageProps }) {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gray-100">
        <Component {...pageProps} />
      </main>
    </>
  );
}