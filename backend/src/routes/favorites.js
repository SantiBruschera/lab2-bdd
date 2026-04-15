const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Movie = require('../models/Movie');
const { requireAuth } = require('../middleware/auth');

// GET /api/favorites — películas favoritas del usuario
router.get('/', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id, 'favorites');
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    const movies = await Movie.find({ _id: { $in: user.favorites } })
      .select('title year genres director actors poster_url avg_rating review_count');

    res.json(movies);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/favorites/check/:movieId — verificar si una película es favorita
router.get('/check/:movieId', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id, 'favorites');
    const isFavorite = user?.favorites.some(id => id.toString() === req.params.movieId) ?? false;
    res.json({ isFavorite });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/favorites/:movieId — agregar a favoritos
router.post('/:movieId', requireAuth, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user.id, {
      $addToSet: { favorites: req.params.movieId },
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/favorites/:movieId — quitar de favoritos
router.delete('/:movieId', requireAuth, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user.id, {
      $pull: { favorites: req.params.movieId },
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
