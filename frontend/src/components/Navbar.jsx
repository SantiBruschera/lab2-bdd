import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const [q, setQ] = useState('');
  const navigate  = useNavigate();
  const { user, logout } = useAuth();

  function handleSearch(e) {
    e.preventDefault();
    if (q.trim()) {
      navigate(`/search?q=${encodeURIComponent(q.trim())}`);
      setQ('');
    }
  }

  return (
    <nav className="navbar">
      <Link to="/" className="navbar-logo">UMDB</Link>
      <ul className="navbar-links">
        <li><NavLink to="/" end>Inicio</NavLink></li>
        <li><NavLink to="/ranking">Ranking</NavLink></li>
        <li><NavLink to="/search">Buscar</NavLink></li>
        <li><NavLink to="/favorites">Favoritos</NavLink></li>
      </ul>
      <form className="navbar-search" onSubmit={handleSearch}>
        <input
          type="text"
          placeholder="Buscar películas, actores..."
          value={q}
          onChange={e => setQ(e.target.value)}
        />
        <button type="submit" className="btn">🔍</button>
      </form>
      <div className="navbar-auth">
        {user ? (
          <>
            <span className="navbar-username">👤 {user.username}</span>
            <button className="btn" onClick={logout}>Salir</button>
          </>
        ) : (
          <>
            <Link to="/login" className="btn">Ingresar</Link>
            <Link to="/register" className="btn btn-primary">Registrarse</Link>
          </>
        )}
      </div>
    </nav>
  );
}
