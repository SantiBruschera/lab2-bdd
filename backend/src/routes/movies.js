const express = require('express');
const router = express.Router();
const Movie = require('../models/Movie');


router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 12, genre } = req.query;
    const filter = genre ? { genres: genre } : {};

    const [movies, total] = await Promise.all([
      Movie.find(filter)
        .sort({ avg_rating: -1 })
        .skip((page - 1) * parseInt(limit))
        .limit(parseInt(limit))
        .select('title year genres director actors poster_url avg_rating review_count'),
      Movie.countDocuments(filter),
    ]);

    res.json({ movies, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


router.get('/ranking', async (req, res) => {
  try {
    const { genre, limit = 100 } = req.query;
    const filter = genre ? { genres: genre } : {};

    // Promedio bayesiano estilo IMDB: WR = (v/(v+m))*R + (m/(v+m))*C
    // C = promedio global, m = umbral mínimo de reseñas
    const [globalStats] = await Movie.aggregate([
      { $group: { _id: null, C: { $avg: '$avg_rating' }, totalMovies: { $sum: 1 } } },
    ]);
    const C = globalStats?.C ?? 0;
    const m = 5; // mínimo de reseñas para confiar en el rating

    const movies = await Movie.aggregate([
      { $match: filter },
      { $addFields: {
        weighted_rating: {
          $add: [
            { $multiply: [{ $divide: ['$review_count', { $add: ['$review_count', m] }] }, '$avg_rating'] },
            { $multiply: [{ $divide: [m, { $add: ['$review_count', m] }] }, C] },
          ],
        },
      }},
      { $sort: { weighted_rating: -1 } },
      { $limit: parseInt(limit) },
      { $project: { title: 1, year: 1, genres: 1, director: 1, actors: 1, poster_url: 1, avg_rating: 1, review_count: 1, weighted_rating: 1 } },
    ]);

    res.json(movies);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


router.get('/genres', async (req, res) => {
  try {
    const genres = await Movie.distinct('genres');
    res.json(genres.filter(Boolean).sort());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


router.get('/search', async (req, res) => {
  try {
    const { q, page = 1, limit = 12 } = req.query;
    if (!q || !q.trim()) return res.json({ movies: [], total: 0 });

    const filter = { $text: { $search: q } };
    const projection = { score: { $meta: 'textScore' } };

    const [movies, total] = await Promise.all([
      Movie.find(filter, projection)
        .sort({ score: { $meta: 'textScore' } })
        .skip((page - 1) * parseInt(limit))
        .limit(parseInt(limit))
        .select('title year genres director actors poster_url avg_rating review_count'),
      Movie.countDocuments(filter),
    ]);

    res.json({ movies, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


router.get('/:id', async (req, res) => {
  try {
    const movie = await Movie.findById(req.params.id);
    if (!movie) return res.status(404).json({ error: 'Movie not found' });
    res.json(movie);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
