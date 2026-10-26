import { phpBackend } from './phpBackend'
import { sheetsBackend } from './sheets/sheetsBackend'

// VITE_BACKEND=sheets : démo statique (GitHub Pages) connectée directement à Google Sheets.
// VITE_BACKEND=php (défaut) : API PHP sur le serveur.
export const backend = import.meta.env.VITE_BACKEND === 'sheets' ? sheetsBackend : phpBackend
