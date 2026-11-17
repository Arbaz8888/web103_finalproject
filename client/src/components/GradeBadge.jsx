import { useCatalog } from '../hooks/useCatalog'
import { gradeTone } from '../utils/display'
import './GradeBadge.css'

function GradeBadge({ grade, size = 'md' }) {
  const catalog = useCatalog()
  return <span className={`grade-badge grade-${gradeTone(grade, catalog?.grades)} grade-badge-${size}`}>{grade}</span>
}

export default GradeBadge
