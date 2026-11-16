import { useEffect, useMemo, useState } from 'react'
import { fetchHolds } from '../api/holds'
import { useCatalog } from '../hooks/useCatalog'
import './ClimbingHoldsDrawer.css'

// Pick a hold from the catalog, then tap bolts on the wall to place it.
// Role and rotation are set on each placed hold afterwards, not here.
function ClimbingHoldsDrawer({ selectedHold, onSelectHold }) {
  const { holdTypes, holdSizes } = useCatalog()
  const [holds, setHolds] = useState([])
  const [status, setStatus] = useState('loading')
  const [activeType, setActiveType] = useState(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    fetchHolds()
      .then((data) => {
        if (cancelled) return
        setHolds(data)
        setStatus('ready')
      })
      .catch(() => !cancelled && setStatus('error'))
    return () => {
      cancelled = true
    }
  }, [attempt])

  // One tab per hold type in the backend's order, each ordered small -> large
  const sections = useMemo(
    () =>
      holdTypes
        .map((type) => ({
          type,
          holds: holds
            .filter((hold) => hold.holdType === type)
            .sort((a, b) => holdSizes.indexOf(a.size) - holdSizes.indexOf(b.size)),
        }))
        .filter((section) => section.holds.length > 0),
    [holds, holdTypes, holdSizes],
  )

  const current = sections.find((section) => section.type === activeType) ?? sections[0]

  return (
    <div className="holds-drawer">
      {status === 'loading' && <p className="holds-drawer-note">Loading holds…</p>}
      {status === 'error' && (
        <div className="holds-drawer-note" role="alert">
          Couldn't load the hold catalog.{' '}
          <button className="holds-drawer-retry" onClick={() => { setStatus('loading'); setAttempt((count) => count + 1) }} type="button">Retry</button>
        </div>
      )}
      {status === 'ready' && sections.length === 0 && <p className="holds-drawer-note">No holds available yet.</p>}

      {current && (
        <>
          <div className="holds-drawer-tabs" role="tablist" aria-label="Hold type">
            {sections.map((section) => (
              <button
                aria-selected={section.type === current.type}
                className={section.type === current.type ? 'selected' : ''}
                key={section.type}
                onClick={() => setActiveType(section.type)}
                role="tab"
                type="button"
              >
                {section.type}
              </button>
            ))}
          </div>
          <div className="holds-drawer-grid">
            {current.holds.map((hold) => (
              <button
                aria-pressed={selectedHold?.id === hold.id}
                className={`hold-card${selectedHold?.id === hold.id ? ' selected' : ''}`}
                key={hold.id}
                onClick={() => onSelectHold(selectedHold?.id === hold.id ? null : hold)}
                title={hold.name}
                type="button"
              >
                <img src={hold.imageUrl} alt="" draggable={false} />
                <span>{hold.name}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export default ClimbingHoldsDrawer
