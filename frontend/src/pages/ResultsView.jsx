// frontend/src/pages/ResultsView.jsx
// Screen 3 — /results
// Shows match results for listing_id=1 from GET /api/listings/1/matches.
// Apply button calls POST /api/applications.
// Hardcoded: STUDENT_ID = 1, LISTING_ID = 1

import { useState, useEffect } from 'react'

const API        = import.meta.env.VITE_API_URL
const LISTING_ID = 1
const STUDENT_ID = 1

function GapTable({ gaps }) {
  if (!gaps || gaps.length === 0) {
    return <p style={{ color: '#718096', fontSize: '0.9rem' }}>No skill requirements defined for this listing.</p>
  }
  return (
    <table className="gap-table">
      <thead>
        <tr>
          <th>Skill</th>
          <th style={{ textAlign: 'center' }}>Required</th>
          <th style={{ textAlign: 'center' }}>Student Level</th>
          <th style={{ textAlign: 'center' }}>Gap</th>
        </tr>
      </thead>
      <tbody>
        {gaps.map((g, i) => (
          <tr
            key={g.skill_name}
            className={i === 0 && g.gap > 0 ? 'gap-top' : g.gap === 0 ? 'gap-zero' : ''}
          >
            <td>
              {i === 0 && g.gap > 0 && (
                <span style={{ marginRight: 6, fontSize: '0.75rem',
                  background: '#fed7d7', color: '#c53030', padding: '1px 6px',
                  borderRadius: 10, fontWeight: 700 }}>
                  TOP GAP
                </span>
              )}
              {g.skill_name}
            </td>
            <td style={{ textAlign: 'center' }}>{g.required_level}</td>
            <td style={{ textAlign: 'center' }}>{g.student_level}</td>
            <td style={{ textAlign: 'center', fontWeight: g.gap > 0 ? 700 : 400 }}>
              {g.gap > 0 ? `−${g.gap}` : '✓'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function MatchCard({ student }) {
  const [appState, setAppState] = useState(null) // null | 'applying' | { id, match_score, status }
  const [appError, setAppError] = useState(null)

  // Check if this student is the demo student (STUDENT_ID=1) for the Apply button
  const isDemo = student.student_id === STUDENT_ID

  async function handleApply() {
    setAppState('applying'); setAppError(null)
    try {
      const r = await fetch(`${API}/api/applications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: STUDENT_ID, listing_id: LISTING_ID }),
      })
      const data = await r.json()
      if (r.status === 409) {
        // Already applied — treat as success for display
        setAppState({ match_score: student.alignment_percent, status: 'applied (existing)' })
        return
      }
      if (!r.ok) throw new Error(data.error || 'Unknown error')
      setAppState({ match_score: data.match_score, status: data.status })
    } catch (e) {
      setAppError(e.message)
      setAppState(null)
    }
  }

  const pct = student.alignment_percent
  const scoreColor = pct >= 80 ? '#276749' : pct >= 60 ? '#2b6cb0' : '#c05621'

  return (
    <div className="card match-card">
      <div className="match-header">
        <div>
          <div className="match-name">{student.student_name}</div>
          <div style={{ color:'#718096', fontSize:'0.85rem', marginTop:2 }}>
            Student ID: {student.student_id}
          </div>
        </div>
        <div style={{ textAlign:'right' }}>
          <div className="alignment-score" style={{ color: scoreColor }}>
            {pct}%
          </div>
          <div className="alignment-label">Aligned</div>
        </div>
      </div>

      <GapTable gaps={student.gaps} />

      {isDemo && (
        <div style={{ marginTop: '1.25rem' }}>
          {appState && appState !== 'applying' ? (
            <div className="apply-result">
              <strong>Applied!</strong> Match score locked at{' '}
              <strong>{Number(appState.match_score).toFixed(1)}%</strong>
              <span className="status-badge">{appState.status}</span>
            </div>
          ) : (
            <>
              <button
                className="btn-apply"
                onClick={handleApply}
                disabled={appState === 'applying'}
              >
                {appState === 'applying' ? 'Applying…' : 'Apply for this Listing'}
              </button>
              {appError && (
                <div className="error" style={{ marginTop: '0.75rem' }}>{appError}</div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default function ResultsView() {
  const [matches,  setMatches]  = useState([])
  const [listing,  setListing]  = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)

  useEffect(() => {
    Promise.all([
      fetch(`${API}/api/listings/${LISTING_ID}/matches`).then(r => r.ok ? r.json() : Promise.reject('matches')),
      fetch(`${API}/api/listings/${LISTING_ID}`).then(r => r.ok ? r.json() : Promise.reject('listing')),
    ])
      .then(([m, l]) => { setMatches(m); setListing(l); setLoading(false) })
      .catch(() => { setError('Error fetching match data from the API.'); setLoading(false) })
  }, [])

  if (loading) return <div className="page loading">Loading match results…</div>
  if (error)   return <div className="page"><div className="error">{error}</div></div>

  // Check if demo student was filtered out by eligibility
  const demoInResults = matches.some(m => m.student_id === STUDENT_ID)

  return (
    <div className="page">
      <h1>Match Results</h1>
      <p className="subtitle">
        Listing: <strong>{listing?.title}</strong> ·{' '}
        Eligible programme: <strong>{listing?.eligibility_programme}</strong> ·{' '}
        {matches.length} eligible candidate{matches.length !== 1 ? 's' : ''}
      </p>

      {/* Eligibility filter transparency message */}
      {!demoInResults && (
        <div className="ineligible-msg">
          ⚠️ <strong>Demo Student (ID {STUDENT_ID}) was filtered out.</strong> Their programme does not match{' '}
          <strong>{listing?.eligibility_programme}</strong> — the eligibility filter is active.
        </div>
      )}

      {matches.length === 0 ? (
        <div className="card">
          <p style={{ color:'#718096' }}>No eligible students found for this listing.</p>
        </div>
      ) : (
        matches.map(student => (
          <MatchCard key={student.student_id} student={student} />
        ))
      )}
    </div>
  )
}
