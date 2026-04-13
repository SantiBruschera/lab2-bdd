import { useState, useEffect } from 'react';
import MovieCard from '../components/MovieCard';

const BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';
const LIMIT = 12;

export default function Home() {
  const [data, setData] = useState({ movies: [], total: 0 });
  const [genres, setGenres] = useState([]);
  const [selectedGenre, setSelectedGenre] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${BASE}/movies/genres`)
      .then(r => r.json())
      .then(setGenres)
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ page, limit: LIMIT });
    if (selectedGenre) params.set('genre', selectedGenre);
    fetch(`${BASE}/movies?${params}`)
      .then(r => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, selectedGenre]);

  function handleGenreChange(e) {
    setSelectedGenre(e.target.value);
    setPage(1);
  }

  const totalPages = Math.ceil(data.total / LIMIT);

  return (
    <div className="page">
      <h1 className="page-title">Películas Recomendadas</h1>

      <div className="genre-filter">
        <label>Categoría:</label>
        <select value={selectedGenre} onChange={handleGenreChange}>
          <option value="">Todas</option>
          {genres.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
        {data.total > 0 && (
          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            {data.total} película{data.total !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {loading ? (
        <div className="loading">Cargando películas...</div>
      ) : data.movies.length === 0 ? (
        <div className="empty-state">No se encontraron películas.</div>
      ) : (
        <>
          <div className="movies-grid">
            {data.movies.map(m => <MovieCard key={m._id} movie={m} />)}
          </div>
          {totalPages > 1 && (
            <div className="pagination">
              <button className="btn" onClick={() => setPage(p => p - 1)} disabled={page === 1}>
                ← Anterior
              </button>
              <span>Página {page} de {totalPages}</span>
              <button className="btn" onClick={() => setPage(p => p + 1)} disabled={page >= totalPages}>
                Siguiente →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
