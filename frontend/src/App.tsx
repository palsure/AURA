import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Review from './pages/Review'
import Tests from './pages/Tests'
import Predictions from './pages/Predictions'
import Actions from './pages/Actions'
import Issues from './pages/Issues'
import Repositories from './pages/Repositories'
import RepositoryDetails from './pages/RepositoryDetails'

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/review" element={<Review />} />
          <Route path="/tests" element={<Tests />} />
          <Route path="/predictions" element={<Predictions />} />
          <Route path="/actions" element={<Actions />} />
          <Route path="/issues" element={<Issues />} />
          <Route path="/repositories" element={<Repositories />} />
          <Route path="/repositories/:id" element={<RepositoryDetails />} />
        </Routes>
      </Layout>
    </Router>
  )
}

export default App

