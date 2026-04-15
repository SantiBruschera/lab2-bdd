const mongoose = require('mongoose');


const reviewSchema = new mongoose.Schema({
  author: { type: String, default: 'Anonymous' },
  rating: { type: Number, required: true, min: 1, max: 10 },
  text: {
    type: String,
    maxlength: [10000, 'Review text cannot exceed 10000 characters'],
  },
  date: { type: Date, default: Date.now },
}, { _id: false });


const reviewBucketSchema = new mongoose.Schema({
  movie_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Movie',
    required: true,
  },
  bucket: { type: Number, required: true }, 
  count:  { type: Number, default: 0 },     
  reviews: [reviewSchema],                  
}, { timestamps: true });


reviewBucketSchema.index({ movie_id: 1, bucket: 1 }, { unique: true });

module.exports = mongoose.model('ReviewBucket', reviewBucketSchema);
