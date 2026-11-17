import { Link } from 'react-router-dom'
import { usePageTitle } from '../hooks/usePageTitle'

function NotFoundPage({ message = "That page doesn't exist." }) {
  usePageTitle('Not found')
  return (
    <section className="empty-state">
      <p className="eyebrow">404</p>
      <h1>Page not found.</h1>
      <p className="lede">{message}</p>
      <Link className="button button-primary" to="/">Back to saved routes</Link>
    </section>
  )
}

export default NotFoundPage
