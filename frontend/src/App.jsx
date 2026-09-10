// frontend/src/App.jsx
import { Routes, Route, NavLink, Navigate } from 'react-router-dom'
import StudentView  from './pages/StudentView.jsx'
import ListingView  from './pages/ListingView.jsx'
import ResultsView  from './pages/ResultsView.jsx'

export default function App() {
  return (
    <>
      <nav>
        <span className="brand">SkillBridge</span>
        <NavLink to="/student"  className={({ isActive }) => isActive ? 'active' : ''}>Student</NavLink>
        <NavLink to="/listing"  className={({ isActive }) => isActive ? 'active' : ''}>Listing</NavLink>
        <NavLink to="/results"  className={({ isActive }) => isActive ? 'active' : ''}>Results</NavLink>
      </nav>
      <Routes>
        <Route path="/"         element={<Navigate to="/results" replace />} />
        <Route path="/student"  element={<StudentView />} />
        <Route path="/listing"  element={<ListingView />} />
        <Route path="/results"  element={<ResultsView />} />
      </Routes>
    </>
  )
}
