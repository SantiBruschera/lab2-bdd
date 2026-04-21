const express = require('express');
const router = express.Router();
const ReviewBucket = require('../models/ReviewBucket');
const Movie = require('../models/Movie');
const { optionalAuth } = require('../middleware/auth');

const BUCKET_SIZE = 1000; 
const MAX_REVIEWS = 5000; 


router.get('/:movieId', async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const pageNum  = parseInt(page);
    const limitNum = parseInt(limit);

  
    const buckets = await ReviewBucket.find({ movie_id: req.params.movieId })
      .sort({ bucket: 1 });

   
    const all = buckets.flatMap(b => b.reviews);


    all.sort((a, b) => new Date(b.date) - new Date(a.date));

    const total    = all.length;
    const reviews  = all.slice((pageNum - 1) * limitNum, pageNum * limitNum);

    res.json({ reviews, total, page: pageNum, limit: limitNum });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


router.post('/', optionalAuth, async (req, res) => {
  try {
    const { movie_id, author, rating, text } = req.body;

    if (!movie_id || !rating) {
      return res.status(400).json({ error: 'movie_id y rating son requeridos' });
    }

  
    const buckets = await ReviewBucket.find({ movie_id }, 'bucket count')
      .sort({ bucket: -1 }); 

    const totalReviews = buckets.reduce((sum, b) => sum + b.count, 0);

    if (totalReviews >= MAX_REVIEWS) {
      return res.status(400).json({ error: `Límite de ${MAX_REVIEWS} reseñas por película alcanzado` });
    }

    const parsedRating = Math.round(Math.min(5, Math.max(0.5, Number(rating))) * 10) / 10;
    const newReview = {
      author: req.user?.username || author?.trim() || 'Anonymous',
      rating: parsedRating,
      text:   text?.slice(0, 10000),
      date:   new Date(),
    };

    const lastBucket = buckets[0]; 

    if (!lastBucket || lastBucket.count >= BUCKET_SIZE) {
      
      const nextBucketNum = lastBucket ? lastBucket.bucket + 1 : 1;
      await ReviewBucket.create({
        movie_id,
        bucket:  nextBucketNum,
        count:   1,
        reviews: [newReview],
      });
    } else {
      
      await ReviewBucket.findByIdAndUpdate(lastBucket._id, {
        $push: { reviews: newReview },
        $inc:  { count: 1 },
      });
    }

    
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
