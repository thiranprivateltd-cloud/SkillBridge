// src/db.js
// Singleton pg Pool – reads DATABASE_URL from .env
const { Pool } = require('pg');
require('dotenv').config();

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set. Add it to .env');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  ssl: { rejectUnauthorized: false },  // required by Supabase
});

module.exports = pool;
