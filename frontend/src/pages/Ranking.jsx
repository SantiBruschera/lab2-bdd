import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

export default function Ranking() {
  const [movies, setMovies] = useState([]);
  const [genres, setGenres] = useState([]);
  const [selectedGenre, setSelectedGenre] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetch(`${BASE}/movies/genres`)
      .then(r => r.json())
      .then(setGenres)
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ limit: 100 });
    if (selectedGenre) params.set('genre', selectedGenre);
    fetch(`${BASE}/movies/ranking?${params}`)
      .then(r => r.json())
      .then(setMovies)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedGenre]);

  return (
    <div className="page">
      <h1 className="page-title">Ranking de Películas</h1>

      <div className="genre-filter">
        <label>Filtrar por categoría:</label>
        <select value={selectedGenre} onChange={e => setSelectedGenre(e.target.value)}>
          <option value="">Todas</option>
          {genres.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="loading">Cargando ranking...</div>
      ) : movies.length === 0 ? (
        <div className="empty-state">No hay películas para esta categoría.</div>
      ) : (
        <div className="ranking-list">
          {movies.map((movie, idx) => {
            const pos = idx + 1;
            const hasValidPoster = movie.poster_url && movie.poster_url.startsWith('http') && !movie.poster_url.includes('placeholder');
            return (
              <div
                key={movie._id}
                className="ranking-item"
                onClick={() => navigate(`/movie/${movie._id}`)}
              >
                <span className={`ranking-pos${pos <= 3 ? ' top3' : ''}`}>
                  #{pos}
                </span>

                {hasValidPoster ? (
                  <img className="ranking-poster" src={movie.poster_url} alt={movie.title} loading="lazy" />
                ) : (
                  <div className="ranking-poster-placeholder">🎬</div>
                )}

                <div className="ranking-info">
                  <div className="ranking-title">{movie.title}</div>
                  <div className="ranking-meta">
                    {[movie.year, movie.genres?.slice(0, 2).join(', ')].filter(Boolean).join(' · ')}
                    {movie.review_count > 0 && ` · ${movie.review_count} reseñas`}
                  </div>
                </div>

                <div className="ranking-rating">
                  <span style={{ color: '#f5c518' }}>★</span>
                  {movie.avg_rating?.toFixed(1) ?? '—'}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
