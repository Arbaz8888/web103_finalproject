import { Link, NavLink } from 'react-router-dom'
import './Navbar.css'

function Navbar({ routeCount }) {
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link className="brand" to="/" aria-label="Crux Maker home">
          <span className="brand-mark" aria-hidden="true">◈</span>
          <span>Crux<span className="brand-light">Maker</span></span>
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
