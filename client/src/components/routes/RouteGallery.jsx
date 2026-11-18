import RouteCard from './RouteCard'

function RouteGallery({ routes, onQuickLook }) {
  return (
    <section className="route-grid" aria-label="Routes">
      {routes.map((route, index) => (
        <RouteCard key={route.id} route={route} onQuickLook={onQuickLook} style={{ '--i': Math.min(index, 12) }} />
      ))}
    </section>
  )
}

export default RouteGallery
