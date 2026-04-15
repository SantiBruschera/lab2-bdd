/**
 * Seed script para mongodb.csv
 *
 * Uso local:
 *   MONGO_URI=mongodb://localhost:27017/umdb node src/seed/seed.js
 *
 * Uso con Docker:
 *   docker exec -it umdb-template-backend \
 *     sh -c "MONGO_URI=mongodb://mongo:27017/umdb CSV_PATH=/data/mongodb.csv node src/seed/seed.js"
 *
 * Formato del CSV:
 *   - categories, actors, directors, reviews → strings con JSON embebido
 *   - avg_rating  → escala 0-5 (MovieLens) → se convierte a 0-10
 *   - reviews[].rating → escala 1-5 → se convierte a 1-10
 *   - reviews[].timestamp → Unix en milisegundos
 */

const fs   = require('fs');
const path = require('path');
const csv  = require('csv-parser');
const mongoose = require('mongoose');
const Movie  = require('../models/Movie');
const Review = require('../models/Review');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/umdb';
const CSV_PATH  = process.env.CSV_PATH  || path.resolve(__dirname, '../../../../mongodb.csv');

const MAX_REVIEWS_PER_MOVIE = 5000;
const MAX_REVIEW_CHARS      = 10000;
const MAX_ACTORS            = 100;

// ── Helpers ────────────────────────────────────────────────────
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
  // Intenta directo; si falla, reemplaza \" por " (escaping no estándar del CSV)
  return tryParse(str) ?? tryParse(str.replace(/\\"/g, '"')) ?? fallback;
}

// Convierte rating de escala 1-5 a 1-10
function toTenScale(rating) {
  const val = Math.round(parseFloat(rating) * 2);
  return Math.min(10, Math.max(1, val));
}

// ── Main ────────────────────────────────────────────────────────
async function seed() {
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`CSV no encontrado en: ${CSV_PATH}`);
    console.error('Especificá la ruta con: CSV_PATH=/ruta/al/archivo.csv node src/seed/seed.js');
    process.exit(1);
  }

  await mongoose.connect(MONGO_URI);
  console.log('Conectado a MongoDB');

  await Movie.deleteMany({});
  await Review.deleteMany({});
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

    // Crear la película
    const movie = await Movie.create({
      title,
      year:       parseInt(row.year) || undefined,
      genres:     categories,
      director:   directorArr[0] || undefined,
      actors:     actorNames.slice(0, MAX_ACTORS).map(name => ({ name })),
      imdb_id:    row.imdb_tconst?.trim() || undefined,
      // avg_rating viene del CSV (escala 0-5 → 0-10), más representativo
      // porque está calculado sobre miles de ratings de MovieLens
      avg_rating: Math.round(parseFloat(row.avg_rating) * 2 * 10) / 10,
      review_count: 0,
    });
    movieCount++;

    // Insertar reviews embebidas en el CSV (máx 5000)
    const toInsert = reviewsRaw.slice(0, MAX_REVIEWS_PER_MOVIE);
    if (toInsert.length > 0) {
      const reviewDocs = toInsert.map(r => ({
        movie_id: movie._id,
        author:   'Anonymous',
        rating:   toTenScale(r.rating),
        text:     String(r.text || '').slice(0, MAX_REVIEW_CHARS),
        date:     r.timestamp ? new Date(r.timestamp) : new Date(),
      }));

      await Review.insertMany(reviewDocs, { ordered: false });
      reviewCount += reviewDocs.length;
    }

    if (movieCount % 50 === 0) {
      console.log(`  ${movieCount} películas procesadas...`);
    }
  }

  // Actualizar review_count en cada película
  const aggs = await Review.aggregate([
    { $group: { _id: '$movie_id', count: { $sum: 1 } } },
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
