import { createContext, useContext } from 'react'

// Everything the backend defines: enums, rules (grid size, hold limits, …), wall types and the hold catalog.
// Loaded once by CatalogProvider; every component reads it from here instead of keeping its own copy.
export const CatalogContext = createContext(null)

export function useCatalog() {
  const catalog = useContext(CatalogContext)
  if (!catalog) throw new Error('useCatalog must be used inside <CatalogProvider>')
  return catalog
}
