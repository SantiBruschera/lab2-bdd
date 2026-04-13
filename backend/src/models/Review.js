const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  movie_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Movie',
    required: true,
    index: true,
  },
  author: { type: String, required: true, default: 'Anonymous' },
  rating: { type: Number, required: true, min: 1, max: 10 },
  text: {
    type: String,
    maxlength: [10000, 'Review text cannot exceed 10000 characters'],
  },
  date: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('Review', reviewSchema);
