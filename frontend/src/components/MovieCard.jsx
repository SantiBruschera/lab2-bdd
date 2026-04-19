import { useNavigate } from 'react-router-dom';

export default function MovieCard({ movie }) {
  const navigate = useNavigate();
  const topActors = (movie.actors || []).slice(0, 3).map(a => a.name).join(', ');

  // Validación ultra estricta del póster
  const hasValidPoster = 
    movie.poster_url && 
    movie.poster_url.startsWith('http') && 
    !movie.poster_url.includes('placeholder');

  return (
    <div className="movie-card" onClick={() => navigate(`/movie/${movie._id}`)}>
      <div className="movie-card-poster-container">
        {hasValidPoster ? (
          <img 
            className="movie-card-poster-img" 
            src={movie.poster_url} 
            alt={movie.title} 
            loading="lazy"
            // Si por alguna razón la URL falla al cargar, mostramos el emoji
            onError={(e) => {
              e.target.style.display = 'none';
              e.target.parentElement.innerHTML = '<div class="movie-card-no-poster">🎬</div>';
            }}
          />
        ) : (
          <div className="movie-card-no-poster">🎬</div>
        )}
      </div>

      <div className="movie-card-body">
        <p className="movie-card-title">{movie.title}</p>
        <p className="movie-card-year">{movie.year || '—'}</p>
        <div className="movie-card-genres">
          {(movie.genres || []).slice(0, 2).map(g => (
            <span key={g} className="genre-badge">{g}</span>
          ))}
        </div>
        <div className="movie-card-rating">
          <span className="rating-star">★</span>
          <span className="rating-value">{movie.avg_rating?.toFixed(1) ?? '—'}</span>
          <span className="rating-count">({movie.review_count ?? 0})</span>
        </div>
        {topActors && <p className="movie-card-actors">{topActors}</p>}
      </div>
    </div>
  );
}