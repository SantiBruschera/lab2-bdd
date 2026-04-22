const fs   = require('fs');
const path = require('path');
const csv  = require('csv-parser');
const mongoose = require('mongoose');
const Movie        = require('../models/Movie');
const ReviewBucket = require('../models/ReviewBucket');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/umdb';
const CSV_PATH  = process.env.CSV_PATH  || path.resolve(__dirname, '../../../mongodb.csv');

const BUCKET_SIZE           = 1000; 
const MAX_REVIEWS_PER_MOVIE = 5000; 
const MAX_REVIEW_CHARS      = 10000;
const MAX_ACTORS            = 100;

const topPosters = {
  "Parasite": "https://image.tmdb.org/t/p/original/5N5v0BipcnasK9HACuoCWnFdZmh.jpg",
  "12 Angry Men": "https://image.tmdb.org/t/p/original/ppd84D2i9W8jXmsyInGyihiSyqz.jpg",
  "Schindler's List": "https://m.media-amazon.com/images/M/MV5BNjM1ZDQxYWUtMzQyZS00MTE1LWJmZGYtNGUyNTdlYjM3ZmVmXkEyXkFqcGc@._V1_.jpg",
  "Fight Club": "https://images-cdn.ubuy.co.in/634d026d7ab6c7432e039aaf-posters-usa-fight-club-movie-poster.jpg",
  "Rear Window": "https://m.media-amazon.com/images/M/MV5BODZhOWI1ODgtMzdiOS00YjNkLTgwOGUtYmIyZDg5ZmQwMzQ1XkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg",
  "Spider-Man: Across the Spider-Verse": "https://image.tmdb.org/t/p/w220_and_h330_face/zPoqAu4gxZRmcPzSLFJ9b0VciaL.jpg",
  "One Flew Over the Cuckoo's Nest": "https://image.tmdb.org/t/p/original/kjWsMh72V6d8KRLV4EOoSJLT1H7.jpg",
  "Dr. Strangelove or: How I Learned to Stop Worrying and Love the Bomb": "https://m.media-amazon.com/images/M/MV5BMjFjYzBlOTktMTI2OS00ZWVhLTgxMDUtNzAwODY2NmI3YTAzXkEyXkFqcGc@._V1_.jpg",
  "Pulp Fiction": "https://image.tmdb.org/t/p/original/gSnbhR0vftfJ2U6KpGmR7WzZlVo.jpg",
  "Casablanca": "https://http2.mlstatic.com/D_NQ_NP_722135-CBT97587995257_112025-O.webp",
};


const normalizedPosters = Object.keys(topPosters).reduce((acc, key) => {
  acc[key.toLowerCase().trim()] = topPosters[key];
  return acc;
}, {});

function chunk(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

function readCSV(filePath) {
  return new Promise((resolve, reject) => {
    const rows = [];
    fs.createReadStream(filePath)
      .pipe(csv({ escape: '\\' }))
      .on('data', row => rows.push(row))
      .on('end',  () => resolve(rows))
      .on('error', reject);
  });
}

function parseJSON(str, fallback = []) {
  if (!str || typeof str !== 'string') return fallback;
  const tryParse = (s) => {
    try {
      const v = JSON.parse(s);
      return Array.isArray(v) ? v : null;
    } catch { return null; }
  };
  return tryParse(str) ?? tryParse(str.replace(/\\"/g, '"')) ?? fallback;
}

function toFiveScale(rating) {
  const val = Math.round(parseFloat(rating) * 10) / 10;
  return Math.min(5, Math.max(0.5, val));
}

async function seed() {
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`CSV no encontrado en: ${CSV_PATH}`);
    process.exit(1);
  }

  await mongoose.connect(MONGO_URI);
  console.log('Conectado a MongoDB');

  await Movie.deleteMany({});
  await ReviewBucket.deleteMany({});
  console.log('Colecciones limpiadas\n');

  const rows = await readCSV(CSV_PATH);
  console.log(`${rows.length} filas leídas del CSV`);

  let movieCount  = 0;
  let reviewCount = 0;
  let skipped     = 0;

  for (const row of rows) {
    const title = row.imdb_primary_title?.trim() || row.title?.trim();
    if (!title) { skipped++; continue; }

    const categories  = parseJSON(row.categories,  []);
    const actorNames  = parseJSON(row.actors,       []);
    const directorArr = parseJSON(row.directors,    []);
    const reviewsRaw  = parseJSON(row.reviews,       []);

    const posterUrl = normalizedPosters[title.toLowerCase()] || "";

    const movie = await Movie.create({
      title,
      year: parseInt(row.year) || undefined,
      genres: categories,
      director: directorArr[0] || undefined,
      actors: actorNames.slice(0, MAX_ACTORS).map(name => ({ name })),
      imdb_id: row.imdb_tconst?.trim() || undefined,
      avg_rating: 0,
      review_count: 0,
      poster_url: posterUrl
    });
    movieCount++;

    const toInsert = reviewsRaw.slice(0, MAX_REVIEWS_PER_MOVIE);
    if (toInsert.length > 0) {
      let runningAvg = 0;
      let count = 0;

      const reviewDocs = toInsert.map(r => {
        const rating = toFiveScale(r.rating);
        count++;
        runningAvg += (rating - runningAvg) / count;
        return {
          author: 'Anonymous',
          rating,
          text:   String(r.text || '').slice(0, MAX_REVIEW_CHARS),
          date:   r.timestamp ? new Date(r.timestamp) : new Date(),
        };
      });

      const buckets = chunk(reviewDocs, BUCKET_SIZE);
      const bucketDocs = buckets.map((reviews, i) => ({
        movie_id: movie._id,
        bucket:   i + 1,
        count:    reviews.length,
        reviews,
      }));

      await ReviewBucket.insertMany(bucketDocs, { ordered: false });

      await Movie.findByIdAndUpdate(movie._id, {
        avg_rating:   Math.round(runningAvg * 10) / 10,
        review_count: count,
      });

      reviewCount += count;
    }

    if (movieCount % 50 === 0) {
      console.log(`  ${movieCount} películas procesadas...`);
    }
  }

  console.log(`\nFinalizado:`);
  console.log(`  Películas insertadas : ${movieCount}`);
  console.log(`  Reviews insertadas   : ${reviewCount}`);

  await mongoose.disconnect();
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});