const express = require('express');
const router = express.Router();
const Review = require('../models/Review');
const Movie = require('../models/Movie');

const MAX_REVIEWS = 5000;

// GET /api/reviews/:movieId — paginated reviews for a movie
router.get('/:movieId', async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const [reviews, total] = await Promise.all([
      Review.find({ movie_id: req.params.movieId })
        .sort({ date: -1 })
        .skip((page - 1) * parseInt(limit))
        .limit(parseInt(limit)),
      Review.countDocuments({ movie_id: req.params.movieId }),
    ]);

    res.json({ reviews, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/reviews — submit a new review
router.post('/', async (req, res) => {
  try {
    const { movie_id, author, rating, text } = req.body;

    if (!movie_id || !rating) {
      return res.status(400).json({ error: 'movie_id and rating are required' });
    }

    const count = await Review.countDocuments({ movie_id });
    if (count >= MAX_REVIEWS) {
      return res.status(400).json({ error: `Maximum ${MAX_REVIEWS} reviews per movie reached` });
    }

    const review = await Review.create({ movie_id, author: author || 'Anonymous', rating, text });

    // Recalculate avg_rating and review_count on the movie
    const [agg] = await Review.aggregate([
      { $match: { movie_id: review.movie_id } },
      { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
    ]);

    if (agg) {
      await Movie.findByIdAndUpdate(movie_id, {
        avg_rating: Math.round(agg.avg * 10) / 10,
        review_count: agg.count,
      });
    }

    res.status(201).json(review);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
