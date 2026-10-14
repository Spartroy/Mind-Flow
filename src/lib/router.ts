import { useSyncExternalStore } from 'react'

export type Route =
  | { name: 'board' }
  | { name: 'today' }
  | { name: 'map' }
  | { name: 'reports' }
  | { name: 'settings' }
  | { name: 'card'; id: string; page: boolean } // page = full page instead of side panel

export function parseHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean)
  switch (parts[0]) {
    case 'today': return { name: 'today' }
    case 'map': return { name: 'map' }
    case 'reports': return { name: 'reports' }
    case 'settings': return { name: 'settings' }
    case 'card': return parts[1] ? { name: 'card', id: decodeURIComponent(parts[1]), page: false } : { name: 'board' }
    case 'cards': return parts[1] ? { name: 'card', id: decodeURIComponent(parts[1]), page: true } : { name: 'board' }
    default: return { name: 'board' }
  }
}

const subscribe = (cb: () => void) => {
  window.addEventListener('hashchange', cb)
  return () => window.removeEventListener('hashchange', cb)
}

export const useHash = () => useSyncExternalStore(subscribe, () => location.hash)

export const navigate = (hash: string) => {
  location.hash = hash
}

export const cardHref = (id: string, page = false) => `#/${page ? 'cards' : 'card'}/${encodeURIComponent(id)}`
