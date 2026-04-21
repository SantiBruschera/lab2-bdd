const mongoose = require('mongoose');

const actorSchema = new mongoose.Schema({
  name: { type: String, required: true },
  character: String,
}, { _id: false });

const movieSchema = new mongoose.Schema({
  title: { type: String, required: true },
  year: Number,
  genres: [String],
  director: String,
  actors: {
    type: [actorSchema],
    validate: {
      validator: arr => arr.length <= 100,
      message: 'A movie can have at most 100 actors',
    },
  },
  imdb_id: String,
  poster_url: String,
  plot: String,
  runtime: Number,
  avg_rating: { type: Number, default: 0, min: 0, max: 5 },
  review_count: { type: Number, default: 0 },
}, { timestamps: true });

movieSchema.index({ avg_rating: -1 });
movieSchema.index({ genres: 1 });
movieSchema.index({ title: 'text', director: 'text', 'actors.name': 'text' });

module.exports = mongoose.model('Movie', movieSchema);
