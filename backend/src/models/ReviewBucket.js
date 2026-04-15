const mongoose = require('mongoose');

// Subdocumento: una review individual embebida dentro del bucket
const reviewSchema = new mongoose.Schema({
  author: { type: String, default: 'Anonymous' },
  rating: { type: Number, required: true, min: 1, max: 10 },
  text: {
    type: String,
    maxlength: [10000, 'Review text cannot exceed 10000 characters'],
  },
  date: { type: Date, default: Date.now },
}, { _id: false });

// Bucket: agrupa hasta 1000 reviews de una misma película
const reviewBucketSchema = new mongoose.Schema({
  movie_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Movie',
    required: true,
  },
  bucket: { type: Number, required: true }, // número de bucket: 1, 2, 3...
  count:  { type: Number, default: 0 },     // cuántas reviews tiene este bucket
  reviews: [reviewSchema],                  // array embebido (máx 1000)
}, { timestamps: true });

// Índice compuesto: buscar los buckets de una película en orden
reviewBucketSchema.index({ movie_id: 1, bucket: 1 }, { unique: true });

module.exports = mongoose.model('ReviewBucket', reviewBucketSchema);
