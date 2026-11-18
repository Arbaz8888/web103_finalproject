import { Link, useNavigate, useParams } from 'react-router-dom'
import RouteForm from '../components/RouteForm'
import NotFoundPage from './NotFoundPage'
import { useRoute } from '../hooks/useRoute'
import { useToast } from '../hooks/useToast'
import { usePageTitle } from '../hooks/usePageTitle'

function EditRoutePage({ onSave }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { status, route, error, retry } = useRoute(id)
  usePageTitle(route ? `Edit ${route.name}` : status === 'loading' ? 'Loading route' : 'Route not found')

  if (status === 'loading') return <div className="skeleton skeleton-details" aria-busy="true" aria-label="Loading route" />
  if (status === 'missing') return <NotFoundPage message="That route doesn't exist, or it was deleted." />
  if (status === 'error') return (
    <section className="empty-state" role="alert">
      <p className="eyebrow">ERROR</p>
      <h1>Couldn't load this route.</h1>
      <p className="lede">{error}</p>
      <button className="button button-primary" type="button" onClick={retry}>Try again</button>
    </section>
  )

  async function handleSave(updatedRoute) {
    await onSave(updatedRoute)
    toast('Changes saved')
    navigate(`/routes/${route.id}`)
  }

  return (
    <section>
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link to="/">Routes</Link>
        <span aria-hidden="true">/</span>
        <Link to={`/routes/${route.id}`}>{route.name}</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">Edit</span>
      </nav>
      <div className="page-heading">
        <div>
          <p className="eyebrow">EDIT ROUTE</p>
          <h1>Edit <span className="accent-text">{route.name}.</span></h1>
        </div>
        <Link className="button button-ghost" to={`/routes/${route.id}`}>Cancel</Link>
      </div>
      <RouteForm key={route.id} existing={route} onSave={handleSave} submitLabel="Save changes" />
    </section>
  )
}

export default EditRoutePage
