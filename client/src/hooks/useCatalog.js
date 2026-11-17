import { createContext, useContext } from 'react'

// Everything the backend says is allowed: { grades, holdRoles, holdTypes, holdSizes, wallTypes }.
// Loaded once in App so no component keeps its own copy of these lists.
export const CatalogContext = createContext(null)

export const useCatalog = () => useContext(CatalogContext)
