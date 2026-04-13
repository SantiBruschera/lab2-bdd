/**
 * Seed script — imports movies and reviews from CSV files.
 *
 * Usage:
 *   MONGO_URI=mongodb://localhost:27017/umdb node src/seed/seed.js
 *
 * Expected CSV columns (adjust FIELD_MAP below to match your actual CSV):
 *
 * movies.csv:
 *   title, year, genres, director, actors, plot, runtime, poster_url, rating
 *   - genres: comma-separated  e.g. "Drama,Crime"
 *   - actors: pipe-separated   e.g. "Tim Robbins|Morgan Freeman"
 *
 * reviews.csv:
 *   title, author, rating, text, date
 */

const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const mongoose = require('mongoose');
const Movie = require('../models/Movie');
const Review = require('../models/Review');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/umdb';

// ── Adjust these paths to point at your CSV files ──────────────────────────
const MOVIES_CSV = path.resolve(__dirname, '../../../../movies.csv');
const REVIEWS_CSV = path.resolve(__dirname, '../../../../reviews.csv');

// ── Column name mapping (CSV header → internal field) ──────────────────────
// Change the right-hand values to match your actual CSV column names.
const MOVIE_MAP = {
  title:      'title',
  year:       'year',
  genres:     'genres',     // comma-separated list
  director:   'director',
  actors:     'actors',     // pipe-separated list  (e.g. "Actor A|Actor B")
  plot:       'plot',
  runtime:    'runtime',
  poster_url: 'poster_url',
  avg_rating: 'rating',     // initial rating from source (overwritten by reviews)
};

const REVIEW_MAP = {
  title:  'title',
  author: 'author',
  rating: 'rating',
  text:   'text',
  date:   'date',
};

// ── Helpers ────────────────────────────────────────────────────────────────
function readCSV(filePath) {
  return new Promise((resolve, reject) => {
    const rows = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', row => rows.push(row))
      .on('end', () => resolve(rows))
      .on('error', reject);
  });
}

function parseActors(str) {
  if (!str) return [];
  return str.split('|')
    .map(s => s.trim())
    .filter(Boolean)
    .slice(0, 100)
    .map(name => ({ name }));
}

function parseGenres(str) {
  if (!str) return [];
  return str.split(',').map(s => s.trim()).filter(Boolean);
}

// ── Main ───────────────────────────────────────────────────────────────────
async function seed() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');

  // Clear existing data
  await Movie.deleteMany({});
  await Review.deleteMany({});
  console.log('Cleared existing movies and reviews');

  // ── Movies ────────────────────────────────────────────────────────────
  if (!fs.existsSync(MOVIES_CSV)) {
    console.warn(`movies.csv not found at ${MOVIES_CSV} — skipping movies import`);
  } else {
    const rows = await readCSV(MOVIES_CSV);
    const docs = rows.map(row => ({
      title:      row[MOVIE_MAP.title]?.trim(),
      year:       parseInt(row[MOVIE_MAP.year]) || undefined,
      genres:     parseGenres(row[MOVIE_MAP.genres]),
      director:   row[MOVIE_MAP.director]?.trim(),
      actors:     parseActors(row[MOVIE_MAP.actors]),
      plot:       row[MOVIE_MAP.plot]?.trim(),
      runtime:    parseInt(row[MOVIE_MAP.runtime]) || undefined,
      poster_url: row[MOVIE_MAP.poster_url]?.trim(),
      avg_rating: parseFloat(row[MOVIE_MAP.avg_rating]) || 0,
    })).filter(d => d.title);

    await Movie.insertMany(docs, { ordered: false });
    console.log(`Inserted ${docs.length} movies`);
  }

  // ── Reviews ───────────────────────────────────────────────────────────
  if (!fs.existsSync(REVIEWS_CSV)) {
    console.warn(`reviews.csv not found at ${REVIEWS_CSV} — skipping reviews import`);
  } else {
    const rows = await readCSV(REVIEWS_CSV);
    let inserted = 0;
    let skipped = 0;

    // Build title → _id map
    const movies = await Movie.find({}, 'title');
    const titleMap = {};
    for (const m of movies) titleMap[m.title.toLowerCase()] = m._id;

    const reviewDocs = [];
    for (const row of rows) {
      const title = row[REVIEW_MAP.title]?.trim().toLowerCase();
      const movie_id = titleMap[title];
      if (!movie_id) { skipped++; continue; }

      reviewDocs.push({
        movie_id,
        author: row[REVIEW_MAP.author]?.trim() || 'Anonymous',
        rating: parseFloat(row[REVIEW_MAP.rating]) || 5,
        text:   row[REVIEW_MAP.text]?.slice(0, 10000),
        date:   row[REVIEW_MAP.date] ? new Date(row[REVIEW_MAP.date]) : new Date(),
      });
    }

    // Limit to 5000 reviews per movie
    const countMap = {};
    const filtered = reviewDocs.filter(r => {
      const key = r.movie_id.toString();
      countMap[key] = (countMap[key] || 0) + 1;
      return countMap[key] <= 5000;
    });

    if (filtered.length > 0) {
      await Review.insertMany(filtered, { ordered: false });
      inserted = filtered.length;
    }
    console.log(`Inserted ${inserted} reviews (skipped ${skipped} unmatched rows)`);

    // Recalculate avg_rating and review_count for each movie
    const aggs = await Review.aggregate([
      { $group: { _id: '$movie_id', avg: { $avg: '$rating' }, count: { $sum: 1 } } },
    ]);
    const bulkOps = aggs.map(a => ({
      updateOne: {
        filter: { _id: a._id },
        update: { avg_rating: Math.round(a.avg * 10) / 10, review_count: a.count },
      },
    }));
    if (bulkOps.length) await Movie.bulkWrite(bulkOps);
    console.log('Updated avg_rating for all movies');
  }

  await mongoose.disconnect();
  console.log('Done');
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
