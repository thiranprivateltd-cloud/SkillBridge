require('dotenv').config();
const { Pool } = require('pg');
const { rankStudentsForListing } = require('../src/matchingEngine');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

(async () => {
  const listingId = 1;

  const lRes  = await pool.query('SELECT * FROM listings WHERE id=$1', [listingId]);
  const listing = lRes.rows[0];
  console.log('Listing:', listing.title, '| Programme:', listing.eligibility_programme);

  const sRes  = await pool.query(
    'SELECT id AS student_id, name AS student_name FROM students WHERE institution_id=$1 AND LOWER(programme)=LOWER($2)',
    [listing.institution_id, listing.eligibility_programme]
  );
  console.log('Eligible students:', sRes.rows.length);

  const rRes  = await pool.query(
    'SELECT lr.skill_id, s.name AS skill_name, lr.required_level, lr.weight FROM listing_requirements lr JOIN skills s ON s.id=lr.skill_id WHERE lr.listing_id=$1',
    [listingId]
  );
  const requirements = rRes.rows.map(r => ({ skill_id: +r.skill_id, skill_name: r.skill_name, required_level: +r.required_level, weight: +r.weight }));

  const ssRes = await pool.query(
    'SELECT student_id, skill_id, proficiency_level FROM student_skills WHERE student_id=ANY($1::int[])',
    [sRes.rows.map(s => s.student_id)]
  );
  const maps = new Map();
  for (const row of ssRes.rows) {
    const sid = +row.student_id;
    if (!maps.has(sid)) maps.set(sid, new Map());
    maps.get(sid).set(+row.skill_id, +row.proficiency_level);
  }

  const result = rankStudentsForListing(sRes.rows, requirements, maps);
  console.log('\n=== GET /api/listings/1/matches ===\n');
  console.log(JSON.stringify(result, null, 2));

  await pool.end();
})().catch(e => { console.error(e.message); pool.end(); });
