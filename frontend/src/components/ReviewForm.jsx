import { useState } from 'react';

const BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

const LABELS = {
  10: 'Obra maestra', 9: 'Excelente', 8: 'Muy buena', 7: 'Buena',
  6: 'Regular', 5: 'Mediocre', 4: 'Mala', 3: 'Muy mala', 2: 'Terrible', 1: 'Horrible',
};

export default function ReviewForm({ movieId, onSuccess }) {
  const [form, setForm] = useState({ author: '', rating: 7, text: '' });
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  const set = field => e => setForm(f => ({ ...f, [field]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch(`${BASE}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ movie_id: movieId, ...form, rating: Number(form.rating) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al enviar reseña');
      setStatus({ type: 'ok', msg: 'Reseña publicada correctamente.' });
      setForm({ author: '', rating: 7, text: '' });
      onSuccess?.();
    } catch (err) {
      setStatus({ type: 'err', msg: err.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="review-form" onSubmit={submit}>
      <h3>Escribir una reseña</h3>
      {status && (
        <div className={status.type === 'ok' ? 'success-msg' : 'error-msg'}>
          {status.msg}
        </div>
      )}
      <div className="form-group">
        <label>Nombre (opcional)</label>
        <input
          type="text"
          placeholder="Tu nombre"
          value={form.author}
          onChange={set('author')}
          maxLength={100}
        />
      </div>
      <div className="form-group">
        <label>Calificación</label>
        <select value={form.rating} onChange={set('rating')}>
          {[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map(n => (
            <option key={n} value={n}>{n} — {LABELS[n]}</option>
          ))}
        </select>
      </div>
      <div className="form-group">
        <label>Reseña</label>
        <textarea
          rows={5}
          placeholder="Escribe tu reseña aquí..."
          value={form.text}
          onChange={set('text')}
          maxLength={10000}
        />
      </div>
      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Enviando...' : 'Publicar reseña'}
        </button>
      </div>
    </form>
  );
}
