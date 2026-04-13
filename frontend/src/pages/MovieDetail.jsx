import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReviewCard from '../components/ReviewCard';
import ReviewForm from '../components/ReviewForm';

const BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';
const REVIEW_LIMIT = 10;

export default function MovieDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [movie, setMovie] = useState(null);
  const [reviews, setReviews] = useState({ reviews: [], total: 0 });
  const [reviewPage, setReviewPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`${BASE}/movies/${id}`)
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(setMovie)
      .catch(() => navigate('/'))
      .finally(() => setLoading(false));
  }, [id, navigate]);

  const loadReviews = useCallback(() => {
    const params = new URLSearchParams({ page: reviewPage, limit: REVIEW_LIMIT });
    fetch(`${BASE}/reviews/${id}?${params}`)
      .then(r => r.json())
      .then(setReviews)
      .catch(() => {});
  }, [id, reviewPage]);

  useEffect(() => { loadReviews(); }, [loadReviews]);

  function handleReviewSuccess() {
    setReviewPage(1);
    loadReviews();
    // refresh avg_rating on movie
    fetch(`${BASE}/movies/${id}`)
      .then(r => r.json())
      .then(setMovie)
      .catch(() => {});
  }

  if (loading) return <div className="page"><div className="loading">Cargando...</div></div>;
  if (!movie) return null;

  const totalReviewPages = Math.ceil(reviews.total / REVIEW_LIMIT);
  const metaParts = [
    movie.year,
    movie.runtime && `${movie.runtime} min`,
  ].filter(Boolean);

  return (
    <div className="page">
      <button className="btn back-link" onClick={() => navigate(-1)}>← Volver</button>

      <div className="detail-hero">
        {movie.poster_url
          ? <img className="detail-poster" src={movie.poster_url} alt={movie.title} />
          : <div className="detail-poster-placeholder">🎬</div>
        }

        <div className="detail-info">
          <h1 className="detail-title">{movie.title}</h1>

          {metaParts.length > 0 && (
            <p className="detail-meta">{metaParts.join(' · ')}</p>
          )}

          <div className="detail-rating">
            <span className="detail-rating-value">{movie.avg_rating?.toFixed(1) ?? '—'}</span>
            <span className="detail-rating-max">/10</span>
            <span className="detail-rating-count">({movie.review_count ?? 0} reseñas)</span>
          </div>

          {movie.genres?.length > 0 && (
            <div className="movie-card-genres" style={{ marginBottom: '0.9rem' }}>
              {movie.genres.map(g => <span key={g} className="genre-badge">{g}</span>)}
            </div>
          )}

          {movie.plot && <p className="detail-plot">{movie.plot}</p>}

          {movie.director && (
            <div className="detail-section">
              <div className="detail-section-label">Director</div>
              <div className="detail-section-value">{movie.director}</div>
            </div>
          )}

          {movie.actors?.length > 0 && (
            <div className="detail-section" style={{ marginTop: '0.75rem' }}>
              <div className="detail-section-label">Reparto</div>
              <div className="actors-list">
                {movie.actors.map((a, i) => (
                  <span key={i} className="actor-chip">
                    {a.name}{a.character ? ` · ${a.character}` : ''}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="reviews-section">
        <h2 className="reviews-header">Reseñas ({reviews.total})</h2>

        <ReviewForm movieId={id} onSuccess={handleReviewSuccess} />

        {reviews.reviews.length === 0 ? (
          <div className="empty-state">Sin reseñas todavía. ¡Sé el primero en escribir una!</div>
        ) : (
          <>
            {reviews.reviews.map(r => <ReviewCard key={r._id} review={r} />)}
            {totalReviewPages > 1 && (
              <div className="pagination">
                <button className="btn" onClick={() => setReviewPage(p => p - 1)} disabled={reviewPage === 1}>
                  ← Anterior
                </button>
                <span>Página {reviewPage} de {totalReviewPages}</span>
                <button className="btn" onClick={() => setReviewPage(p => p + 1)} disabled={reviewPage >= totalReviewPages}>
                  Siguiente →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
