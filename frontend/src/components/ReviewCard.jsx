export default function ReviewCard({ review }) {
  const date = new Date(review.date).toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return (
    <div className="review-card">
      <div className="review-card-header">
        <span className="review-author">{review.author || 'Anónimo'}</span>
        <span className="review-rating">★ {review.rating}/5</span>
      </div>
      <div className="review-date">{date}</div>
      {review.text && <p className="review-text">{review.text}</p>}
    </div>
  );
}
