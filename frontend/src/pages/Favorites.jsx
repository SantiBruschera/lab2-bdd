import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import MovieCard from '../components/MovieCard';

const BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

export default function Favorites() {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [movies, setMovies]   = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    fetch(`${BASE}/favorites`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(setMovies)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user, token, navigate]);

  return (
    <div className="page">
      <h1 className="page-title">Mis Favoritos</h1>
      {loading ? (
        <div className="loading">Cargando...</div>
      ) : movies.length === 0 ? (
        <div className="empty-state">
          No tenés películas favoritas todavía.<br />
          <span style={{ fontSize: '0.85rem' }}>Buscá una película y tocá el botón ♡</span>
        </div>
      ) : (
        <div className="movies-grid">
          {movies.map(m => <MovieCard key={m._id} movie={m} />)}
        </div>
      )}
    </div>
  );
}
