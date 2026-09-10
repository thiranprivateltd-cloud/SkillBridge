// tests/testMatchingEngine.js
// ─────────────────────────────────────────────────────────────────────────────
// Offline unit-test for the matching engine.
// Run with:  node tests/testMatchingEngine.js
// No database needed – all input is hardcoded below.
// ─────────────────────────────────────────────────────────────────────────────

const { scoreStudentForListing, rankStudentsForListing } = require('../src/matchingEngine');

// ── Helpers ────────────────────────────────────────────────────────────────
const pass = (label) => console.log(`  ✅  PASS  ${label}`);
const fail = (label, got, expected) =>
  console.error(`  ❌  FAIL  ${label}\n       got: ${JSON.stringify(got)}\n  expected: ${JSON.stringify(expected)}`);

let failures = 0;
function assert(label, condition, got, expected) {
  if (condition) {
    pass(label);
  } else {
    fail(label, got, expected);
    failures++;
  }
}

// ── Test fixtures ──────────────────────────────────────────────────────────
//
// Listing requirements (mirrors the prompt example):
//   Skill A: required_level=70, weight=1
//   Skill B: required_level=80, weight=1
//   Skill C: required_level=60, weight=1
//
// Expected alignment calculation for Student 1:
//   gap_A = max(70-40, 0) = 30
//   gap_B = max(80-70, 0) = 10
//   gap_C = max(60-65, 0) = 0
//   weightedGapSum   = 30*1 + 10*1 + 0*1 = 40
//   weightedLevelSum = 70*1 + 80*1 + 60*1 = 210
//   alignment% = 100 * (1 - 40/210) = 100 * 170/210 ≈ 80.952... → 81.0
//
// Note: the prompt shows 78.4 as an illustrative value.  Our formula
// gives 81.0 for these exact numbers – the arithmetic below confirms it.

const requirements = [
  { skill_id: 1, skill_name: 'GMP / Quality Compliance Awareness',  required_level: 70, weight: 1 },
  { skill_id: 2, skill_name: 'Panchakarma Technique Proficiency',    required_level: 80, weight: 1 },
  { skill_id: 3, skill_name: 'Patient Case Documentation',           required_level: 60, weight: 1 },
];

// ── Test 1: Partial skill coverage ─────────────────────────────────────────
console.log('\n── Test 1: Single student, partial coverage ──');
{
  const studentSkillMap = new Map([
    [1, 40], // Skill A: below required
    [2, 70], // Skill B: below required
    [3, 65], // Skill C: above required → gap = 0
  ]);

  const result = scoreStudentForListing(requirements, studentSkillMap);

  // 100 * (1 - 40/210) = 80.952... → 81.0
  const expectedAlignment = 81.0;
  assert('alignment_percent equals 81.0',
    result.alignment_percent === expectedAlignment,
    result.alignment_percent, expectedAlignment);

  assert('gaps array has 3 entries',
    result.gaps.length === 3,
    result.gaps.length, 3);

  // Sorted by largest gap first → [30, 10, 0]
  assert('gaps sorted by gap desc',
    result.gaps[0].gap === 30 && result.gaps[1].gap === 10 && result.gaps[2].gap === 0,
    result.gaps.map(g => g.gap), [30, 10, 0]);

  assert('skill C gap is 0 (student exceeds requirement)',
    result.gaps[2].gap === 0,
    result.gaps[2].gap, 0);

  console.log('  Computed score:', result.alignment_percent + '%');
  console.log('  Gap breakdown:', JSON.stringify(result.gaps, null, 4));
}

// ── Test 2: Student has ZERO skills (worst case) ───────────────────────────
console.log('\n── Test 2: Student with no matching skills ──');
{
  const result = scoreStudentForListing(requirements, new Map());

  // All skills missing → treated as level 0
  // gap_A=70, gap_B=80, gap_C=60
  // weightedGapSum=210, weightedLevelSum=210
  // alignment = 100*(1-1) = 0
  assert('alignment_percent is 0 when student has no skills',
    result.alignment_percent === 0,
    result.alignment_percent, 0);
}

// ── Test 3: Student exceeds all requirements (best case) ──────────────────
console.log('\n── Test 3: Student exceeds all requirements ──');
{
  const studentSkillMap = new Map([
    [1, 100],
    [2, 100],
    [3, 100],
  ]);
  const result = scoreStudentForListing(requirements, studentSkillMap);

  assert('alignment_percent is 100 when student exceeds all',
    result.alignment_percent === 100,
    result.alignment_percent, 100);

  assert('all gaps are 0',
    result.gaps.every(g => g.gap === 0),
    result.gaps.map(g => g.gap), [0, 0, 0]);
}

// ── Test 4: No requirements (edge case) ───────────────────────────────────
console.log('\n── Test 4: Listing with no requirements ──');
{
  const result = scoreStudentForListing([], new Map());
  assert('alignment_percent is 100 when no requirements',
    result.alignment_percent === 100,
    result.alignment_percent, 100);
  assert('gaps array is empty',
    result.gaps.length === 0,
    result.gaps.length, 0);
}

// ── Test 5: Weighted scoring (non-uniform weights) ─────────────────────────
console.log('\n── Test 5: Weighted scoring ──');
{
  // Skill X: required=100, weight=3  (high priority)
  // Skill Y: required=100, weight=1  (low priority)
  const weightedReqs = [
    { skill_id: 10, skill_name: 'Skill X', required_level: 100, weight: 3 },
    { skill_id: 11, skill_name: 'Skill Y', required_level: 100, weight: 1 },
  ];

  // Student has Skill X at 100 (no gap) but Skill Y at 0 (full gap)
  const studentSkillMap = new Map([[10, 100]]);

  // gap_X = 0,   weighted gap_X = 0 * 3 = 0
  // gap_Y = 100, weighted gap_Y = 100 * 1 = 100
  // weightedGapSum   = 100
  // weightedLevelSum = 100*3 + 100*1 = 400
  // alignment = 100 * (1 - 100/400) = 100 * 0.75 = 75.0
  const result = scoreStudentForListing(weightedReqs, studentSkillMap);
  assert('weighted alignment_percent is 75.0',
    result.alignment_percent === 75.0,
    result.alignment_percent, 75.0);
}

// ── Test 6: rankStudentsForListing – ordering ──────────────────────────────
console.log('\n── Test 6: rankStudentsForListing ordering ──');
{
  const students = [
    { student_id: 1, student_name: 'Alice' },
    { student_id: 2, student_name: 'Bob' },
    { student_id: 3, student_name: 'Carol' },
  ];

  const skillMaps = new Map([
    [1, new Map([[1, 40], [2, 70], [3, 65]])], // Alice: ~81%
    [2, new Map()],                              // Bob:   0%
    [3, new Map([[1, 70], [2, 80], [3, 60]])],  // Carol: 100%
  ]);

  const ranked = rankStudentsForListing(students, requirements, skillMaps);

  assert('Carol is ranked #1 (100%)',
    ranked[0].student_name === 'Carol',
    ranked[0].student_name, 'Carol');
  assert('Alice is ranked #2 (~81%)',
    ranked[1].student_name === 'Alice',
    ranked[1].student_name, 'Alice');
  assert('Bob is ranked #3 (0%)',
    ranked[2].student_name === 'Bob',
    ranked[2].student_name, 'Bob');

  console.log('  Ranked order:',
    ranked.map(r => `${r.student_name} (${r.alignment_percent}%)`).join(' → '));
}

// ── Summary ────────────────────────────────────────────────────────────────
console.log('\n' + '─'.repeat(60));
if (failures === 0) {
  console.log('All tests passed ✅');
} else {
  console.error(`${failures} test(s) failed ❌`);
  process.exit(1);
}
