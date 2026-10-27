// Una estación está «en línea» si envió una lectura dentro de esta ventana.
// Las estaciones envían cada ~10 minutos: 15 minutos tolera un envío atrasado
// sin marcarla desconectada entre lecturas. Constante, no viene del usuario,
// por eso se interpola directamente en el SQL.
export const ONLINE_WINDOW = '15 minutes'
