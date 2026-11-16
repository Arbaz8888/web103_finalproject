import { Link, useNavigate, useParams } from 'react-router-dom'
import RouteForm from '../components/RouteForm'
import NotFoundPage from './NotFoundPage'
import { useToast } from '../hooks/useToast'
import { usePageTitle } from '../hooks/usePageTitle'

function EditRoutePage({ routes, onSave }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const route = routes.find((item) => item.id === Number(id))
  usePageTitle(route ? `Edit ${route.name}` : 'Route not found')
  if (!route) return <NotFoundPage message="That route doesn't exist, or it was deleted." />

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
      <RouteForm existing={route} onSave={handleSave} submitLabel="Save changes" />
    </section>
  )
}

export default EditRoutePage
