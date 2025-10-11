// components/Footer.js
export default function Footer(){
  return (
    <footer style={{ textAlign:"center", padding:"16px", color:"#666", marginTop:24 }}>
      HDX Alliance Portal — &copy; {new Date().getFullYear()}
    </footer>
  );
}