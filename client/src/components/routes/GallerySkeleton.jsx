import './RouteGallery.css'

function GallerySkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading routes">
      <div className="skeleton skeleton-hero" />
      <div className="route-grid">
        {Array.from({ length: 6 }, (_, index) => (
          <div className="skeleton skeleton-card" key={index} />
        ))}
      </div>
    </div>
  )
}

export default GallerySkeleton
