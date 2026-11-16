import { gradeTone } from '../data/grades'

function GradeBadge({ grade, size = 'md' }) {
  return <span className={`grade-badge grade-${gradeTone(grade)} grade-badge-${size}`}>{grade}</span>
}

export default GradeBadge
