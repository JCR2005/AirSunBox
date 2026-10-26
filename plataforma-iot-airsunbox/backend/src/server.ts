// Punto de entrada: primero se cargan los secretos (SSM en producción) y
// después la aplicación, que los lee al importarse.
import 'dotenv/config'
import { loadSecretsFromSsm } from './lib/secrets.js'

await loadSecretsFromSsm()
await import('./app.js')
