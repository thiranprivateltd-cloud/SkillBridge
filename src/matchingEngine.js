// src/matchingEngine.js
// ─────────────────────────────────────────────────────────────────────────────
// Pure, deterministic gap-scoring engine.
// NO database calls – takes plain JS objects, returns a plain JS result.
// This makes it trivially unit-testable with hardcoded data.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Score a single student against a single listing.
 *
 * @param {Array<{skill_id, skill_name, required_level, weight}>} requirements
 *   All listing_requirements rows for the listing, each decorated with
 *   skill_name (joined from skills table by the caller).
 *
 * @param {Map<number, number>} studentSkillMap
 *   Map<skill_id -> proficiency_level> for the student.
 *   Skills the student has not listed default to level 0.
 *
 * @returns {{
 *   alignment_percent: number,          // 0-100, rounded to 1 dp
 *   gaps: Array<{
 *     skill_name: string,
 *     required_level: number,
 *     student_level: number,
 *     gap: number
 *   }>
 * }}
 */
function scoreStudentForListing(requirements, studentSkillMap) {
  if (!requirements || requirements.length === 0) {
    // Listing has no requirements – everyone gets a perfect score
    return { alignment_percent: 100, gaps: [] };
  }

  let weightedGapSum   = 0;   // Σ gap_i * weight_i
  let weightedLevelSum = 0;   // Σ required_level_i * weight_i  (denominator)

  const gaps = requirements.map((req) => {
    const studentLevel = studentSkillMap.get(Number(req.skill_id)) ?? 0;
    const gap          = Math.max(req.required_level - studentLevel, 0);

    weightedGapSum   += gap         * req.weight;
    weightedLevelSum += req.required_level * req.weight;

    return {
      skill_name:     req.skill_name,
      required_level: req.required_level,
      student_level:  studentLevel,
      gap,
    };
  });

  // Sort by largest gap first (most critical skill first)
  gaps.sort((a, b) => b.gap - a.gap);

  // Alignment % = 100 * (1 - weighted_gap / weighted_max), clamped [0, 100]
  let alignment = weightedLevelSum === 0
    ? 100
    : 100 * (1 - weightedGapSum / weightedLevelSum);

  alignment = Math.min(100, Math.max(0, alignment));
  alignment = Math.round(alignment * 10) / 10;  // 1 decimal place

  return { alignment_percent: alignment, gaps };
}

/**
 * Rank many students against one listing.
 *
 * @param {Array<{student_id, student_name}>} eligibleStudents
 * @param {Array<{skill_id, skill_name, required_level, weight}>} requirements
 * @param {Map<studentId, Map<skillId, proficiency_level>>} studentSkillMaps
 *   Outer key: student_id (number). Inner map: skill_id -> level.
 *
 * @returns {Array} Sorted descending by alignment_percent.
 */
function rankStudentsForListing(eligibleStudents, requirements, studentSkillMaps) {
  const results = eligibleStudents.map((student) => {
    const skillMap = studentSkillMaps.get(Number(student.student_id)) ?? new Map();
    const { alignment_percent, gaps } = scoreStudentForListing(requirements, skillMap);
    return {
      student_id:        student.student_id,
      student_name:      student.student_name,
      alignment_percent,
      gaps,
    };
  });

  results.sort((a, b) => b.alignment_percent - a.alignment_percent);
  return results;
}

/**
 * Rank many listings for one student.
 *
 * @param {Array<{listing_id, listing_title}>} eligibleListings
 * @param {Map<listingId, Array<{skill_id, skill_name, required_level, weight}>>} requirementsByListing
 * @param {Map<skillId, proficiency_level>} studentSkillMap
 *
 * @returns {Array} Sorted descending by alignment_percent.
 */
function rankListingsForStudent(eligibleListings, requirementsByListing, studentSkillMap) {
  const results = eligibleListings.map((listing) => {
    const requirements = requirementsByListing.get(Number(listing.listing_id)) ?? [];
    const { alignment_percent, gaps } = scoreStudentForListing(requirements, studentSkillMap);
    return {
      listing_id:        listing.listing_id,
      listing_title:     listing.listing_title,
      alignment_percent,
      gaps,
    };
  });

  results.sort((a, b) => b.alignment_percent - a.alignment_percent);
  return results;
}

module.exports = { scoreStudentForListing, rankStudentsForListing, rankListingsForStudent };
