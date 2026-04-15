const express = require('express');
const router = express.Router();
const ReviewBucket = require('../models/ReviewBucket');
const Movie = require('../models/Movie');

const BUCKET_SIZE = 1000; // reviews por bucket
const MAX_REVIEWS = 5000; // máximo total por película (5 buckets)

// GET /api/reviews/:movieId — reviews paginadas de una película
router.get('/:movieId', async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const pageNum  = parseInt(page);
    const limitNum = parseInt(limit);

    // Traer todos los buckets de la película ordenados
    const buckets = await ReviewBucket.find({ movie_id: req.params.movieId })
      .sort({ bucket: 1 });

    // Aplanar todas las reviews de todos los buckets en un solo array
    const all = buckets.flatMap(b => b.reviews);

    // Ordenar por fecha descendente y paginar en memoria
    all.sort((a, b) => new Date(b.date) - new Date(a.date));

    const total    = all.length;
    const reviews  = all.slice((pageNum - 1) * limitNum, pageNum * limitNum);

    res.json({ reviews, total, page: pageNum, limit: limitNum });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/reviews — agregar una nueva review
router.post('/', async (req, res) => {
  try {
    const { movie_id, author, rating, text } = req.body;

    if (!movie_id || !rating) {
      return res.status(400).json({ error: 'movie_id y rating son requeridos' });
    }

    // Traer los buckets existentes (solo count y bucket, no las reviews completas)
    const buckets = await ReviewBucket.find({ movie_id }, 'bucket count')
      .sort({ bucket: -1 }); // descendente para tener el último primero

    const totalReviews = buckets.reduce((sum, b) => sum + b.count, 0);

    if (totalReviews >= MAX_REVIEWS) {
      return res.status(400).json({ error: `Límite de ${MAX_REVIEWS} reseñas por película alcanzado` });
    }

    const newReview = {
      author: author?.trim() || 'Anonymous',
      rating: Number(rating),
      text:   text?.slice(0, 10000),
      date:   new Date(),
    };

    const lastBucket = buckets[0]; // el de mayor número de bucket

    if (!lastBucket || lastBucket.count >= BUCKET_SIZE) {
      // El último bucket está lleno o no existe → crear uno nuevo
      const nextBucketNum = lastBucket ? lastBucket.bucket + 1 : 1;
      await ReviewBucket.create({
        movie_id,
        bucket:  nextBucketNum,
        count:   1,
        reviews: [newReview],
      });
    } else {
      // Hay espacio en el último bucket → agregar ahí
      await ReviewBucket.findByIdAndUpdate(lastBucket._id, {
        $push: { reviews: newReview },
        $inc:  { count: 1 },
      });
    }

    // Recalcular avg_rating y review_count en la película
    const allBuckets = await ReviewBucket.find({ movie_id }, 'reviews.rating count');
    const allRatings = allBuckets.flatMap(b => b.reviews.map(r => r.rating));
    const avg = allRatings.reduce((sum, r) => sum + r, 0) / allRatings.length;

    await Movie.findByIdAndUpdate(movie_id, {
      avg_rating:   Math.round(avg * 10) / 10,
      review_count: allRatings.length,
    });

    res.status(201).json(newReview);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
