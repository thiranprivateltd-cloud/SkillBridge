// frontend/src/pages/StudentView.jsx
// Screen 1 — /student
// Shows the demo student's 7 skills with editable sliders.
// Hardcoded: STUDENT_ID = 1

import { useState, useEffect } from 'react'

const API   = import.meta.env.VITE_API_URL
const STUDENT_ID = 1

export default function StudentView() {
  const [skills,   setSkills]   = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)
  const [saving,   setSaving]   = useState(false)
  const [saveMsg,  setSaveMsg]  = useState('')

  useEffect(() => {
    fetch(`${API}/api/students/${STUDENT_ID}/skills`)
      .then(r => r.ok ? r.json() : Promise.reject(r))
      .then(data => { setSkills(data); setLoading(false) })
      .catch(() => { setError('Error fetching skills from the API.'); setLoading(false) })
  }, [])

  function handleChange(skillId, value) {
    setSaveMsg('')
    setSkills(prev => prev.map(s =>
      s.skill_id === skillId ? { ...s, proficiency_level: Number(value) } : s
    ))
  }

  async function handleSave() {
    setSaving(true); setSaveMsg('')
    try {
      const payload = skills.map(s => ({ skill_id: s.skill_id, proficiency_level: s.proficiency_level }))
      const r = await fetch(`${API}/api/students/${STUDENT_ID}/skills`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!r.ok) throw new Error()
      const data = await r.json()
      setSaveMsg(`✓ Saved ${data.updated} skill${data.updated !== 1 ? 's' : ''} successfully.`)
    } catch {
      setSaveMsg('✗ Save failed — check the API is running.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="page loading">Loading skills…</div>
  if (error)   return <div className="page"><div className="error">{error}</div></div>

  return (
    <div className="page">
      <h1>Student Skills Assessment</h1>
      <p className="subtitle">Demo Student (ID {STUDENT_ID}) · Drag the slider to adjust proficiency (0 – 100).</p>

      <div className="card">
        {skills.map(s => (
          <div className="skill-row" key={s.skill_id}>
            <div>
              <div className="skill-label">{s.skill_name}</div>
              <div className="skill-cat">{s.category}</div>
            </div>
            <input
              type="range"
              min={0} max={100} step={1}
              value={s.proficiency_level}
              onChange={e => handleChange(s.skill_id, e.target.value)}
            />
            <div className="level-badge">{s.proficiency_level}</div>
          </div>
        ))}
      </div>

      <button className="btn-save" onClick={handleSave} disabled={saving}>
        {saving ? 'Saving…' : 'Save Assessment'}
      </button>
      {saveMsg && <div className={`save-ok`} style={saveMsg.startsWith('✗') ? {color:'#c53030'} : {}}>{saveMsg}</div>}
    </div>
  )
}
