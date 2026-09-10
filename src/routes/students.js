// src/routes/students.js
const express  = require('express');
const router   = express.Router();
const pool     = require('../db');
const { rankListingsForStudent } = require('../matchingEngine');

/**
 * GET /api/students/:studentId/matches
 *
 * Returns listings the student is eligible for (programme-matched),
 * ranked by alignment%.
 */
router.get('/:studentId/matches', async (req, res) => {
  const studentId = Number(req.params.studentId);
  if (!Number.isInteger(studentId) || studentId <= 0) {
    return res.status(400).json({ error: 'Invalid studentId' });
  }

  try {
    // 1. Fetch the student
    const studentRes = await pool.query(
      `SELECT id, name, programme, institution_id
         FROM students
        WHERE id = $1`,
      [studentId]
    );
    if (studentRes.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }
    const student = studentRes.rows[0];

    // 2. Find all active listings that match the student's programme
    //    (case-insensitive).  A listing is linked to an institution; we
    //    don't restrict by institution here so students can see listings
    //    across the platform (adjust WHERE clause if needed).
    const listingsRes = await pool.query(
      `SELECT id AS listing_id, title AS listing_title, industry_partner_id
         FROM listings
        WHERE LOWER(eligibility_programme) = LOWER($1)
          AND status != 'closed'`,
      [student.programme]
    );
    const eligibleListings = listingsRes.rows; // [{listing_id, listing_title}]

    if (eligibleListings.length === 0) {
      return res.json([]);
    }

    // 3. Fetch requirements for all eligible listings in one query
    const listingIds = eligibleListings.map((l) => l.listing_id);
    const reqRes     = await pool.query(
      `SELECT lr.listing_id, lr.skill_id, s.name AS skill_name,
              lr.required_level, lr.weight
         FROM listing_requirements lr
         JOIN skills s ON s.id = lr.skill_id
        WHERE lr.listing_id = ANY($1::int[])`,
      [listingIds]
    );

    // Build Map<listingId -> requirements[]>
    const requirementsByListing = new Map();
    for (const row of reqRes.rows) {
      const lid = Number(row.listing_id);
      if (!requirementsByListing.has(lid)) requirementsByListing.set(lid, []);
      requirementsByListing.get(lid).push({
        skill_id:       Number(row.skill_id),
        skill_name:     row.skill_name,
        required_level: Number(row.required_level),
        weight:         Number(row.weight),
      });
    }

    // 4. Fetch the student's own skill levels
    const skillsRes = await pool.query(
      `SELECT skill_id, proficiency_level
         FROM student_skills
        WHERE student_id = $1`,
      [studentId]
    );
    const studentSkillMap = new Map(
      skillsRes.rows.map((r) => [Number(r.skill_id), Number(r.proficiency_level)])
    );

    // 5. Score & rank (pure engine)
    const ranked = rankListingsForStudent(eligibleListings, requirementsByListing, studentSkillMap);
    return res.json(ranked);
  } catch (err) {
    console.error('GET /students/:studentId/matches error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/students/:id/skills
 * Returns all skills for an institution joined with the student's
 * proficiency_level (0 if the student has not assessed that skill yet).
 */
router.get('/:id/skills', async (req, res) => {
  const studentId = Number(req.params.id);
  if (!Number.isInteger(studentId) || studentId <= 0) {
    return res.status(400).json({ error: 'Invalid studentId' });
  }
  try {
    const studentRes = await pool.query(
      `SELECT id, name, institution_id FROM students WHERE id = $1`,
      [studentId]
    );
    if (studentRes.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }
    const { institution_id } = studentRes.rows[0];

    // All skills for this institution, left-joined with the student's levels
    const result = await pool.query(
      `SELECT s.id AS skill_id,
              s.name AS skill_name,
              s.category,
              COALESCE(ss.proficiency_level, 0) AS proficiency_level
         FROM skills s
         LEFT JOIN student_skills ss
                ON ss.skill_id = s.id AND ss.student_id = $1
        WHERE s.institution_id = $2
        ORDER BY s.id`,
      [studentId, institution_id]
    );
    return res.json(result.rows.map(r => ({
      skill_id:          Number(r.skill_id),
      skill_name:        r.skill_name,
      category:          r.category,
      proficiency_level: Number(r.proficiency_level),
    })));
  } catch (err) {
    console.error('GET /students/:id/skills error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PATCH /api/students/:id/skills
 * body: [{ skill_id, proficiency_level }, ...]
 * Upserts each skill level for the student.
 */
router.patch('/:id/skills', async (req, res) => {
  const studentId = Number(req.params.id);
  if (!Number.isInteger(studentId) || studentId <= 0) {
    return res.status(400).json({ error: 'Invalid studentId' });
  }
  const updates = req.body;
  if (!Array.isArray(updates) || updates.length === 0) {
    return res.status(400).json({ error: 'Body must be a non-empty array of { skill_id, proficiency_level }' });
  }
  for (const u of updates) {
    const lvl = Number(u.proficiency_level);
    if (!Number.isInteger(Number(u.skill_id)) || isNaN(lvl) || lvl < 0 || lvl > 100) {
      return res.status(400).json({ error: 'Each item needs skill_id (int) and proficiency_level (0-100)' });
    }
  }
  try {
    // Verify student exists
    const studentRes = await pool.query(`SELECT id FROM students WHERE id = $1`, [studentId]);
    if (studentRes.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }
    // Upsert each skill level individually (simple, avoids multi-row unnest complexity)
    for (const u of updates) {
      await pool.query(
        `INSERT INTO student_skills (student_id, skill_id, proficiency_level, updated_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (student_id, skill_id)
         DO UPDATE SET proficiency_level = EXCLUDED.proficiency_level,
                       updated_at        = NOW()`,
        [studentId, Number(u.skill_id), Number(u.proficiency_level)]
      );
    }
    return res.json({ updated: updates.length });
  } catch (err) {
    console.error('PATCH /students/:id/skills error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

