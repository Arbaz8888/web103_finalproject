import { Link, useNavigate } from 'react-router-dom'
import RouteForm from '../components/builder/RouteForm'
import { useToast } from '../hooks/useToast'
import { usePageTitle } from '../hooks/usePageTitle'

function RouteBuilderPage({ routes, onSave }) {
  usePageTitle('Build a route')
  const navigate = useNavigate()
  const toast = useToast()

  function handleRandomRoute() {
    if (routes.length === 0) return
    const random = routes[Math.floor(Math.random() * routes.length)]
    navigate(`/routes/${random.id}`)
  }

  async function handleSave(route) {
    const saved = await onSave(route)
    toast(`Saved “${saved.name}”`)
    navigate(`/routes/${saved.id}`)
  }

  return (
    <section>
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link to="/">Routes</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">New route</span>
      </nav>
      <div className="page-heading">
        <div>
          <p className="eyebrow">ROUTE BUILDER</p>
          <h1>Build a <span className="accent-text">route.</span></h1>
        </div>
        <button className="button button-ghost" onClick={handleRandomRoute} disabled={routes.length === 0} type="button">
          🎲 Open a random route
        </button>
      </div>
      <RouteForm onSave={handleSave} submitLabel="Save route" />
    </section>
  )
}

export default RouteBuilderPage
