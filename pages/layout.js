import './globals.css';
import NavBar from '../components/NavBar';

export const metadata = {
  title: 'HDX Alliance Portal',
  description: 'Alliance management system for Doomsday: Last Survivors',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900">
        <NavBar />
        <main className="p-4">{children}</main>
      </body>
    </html>
  );
}