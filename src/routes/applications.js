// src/routes/applications.js
const express  = require('express');
const router   = express.Router();
const pool     = require('../db');
const { scoreStudentForListing } = require('../matchingEngine');

// Valid status transitions for PATCH
const VALID_STATUSES = new Set(['shortlisted', 'rejected', 'selected']);

/**
 * POST /api/applications
 * body: { student_id, listing_id }
 *
 * Runs the matching engine at the moment of application and stores
 * match_score so it is a snapshot (not recalculated on read).
 */
router.post('/', async (req, res) => {
  const { student_id, listing_id } = req.body;

  if (!student_id || !listing_id) {
    return res.status(400).json({ error: 'student_id and listing_id are required' });
  }

  const sId = Number(student_id);
  const lId = Number(listing_id);

  if (!Number.isFinite(sId) || !Number.isFinite(lId)) {
    return res.status(400).json({ error: 'student_id and listing_id must be numeric' });
  }

  try {
    // 1. Load listing (eligibility check)
    const listingRes = await pool.query(
      `SELECT id, eligibility_programme, institution_id
         FROM listings WHERE id = $1`,
      [lId]
    );
    if (listingRes.rows.length === 0) {
      return res.status(404).json({ error: 'Listing not found' });
    }
    const listing = listingRes.rows[0];

    // 2. Load student and check programme eligibility
    const studentRes = await pool.query(
      `SELECT id, name, programme FROM students WHERE id = $1`,
      [sId]
    );
    if (studentRes.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }
    const student = studentRes.rows[0];

    if (student.programme.toLowerCase() !== listing.eligibility_programme.toLowerCase()) {
      return res.status(403).json({
        error: `Student programme "${student.programme}" does not match listing eligibility "${listing.eligibility_programme}"`,
      });
    }

    // 3. Check for duplicate application
    const dupCheck = await pool.query(
      `SELECT id FROM applications WHERE student_id = $1 AND listing_id = $2`,
      [sId, lId]
    );
    if (dupCheck.rows.length > 0) {
      return res.status(409).json({ error: 'Application already exists', application_id: dupCheck.rows[0].id });
    }

    // 4. Fetch requirements & student skills, compute score
    const reqRes = await pool.query(
      `SELECT lr.skill_id, s.name AS skill_name,
              lr.required_level, lr.weight
         FROM listing_requirements lr
         JOIN skills s ON s.id = lr.skill_id
        WHERE lr.listing_id = $1`,
      [lId]
    );
    const requirements = reqRes.rows.map((r) => ({
      skill_id:       Number(r.skill_id),
      skill_name:     r.skill_name,
      required_level: Number(r.required_level),
      weight:         Number(r.weight),
    }));

    const skillsRes = await pool.query(
      `SELECT skill_id, proficiency_level FROM student_skills WHERE student_id = $1`,
      [sId]
    );
    const studentSkillMap = new Map(
      skillsRes.rows.map((r) => [Number(r.skill_id), Number(r.proficiency_level)])
    );

    const { alignment_percent } = scoreStudentForListing(requirements, studentSkillMap);

    // 5. Insert application
    const insertRes = await pool.query(
      `INSERT INTO applications (student_id, listing_id, status, match_score, applied_at)
       VALUES ($1, $2, 'applied', $3, NOW())
       RETURNING *`,
      [sId, lId, alignment_percent]
    );

    return res.status(201).json(insertRes.rows[0]);
  } catch (err) {
    console.error('POST /applications error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PATCH /api/applications/:id/status
 * body: { status }  – one of: shortlisted | rejected | selected
 */
router.patch('/:id/status', async (req, res) => {
  const appId  = Number(req.params.id);
  const { status } = req.body;

  if (!Number.isFinite(appId) || appId <= 0) {
    return res.status(400).json({ error: 'Invalid application id' });
  }
  if (!status || !VALID_STATUSES.has(status)) {
    return res.status(400).json({
      error: `status must be one of: ${[...VALID_STATUSES].join(', ')}`,
    });
  }

  try {
    const result = await pool.query(
      `UPDATE applications
          SET status = $1
        WHERE id = $2
        RETURNING *`,
      [status, appId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Application not found' });
    }

    return res.json(result.rows[0]);
  } catch (err) {
    console.error('PATCH /applications/:id/status error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
