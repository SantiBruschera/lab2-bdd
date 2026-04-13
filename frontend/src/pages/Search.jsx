import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import MovieCard from '../components/MovieCard';

const BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';
const LIMIT = 12;

export default function Search() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [inputVal, setInputVal] = useState(searchParams.get('q') || '');
  const [data, setData] = useState({ movies: [], total: 0 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const q = searchParams.get('q') || '';

  useEffect(() => {
    setInputVal(q);
    setPage(1);
  }, [q]);

  useEffect(() => {
    if (!q) { setData({ movies: [], total: 0 }); return; }
    setLoading(true);
    const params = new URLSearchParams({ q, page, limit: LIMIT });
    fetch(`${BASE}/movies/search?${params}`)
      .then(r => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [q, page]);

  function handleSubmit(e) {
    e.preventDefault();
    const trimmed = inputVal.trim();
    if (trimmed) {
      setSearchParams({ q: trimmed });
      setPage(1);
    }
  }

  const totalPages = Math.ceil(data.total / LIMIT);

  return (
    <div className="page">
      <h1 className="page-title">Buscar Películas</h1>

      <form className="search-bar" onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Buscar por título, director o actor..."
          value={inputVal}
          onChange={e => setInputVal(e.target.value)}
          autoFocus
        />
        <button type="submit" className="btn btn-primary">Buscar</button>
      </form>

      {q && !loading && (
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.88rem' }}>
          {data.total} resultado{data.total !== 1 ? 's' : ''} para &ldquo;<strong style={{ color: '#e5e7eb' }}>{q}</strong>&rdquo;
        </p>
      )}

      {loading ? (
        <div className="loading">Buscando...</div>
      ) : !q ? (
        <div className="empty-state">Ingresa un término para comenzar la búsqueda.</div>
      ) : data.movies.length === 0 ? (
        <div className="empty-state">No se encontraron resultados para &ldquo;{q}&rdquo;.</div>
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
