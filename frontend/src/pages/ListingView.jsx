// frontend/src/pages/ListingView.jsx
// Screen 2 — /listing
// Read-only display of listing_id=1 with its requirements.
// Hardcoded: LISTING_ID = 1

import { useState, useEffect } from 'react'

const API        = import.meta.env.VITE_API_URL
const LISTING_ID = 1

export default function ListingView() {
  const [listing, setListing] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  useEffect(() => {
    fetch(`${API}/api/listings/${LISTING_ID}`)
      .then(r => r.ok ? r.json() : Promise.reject(r))
      .then(data => { setListing(data); setLoading(false) })
      .catch(() => { setError('Error fetching listing from the API.'); setLoading(false) })
  }, [])

  if (loading) return <div className="page loading">Loading listing…</div>
  if (error)   return <div className="page"><div className="error">{error}</div></div>

  return (
    <div className="page">
      <h1>{listing.title}</h1>
      <div className="listing-meta">
        <span className="badge badge-partner">🏢 {listing.partner_name}</span>
        <span className="badge badge-prog">Programme: {listing.eligibility_programme}</span>
        <span className="badge badge-open">Status: {listing.status}</span>
      </div>

      <div className="card">
        <h2 style={{ fontSize:'1.05rem', marginBottom:'1rem', color:'#4a5568' }}>
          Required Skills ({listing.requirements.length})
        </h2>
        <table className="req-table">
          <thead>
            <tr>
              <th>Skill</th>
              <th>Category</th>
              <th>Required Level</th>
              <th>Weight</th>
            </tr>
          </thead>
          <tbody>
            {listing.requirements.map(r => (
              <tr key={r.skill_id}>
                <td><strong>{r.skill_name}</strong></td>
                <td>{r.category}</td>
                <td>
                  <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                    <div style={{
                      height: 8, borderRadius: 4, background: '#e2e8f0',
                      width: 80, overflow: 'hidden',
                    }}>
                      <div style={{
                        height: '100%', borderRadius: 4,
                        background: '#3182ce',
                        width: `${r.required_level}%`,
                      }} />
                    </div>
                    <span style={{ fontWeight: 700 }}>{r.required_level}</span>
                  </div>
                </td>
                <td><span className="weight-pill">×{Number(r.weight).toFixed(2)}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p style={{ color:'#718096', fontSize:'0.85rem', marginTop:'0.5rem' }}>
        Weights control how heavily each skill factors into the alignment score.
        Higher weight = larger penalty for a gap in that skill.
      </p>
    </div>
  )
}
