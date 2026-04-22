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

    const movies = await Movie.find(filter)
      .sort({ avg_rating: -1 })
      .limit(parseInt(limit))
      .select('title year genres director actors poster_url avg_rating review_count');

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
