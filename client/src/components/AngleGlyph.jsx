import './AngleGlyph.css'

// Tiny side-on sketch of a wall angle: floor, dashed vertical, and the wall leaning to `angle`
function AngleGlyph({ angle = 0, className = '' }) {
  const radians = (Math.max(-90, Math.min(90, angle)) * Math.PI) / 180
  return (
    <svg className={`angle-glyph ${className}`} viewBox="0 0 28 24" aria-hidden="true">
      <line x1="2" y1="21" x2="26" y2="21" className="angle-glyph-floor" />
      <line x1="9" y1="21" x2="9" y2="3" className="angle-glyph-ref" />
      <line x1="9" y1="21" x2={9 + 17 * Math.sin(radians)} y2={21 - 17 * Math.cos(radians)} className="angle-glyph-wall" />
    </svg>
  )
}

export default AngleGlyph
