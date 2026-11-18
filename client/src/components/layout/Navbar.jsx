import { Link, NavLink } from 'react-router-dom'
import { APP_NAME } from '../../config/app'
import './Navbar.css'

function Navbar({ routeCount }) {
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link className="brand" to="/" aria-label={`${APP_NAME} home`}>
          <span className="brand-mark" aria-hidden="true">◈</span>
          <span>Beta<span className="brand-light">Spray</span></span>
        </Link>
        <nav aria-label="Main navigation">
          <NavLink className="nav-link" to="/" end>
            Routes{routeCount != null && <span className="nav-count">{routeCount}</span>}
          </NavLink>
          <NavLink className="button button-primary button-sm" to="/routes/new">
            <span aria-hidden="true">＋</span> Build a route
          </NavLink>
        </nav>
      </div>
    </header>
  )
}

export default Navbar
