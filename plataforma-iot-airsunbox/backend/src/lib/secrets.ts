import { SSMClient, GetParametersCommand } from '@aws-sdk/client-ssm'

// Secretos de producción en AWS Systems Manager Parameter Store (SecureString,
// cifrados con KMS). Con SSM_SECRETS_PATH definido (p. ej. /airsunbox/prod),
// al arrancar se leen <ruta>/JWT_SECRET, <ruta>/DB_PASSWORD y <ruta>/SMTP_PASS
// y se cargan en process.env antes de iniciar la aplicación. Las credenciales
// de AWS salen del rol de la instancia EC2: no hay ninguna clave en el
// servidor ni en el repositorio.
//
// Sin SSM_SECRETS_PATH (desarrollo, CI) no se consulta AWS y valen las
// variables de entorno / backend/.env de siempre.
export const SECRET_NAMES = ['JWT_SECRET', 'DB_PASSWORD', 'SMTP_PASS'] as const

export async function loadSecretsFromSsm(): Promise<void> {
  const path = process.env.SSM_SECRETS_PATH?.trim().replace(/\/+$/, '')
  if (!path) return

  const client = new SSMClient({ region: process.env.AWS_REGION || 'us-east-2', maxAttempts: 3 })
  try {
    const res = await client.send(new GetParametersCommand({
      Names: SECRET_NAMES.map(name => `${path}/${name}`),
      WithDecryption: true
    }))
    const loaded: string[] = []
    for (const p of res.Parameters ?? []) {
      const name = p.Name?.slice(path.length + 1)
      if (name && p.Value) {
        process.env[name] = p.Value
        loaded.push(name)
      }
    }
    const missing = SECRET_NAMES.filter(n => !loaded.includes(n))
    console.log(`Secretos cargados desde SSM (${path}): ${loaded.join(', ') || 'ninguno'}`)
    if (missing.length) console.warn(`Secretos que no están en SSM: ${missing.join(', ')}`)
  } catch (err) {
    // Si todos los secretos ya están en el entorno se puede seguir; si falta
    // alguno, arrancar sin él sería peor que no arrancar.
    const missing = SECRET_NAMES.filter(n => !process.env[n])
    const reason = (err as Error).message
    if (missing.length) {
      throw new Error(`No se pudieron leer los secretos de SSM (${reason}) y faltan: ${missing.join(', ')}`)
    }
    console.warn(`No se pudieron leer los secretos de SSM (${reason}); se usan los del entorno`)
  } finally {
    client.destroy()
  }
}
