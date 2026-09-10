// src/routes/listings.js
const express  = require('express');
const router   = express.Router();
const pool     = require('../db');
const { rankStudentsForListing } = require('../matchingEngine');

/**
 * GET /api/listings/:listingId
 * Returns the listing detail + its requirements (with skill names).
 */
router.get('/:listingId', async (req, res) => {
  const listingId = Number(req.params.listingId);
  if (!Number.isInteger(listingId) || listingId <= 0) {
    return res.status(400).json({ error: 'Invalid listingId' });
  }
  try {
    const listingRes = await pool.query(
      `SELECT l.id, l.title, l.eligibility_programme, l.status,
              ip.name AS partner_name
         FROM listings l
         JOIN industry_partners ip ON ip.id = l.industry_partner_id
        WHERE l.id = $1`,
      [listingId]
    );
    if (listingRes.rows.length === 0) {
      return res.status(404).json({ error: 'Listing not found' });
    }
    const listing = listingRes.rows[0];

    const reqRes = await pool.query(
      `SELECT lr.id, lr.skill_id, s.name AS skill_name, s.category,
              lr.required_level, lr.weight
         FROM listing_requirements lr
         JOIN skills s ON s.id = lr.skill_id
        WHERE lr.listing_id = $1
        ORDER BY lr.weight DESC`,
      [listingId]
    );

    return res.json({
      id:                    Number(listing.id),
      title:                 listing.title,
      eligibility_programme: listing.eligibility_programme,
      status:                listing.status,
      partner_name:          listing.partner_name,
      requirements:          reqRes.rows.map(r => ({
        skill_id:       Number(r.skill_id),
        skill_name:     r.skill_name,
        category:       r.category,
        required_level: Number(r.required_level),
        weight:         Number(r.weight),
      })),
    });
  } catch (err) {
    console.error('GET /listings/:listingId error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/listings/:listingId/matches
 *
 * Returns eligible students (programme-filtered) ranked by alignment%.
 */
router.get('/:listingId/matches', async (req, res) => {
  const listingId = Number(req.params.listingId);
  if (!Number.isInteger(listingId) || listingId <= 0) {
    return res.status(400).json({ error: 'Invalid listingId' });
  }

  try {
    // 1. Fetch the listing (need eligibility_programme + institution_id)
    const listingRes = await pool.query(
      `SELECT id, title, eligibility_programme, institution_id, status
         FROM listings
        WHERE id = $1`,
      [listingId]
    );
    if (listingRes.rows.length === 0) {
      return res.status(404).json({ error: 'Listing not found' });
    }
    const listing = listingRes.rows[0];

    // 2. Eligibility filter: students whose programme matches (case-insensitive)
    const studentsRes = await pool.query(
      `SELECT id AS student_id, name AS student_name
         FROM students
        WHERE institution_id = $1
          AND LOWER(programme) = LOWER($2)`,
      [listing.institution_id, listing.eligibility_programme]
    );
    const eligibleStudents = studentsRes.rows; // [{student_id, student_name}]

    if (eligibleStudents.length === 0) {
      return res.json([]);
    }

    // 3. Fetch listing requirements (joined with skill name)
    const reqRes = await pool.query(
      `SELECT lr.skill_id, s.name AS skill_name,
              lr.required_level, lr.weight
         FROM listing_requirements lr
         JOIN skills s ON s.id = lr.skill_id
        WHERE lr.listing_id = $1`,
      [listingId]
    );
    const requirements = reqRes.rows.map((r) => ({
      skill_id:       Number(r.skill_id),
      skill_name:     r.skill_name,
      required_level: Number(r.required_level),
      weight:         Number(r.weight),
    }));

    // 4. Fetch student skills for all eligible students in one query
    const studentIds = eligibleStudents.map((s) => s.student_id);
    const skillsRes  = await pool.query(
      `SELECT student_id, skill_id, proficiency_level
         FROM student_skills
        WHERE student_id = ANY($1::int[])`,
      [studentIds]
    );

    // Build Map<studentId -> Map<skillId -> level>>
    const studentSkillMaps = new Map();
    for (const row of skillsRes.rows) {
      const sid = Number(row.student_id);
      if (!studentSkillMaps.has(sid)) studentSkillMaps.set(sid, new Map());
      studentSkillMaps.get(sid).set(Number(row.skill_id), Number(row.proficiency_level));
    }

    // 5. Score & rank (pure engine, no DB inside)
    const ranked = rankStudentsForListing(eligibleStudents, requirements, studentSkillMaps);
    return res.json(ranked);
  } catch (err) {
    console.error('GET /listings/:listingId/matches error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
