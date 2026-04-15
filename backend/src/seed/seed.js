

const fs   = require('fs');
const path = require('path');
const csv  = require('csv-parser');
const mongoose = require('mongoose');
const Movie        = require('../models/Movie');
const ReviewBucket = require('../models/ReviewBucket');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/umdb';
const CSV_PATH  = process.env.CSV_PATH  || path.resolve(__dirname, '../../../../mongodb.csv');

const BUCKET_SIZE           = 1000; 
const MAX_REVIEWS_PER_MOVIE = 5000; 
const MAX_REVIEW_CHARS      = 10000;
const MAX_ACTORS            = 100;


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


function toTenScale(rating) {
  const val = Math.round(parseFloat(rating) * 2);
  return Math.min(10, Math.max(1, val));
}


async function seed() {
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`CSV no encontrado en: ${CSV_PATH}`);
    console.error('Especificá la ruta con: CSV_PATH=/ruta/al/archivo.csv node src/seed/seed.js');
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
    const reviewsRaw  = parseJSON(row.reviews,      []);


    const movie = await Movie.create({
      title,
      year:       parseInt(row.year) || undefined,
      genres:     categories,
      director:   directorArr[0] || undefined,
      actors:     actorNames.slice(0, MAX_ACTORS).map(name => ({ name })),
      imdb_id:    row.imdb_tconst?.trim() || undefined,

      avg_rating: Math.round(parseFloat(row.avg_rating) * 2 * 10) / 10,
      review_count: 0,
    });
    movieCount++;


    const toInsert = reviewsRaw.slice(0, MAX_REVIEWS_PER_MOVIE);
    if (toInsert.length > 0) {
      const reviewDocs = toInsert.map(r => ({
        author: 'Anonymous',
        rating: toTenScale(r.rating),
        text:   String(r.text || '').slice(0, MAX_REVIEW_CHARS),
        date:   r.timestamp ? new Date(r.timestamp) : new Date(),
      }));

   
      const buckets = chunk(reviewDocs, BUCKET_SIZE);
      const bucketDocs = buckets.map((reviews, i) => ({
        movie_id: movie._id,
        bucket:   i + 1,
        count:    reviews.length,
        reviews,
      }));

      await ReviewBucket.insertMany(bucketDocs, { ordered: false });
      reviewCount += toInsert.length;
    }

    if (movieCount % 50 === 0) {
      console.log(`  ${movieCount} películas procesadas...`);
    }
  }


  const aggs = await ReviewBucket.aggregate([
    { $group: { _id: '$movie_id', count: { $sum: '$count' } } },
  ]);

  if (aggs.length > 0) {
    const bulkOps = aggs.map(a => ({
      updateOne: {
        filter: { _id: a._id },
        update: { $set: { review_count: a.count } },
      },
    }));
    await Movie.bulkWrite(bulkOps);
  }

  console.log(`\nFinalizado:`);
  console.log(`  Películas insertadas : ${movieCount}`);
  console.log(`  Reviews insertadas   : ${reviewCount}`);
  if (skipped) console.log(`  Filas omitidas       : ${skipped}`);

  await mongoose.disconnect();
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
