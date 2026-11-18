import { useCatalog } from '../../hooks/useCatalog'
import { gradeTone } from '../../utils/display'
import './GradeBadge.css'

function GradeBadge({ grade, size = 'md' }) {
  const { grades } = useCatalog()
  return <span className={`grade-badge grade-${gradeTone(grade, grades)} grade-badge-${size}`}>{grade}</span>
}

export default GradeBadge
