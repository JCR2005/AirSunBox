#!/usr/bin/env python3
"""Diagramas BPMN en SVG con el estilo de los diagramas oficiales de AirSunBox.

Carriles horizontales con la barra lateral gris, tareas redondeadas celestes
con borde azul, eventos de inicio y fin circulares, compuertas en rombo lila y
conectores ortogonales. Cada nodo se ubica por carril, columna y fila.

    python3 docs/bpmn.py      → docs/diagramas/bpmn/PRO-XX.svg
"""
from pathlib import Path
from xml.sax.saxutils import escape

SALIDA = Path(__file__).resolve().parent / "diagramas" / "bpmn"

HEADER = 30          # barra lateral del carril
COL_W = 124          # ancho de columna
X0 = HEADER + 62     # primera columna
LANE_GAP = 20
TASK_W, TASK_H = 108, 72
EV_R = 17
GW = 22              # medio rombo
FONT = "Liberation Sans, Arial, sans-serif"


def wrap(texto, ancho=15):
    lineas, actual = [], ""
    for palabra in texto.split():
        if actual and len(actual) + 1 + len(palabra) > ancho:
            lineas.append(actual)
            actual = palabra
        else:
            actual = f"{actual} {palabra}".strip()
    if actual:
        lineas.append(actual)
    return lineas


class Proceso:
    def __init__(self, codigo, carriles, nodos, flujos):
        """carriles: [nombre]; nodos: {id: (tipo, carril, col, fila, texto)};
        flujos: [(origen, destino, etiqueta)]"""
        self.codigo, self.carriles, self.nodos, self.flujos = codigo, carriles, nodos, flujos
        filas = {c: [0] for c in carriles}
        for _, (_, carril, _, fila, _) in nodos.items():
            filas[carril].append(fila)
        self.alto = {c: 140 + 76 * (max(filas[c]) - min(filas[c])) for c in carriles}
        self.offset = {c: -min(filas[c]) for c in carriles}
        self.top = {}
        y = 10
        for c in carriles:
            self.top[c] = y
            y += self.alto[c] + LANE_GAP
        self.H = y - LANE_GAP + 10
        ncol = max(n[2] for n in nodos.values()) + 1
        self.W = X0 + ncol * COL_W

    def centro(self, nid):
        tipo, carril, col, fila, _ = self.nodos[nid]
        x = X0 + col * COL_W
        filas_carril = (self.alto[carril] - 140) // 76 + 1
        base = self.top[carril] + self.alto[carril] / 2 - (filas_carril - 1) * 38
        y = base + (fila + self.offset[carril]) * 76
        return x, y

    def medio(self, nid):
        tipo = self.nodos[nid][0]
        if tipo == "task":
            return TASK_W / 2, TASK_H / 2
        if tipo == "gateway":
            return GW, GW
        return EV_R, EV_R

    def svg(self):
        o = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{self.W}" height="{self.H}" '
             f'viewBox="0 0 {self.W} {self.H}" font-family="{FONT}">',
             '<defs><marker id="f" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">'
             '<path d="M0,0 L10,5 L0,10 z" fill="#1a1a1a"/></marker></defs>',
             f'<rect width="{self.W}" height="{self.H}" fill="#ffffff"/>']
        for c in self.carriles:
            t, h = self.top[c], self.alto[c]
            o.append(f'<rect x="1" y="{t}" width="{self.W - 2}" height="{h}" fill="#ffffff" stroke="#5a6b7c" stroke-width="1.2"/>')
            o.append(f'<rect x="1" y="{t}" width="{HEADER}" height="{h}" fill="#5a6b7c"/>')
            cx, cy = HEADER / 2 + 1, t + h / 2
            o.append(f'<text x="{cx}" y="{cy}" fill="#ffffff" font-size="13.5" font-weight="bold" text-anchor="middle" '
                     f'dominant-baseline="central" transform="rotate(-90 {cx} {cy})">{escape(c)}</text>')
        for f in self.flujos:
            o.append(self.flujo(*f))
        for nid in self.nodos:
            o.append(self.nodo(nid))
        o.append("</svg>")
        return "\n".join(o)

    def nodo(self, nid):
        tipo, _, _, _, texto = self.nodos[nid]
        x, y = self.centro(nid)
        if tipo == "task":
            lineas = wrap(texto)
            out = [f'<rect x="{x - TASK_W / 2}" y="{y - TASK_H / 2}" width="{TASK_W}" height="{TASK_H}" rx="7" '
                   f'fill="#e3eef9" stroke="#3a77b0" stroke-width="2"/>']
            y0 = y - (len(lineas) - 1) * 7.5
            for i, linea in enumerate(lineas):
                out.append(f'<text x="{x}" y="{y0 + i * 15}" font-size="12.5" text-anchor="middle" dominant-baseline="central" fill="#1a1a1a">{escape(linea)}</text>')
            return "".join(out)
        if tipo == "gateway":
            out = [f'<path d="M{x},{y - GW} L{x + GW},{y} L{x},{y + GW} L{x - GW},{y} z" fill="#d6c7e3" stroke="#7d5a9e" stroke-width="1.5"/>']
            for i, linea in enumerate(wrap(texto, 18)):
                out.append(f'<text x="{x - 7}" y="{y + GW + 13 + i * 13}" font-size="11.5" text-anchor="end" fill="#1a1a1a">{escape(linea)}</text>')
            return "".join(out)
        grosor = 3.2 if tipo == "end" else 1.6
        out = [f'<circle cx="{x}" cy="{y}" r="{EV_R}" fill="#dce8f6" stroke="#3a77b0" stroke-width="{grosor}"/>']
        if tipo == "timer":
            out.append(f'<circle cx="{x}" cy="{y}" r="{EV_R - 5}" fill="#ffffff" stroke="#3a77b0" stroke-width="1"/>'
                       f'<path d="M{x},{y - 8} L{x},{y} L{x + 6},{y}" stroke="#3a77b0" stroke-width="1.4" fill="none"/>')
        if texto:
            for i, linea in enumerate(wrap(texto, 16)):
                out.append(f'<text x="{x}" y="{y + EV_R + 14 + i * 13}" font-size="11.5" text-anchor="middle" fill="#1a1a1a">{escape(linea)}</text>')
        return "".join(out)

    def flujo(self, a, b, etiqueta, modo=""):
        (ax, ay), (bx, by) = self.centro(a), self.centro(b)
        (aw, ah), (bw, bh) = self.medio(a), self.medio(b)
        carril_a, carril_b = self.nodos[a][1], self.nodos[b][1]
        es_compuerta = self.nodos[a][0] == "gateway"
        if modo == "arriba":
            # Rodea por el borde superior del carril (salta las tareas intermedias)
            techo = self.top[carril_a] + 10
            puntos = [(ax, ay - ah), (ax, techo), (bx, techo), (bx, by - bh)]
        elif bx > ax and abs(ay - by) < 1:
            puntos = [(ax + aw, ay), (bx - bw, by)]
        elif bx > ax and modo == "derecha":
            # Sale por la derecha (para no compartir tramo con otra rama de la compuerta)
            xm = bx - bw - 20
            puntos = [(ax + aw, ay), (xm, ay), (xm, by), (bx - bw, by)]
        elif bx > ax and es_compuerta:
            # Compuerta: sale por arriba/abajo y entra por la izquierda del destino
            sy = ay + (ah if by > ay else -ah)
            puntos = [(ax, sy), (ax, by), (bx - bw, by)]
        elif bx > ax:
            # Tarea: tramo horizontal corto, vertical justo antes del destino
            xm = bx - bw - 20
            puntos = [(ax + aw, ay), (xm, ay), (xm, by), (bx - bw, by)]
        elif abs(bx - ax) < 1:
            puntos = [(ax, ay + (ah if by > ay else -ah)), (bx, by - (bh if by > ay else -bh))]
        else:
            # Vuelta atrás: baja al borde del carril de origen y vuelve por debajo
            fondo = self.top[carril_a] + self.alto[carril_a] - 9
            if carril_a == carril_b:
                puntos = [(ax, ay + ah), (ax, fondo), (bx, fondo), (bx, by + bh)]
            else:
                ey = by + (bh if by < ay else -bh)
                puntos = [(ax, ay + ah), (ax, fondo), (bx, fondo), (bx, ey)]
        d = " ".join(f"{'M' if i == 0 else 'L'}{x:.1f},{y:.1f}" for i, (x, y) in enumerate(puntos))
        out = f'<path d="{d}" fill="none" stroke="#1a1a1a" stroke-width="1.3" marker-end="url(#f)"/>'
        if etiqueta:
            (x1, y1), (x2, y2) = puntos[0], puntos[1]
            if abs(x1 - x2) < 1:   # primer tramo vertical
                lx, ly = x1 + 6, y1 + (15 if y2 > y1 else -6)
            else:
                lx, ly = x1 + 6, y1 - 6
            out += f'<text x="{lx}" y="{ly}" font-size="12" font-weight="bold" fill="#1a1a1a">{escape(etiqueta)}</text>'
        return out


T, G, S, E, TM = "task", "gateway", "start", "end", "timer"

PROCESOS = [
    Proceso("PRO-15", ["Usuario", "Sistema", "Servicio de correo"], {
        "s":  (S, "Usuario", 0, 0, ""),
        "u1": (T, "Usuario", 1, 0, "Ingresar correo y contraseña"),
        "s1": (T, "Sistema", 2, 0, "Validar credenciales (bcrypt)"),
        "g1": (G, "Sistema", 3, 0, "¿Credenciales válidas?"),
        "s2": (T, "Sistema", 4, 1, "Mostrar error (límite de intentos)"),
        "g2": (G, "Sistema", 4, 0, "¿2FA activo?"),
        "s3": (T, "Sistema", 5, 0, "Generar código de 6 dígitos (10 min)"),
        "c1": (T, "Servicio de correo", 5, 0, "Enviar código al correo"),
        "u2": (T, "Usuario", 6, 0, "Ingresar código o código de respaldo"),
        "s4": (T, "Sistema", 7, 0, "Validar código"),
        "g3": (G, "Sistema", 8, 0, "¿Código válido?"),
        "s5": (T, "Sistema", 9, 1, "Contar intento; bloquear 15 min al 3.º"),
        "s6": (T, "Sistema", 10, 0, "Emitir sesión JWT (24 h)"),
        "u3": (T, "Usuario", 11, 0, "Acceder al panel"),
        "e":  (E, "Usuario", 12, 0, ""),
    }, [("s", "u1", ""), ("u1", "s1", ""), ("s1", "g1", ""), ("g1", "s2", "No"), ("s2", "u1", ""),
        ("g1", "g2", "Sí"), ("g2", "s6", "No", "arriba"), ("g2", "s3", "Sí"), ("s3", "c1", ""), ("c1", "u2", ""),
        ("u2", "s4", ""), ("s4", "g3", ""), ("g3", "s5", "No"), ("s5", "u2", ""), ("g3", "s6", "Sí"),
        ("s6", "u3", ""), ("u3", "e", "")]),

    Proceso("PRO-16", ["Usuario", "Sistema", "Servicio de correo"], {
        "s":  (S, "Usuario", 0, 0, ""),
        "u1": (T, "Usuario", 1, 0, "Solicitar recuperación con su correo"),
        "s1": (T, "Sistema", 2, 0, "Generar enlace de un solo uso (10 min)"),
        "c1": (T, "Servicio de correo", 3, 0, "Enviar enlace"),
        "u2": (T, "Usuario", 4, 0, "Abrir enlace"),
        "s2": (T, "Sistema", 5, 0, "Validar enlace"),
        "g1": (G, "Sistema", 6, 0, "¿Vigente y sin usar?"),
        "s3": (T, "Sistema", 7, 1, "Mostrar «Este enlace ya no sirve»"),
        "e1": (E, "Sistema", 8, 1, ""),
        "u3": (T, "Usuario", 7, 0, "Elegir contraseña nueva y confirmar"),
        "s4": (T, "Sistema", 8, 0, "Guardar contraseña y consumir enlace"),
        "s5": (T, "Sistema", 9, 0, "Cerrar sesiones en todos los dispositivos"),
        "u4": (T, "Usuario", 10, 0, "Iniciar sesión con la contraseña nueva"),
        "e":  (E, "Usuario", 11, 0, ""),
    }, [("s", "u1", ""), ("u1", "s1", ""), ("s1", "c1", ""), ("c1", "u2", ""), ("u2", "s2", ""),
        ("s2", "g1", ""), ("g1", "s3", "No"), ("s3", "e1", ""), ("g1", "u3", "Sí"), ("u3", "s4", ""),
        ("s4", "s5", ""), ("s5", "u4", ""), ("u4", "e", "")]),

    Proceso("PRO-17", ["Estación ESP32", "Sistema", "Usuario"], {
        "s":  (TM, "Estación ESP32", 0, 0, "Cada intervalo"),
        "d1": (T, "Estación ESP32", 1, 0, "Medir variables"),
        "d2": (T, "Estación ESP32", 2, 0, "Enviar lectura (HTTPS o MQTT)"),
        "s1": (T, "Sistema", 3, 0, "Validar token de la estación"),
        "g1": (G, "Sistema", 4, 0, "¿Token válido?"),
        "s2": (T, "Sistema", 5, 1, "Rechazar (404 Token inválido)"),
        "e1": (E, "Sistema", 6, 1, ""),
        "s3": (T, "Sistema", 5, 0, "Encolar lectura (BullMQ)"),
        "s4": (T, "Sistema", 6, 0, "Guardar en serie de tiempo"),
        "s5": (T, "Sistema", 7, 0, "Publicar en tiempo real (WebSocket)"),
        "u1": (T, "Usuario", 8, 0, "Ver valor actualizado"),
        "e3": (E, "Usuario", 9, 0, ""),
        "s6": (T, "Sistema", 8, 0, "Evaluar reglas de alerta"),
        "g2": (G, "Sistema", 9, 0, "¿Supera umbral fuera de cooldown?"),
        "e2": (E, "Sistema", 10, 1, ""),
        "s7": (T, "Sistema", 10, 0, "Enviar correo, Telegram o webhook"),
        "u2": (T, "Usuario", 11, 0, "Recibir alerta"),
        "e":  (E, "Usuario", 12, 0, ""),
    }, [("s", "d1", ""), ("d1", "d2", ""), ("d2", "s1", ""), ("s1", "g1", ""), ("g1", "s2", "No"),
        ("s2", "e1", ""), ("g1", "s3", "Sí"), ("s3", "s4", ""), ("s4", "s5", ""), ("s5", "u1", ""),
        ("u1", "e3", ""), ("s5", "s6", ""), ("s6", "g2", ""), ("g2", "e2", "No"), ("g2", "s7", "Sí"),
        ("s7", "u2", ""), ("u2", "e", "")]),

    Proceso("PRO-18", ["Desarrollador", "GitHub Actions", "AWS (EC2)"], {
        "s":  (S, "Desarrollador", 0, 0, ""),
        "d1": (T, "Desarrollador", 1, 0, "Crear rama feature/fix desde develop"),
        "d2": (T, "Desarrollador", 2, 0, "Abrir PR a develop"),
        "g1": (T, "GitHub Actions", 3, 0, "CI: migraciones, build y pruebas"),
        "gw1": (G, "GitHub Actions", 4, 0, "¿CI en verde?"),
        "d3": (T, "Desarrollador", 5, 1, "Corregir y volver a subir"),
        "d4": (T, "Desarrollador", 6, 0, "Merge a develop y PR de release a main"),
        "g2": (T, "GitHub Actions", 7, 0, "CI + regla «Proteger main»; merge"),
        "g3": (T, "GitHub Actions", 8, 0, "Job deploy: rol IAM por OIDC"),
        "a1": (T, "AWS (EC2)", 9, 0, "Actualizar código y reconstruir contenedores"),
        "a2": (T, "AWS (EC2)", 10, 0, "Verificar salud y HTTPS"),
        "gw2": (G, "AWS (EC2)", 11, 0, "¿Saludable?"),
        "e":  (E, "AWS (EC2)", 12, 0, "Versión en producción"),
        "d5": (T, "Desarrollador", 12, 0, "Rollback según el runbook"),
        "e2": (E, "Desarrollador", 13, 0, ""),
    }, [("s", "d1", ""), ("d1", "d2", ""), ("d2", "g1", ""), ("g1", "gw1", ""), ("gw1", "d3", "No"),
        ("d3", "d2", ""), ("gw1", "d4", "Sí", "derecha"), ("d4", "g2", ""), ("g2", "g3", ""), ("g3", "a1", ""),
        ("a1", "a2", ""), ("a2", "gw2", ""), ("gw2", "e", "Sí"), ("gw2", "d5", "No"), ("d5", "e2", "")]),

    Proceso("PRO-19", ["Sistema", "Equipo AirSunBox", "Cliente"], {
        "s":  (TM, "Sistema", 0, 0, "Cada 5 minutos"),
        "s1": (T, "Sistema", 1, 0, "Revisar última lectura de cada estación"),
        "g1": (G, "Sistema", 2, 0, "¿Sin datos más de 30 min?"),
        "e1": (E, "Sistema", 3, 1, ""),
        "g2": (G, "Sistema", 4, 0, "¿Ya tiene incidencia abierta?"),
        "e2": (E, "Sistema", 5, 1, ""),
        "s2": (T, "Sistema", 5, 0, "Crear incidencia automática"),
        "s3": (T, "Sistema", 6, 0, "Notificar al equipo y al cliente"),
        "q1": (T, "Equipo AirSunBox", 7, 0, "Diagnosticar (remoto o visita)"),
        "c1": (T, "Cliente", 7, 0, "Recibir aviso de estación sin conexión"),
        "q2": (T, "Equipo AirSunBox", 8, 0, "Resolver y registrar la causa"),
        "s4": (T, "Sistema", 9, 0, "Cerrar incidencia al recibir datos"),
        "c2": (T, "Cliente", 10, 0, "Recibir confirmación"),
        "e":  (E, "Cliente", 11, 0, ""),
    }, [("s", "s1", ""), ("s1", "g1", ""), ("g1", "e1", "No"), ("g1", "g2", "Sí"), ("g2", "e2", "Sí"),
        ("g2", "s2", "No"), ("s2", "s3", ""), ("s3", "q1", ""), ("s3", "c1", ""), ("q1", "q2", ""),
        ("q2", "s4", ""), ("s4", "c2", ""), ("c2", "e", "")]),

    Proceso("PRO-20", ["Patrocinador", "Equipo AirSunBox", "Sistema", "Pasarela de pago"], {
        "s":  (S, "Patrocinador", 0, 0, ""),
        "p1": (T, "Patrocinador", 1, 0, "Solicitar plan de patrocinio"),
        "q1": (T, "Equipo AirSunBox", 2, 0, "Validar empresa y propuesta"),
        "g1": (G, "Equipo AirSunBox", 3, 0, "¿Aprobada?"),
        "q2": (T, "Equipo AirSunBox", 4, 1, "Notificar rechazo"),
        "e1": (E, "Equipo AirSunBox", 5, 1, ""),
        "s1": (T, "Sistema", 4, 0, "Crear organización y suscripción anual"),
        "pg": (T, "Pasarela de pago", 5, 0, "Cobrar suscripción"),
        "g2": (G, "Pasarela de pago", 6, 0, "¿Pago aprobado?"),
        "s2": (T, "Sistema", 7, 1, "Avisar y reintentar cobro"),
        "s3": (T, "Sistema", 8, 0, "Registrar pago y 20 % al Fondo de Acción Climática"),
        "s4": (T, "Sistema", 9, 0, "Activar beneficios (marca en mapa, reportes)"),
        "p2": (T, "Patrocinador", 10, 0, "Recibir factura y acceso"),
        "e":  (E, "Patrocinador", 11, 0, ""),
    }, [("s", "p1", ""), ("p1", "q1", ""), ("q1", "g1", ""), ("g1", "q2", "No"), ("q2", "e1", ""),
        ("g1", "s1", "Sí", "derecha"), ("s1", "pg", ""), ("pg", "g2", ""), ("g2", "s2", "No"), ("s2", "pg", ""),
        ("g2", "s3", "Sí", "derecha"), ("s3", "s4", ""), ("s4", "p2", ""), ("p2", "e", "")]),

    Proceso("PRO-21", ["Ciudadano", "Equipo AirSunBox", "Sistema"], {
        "s":  (S, "Ciudadano", 0, 0, ""),
        "c1": (T, "Ciudadano", 1, 0, "Solicitar nodo e indicar ubicación"),
        "q1": (T, "Equipo AirSunBox", 2, 0, "Evaluar ubicación y cobertura"),
        "g1": (G, "Equipo AirSunBox", 3, 0, "¿Ubicación viable?"),
        "q2": (T, "Equipo AirSunBox", 4, 1, "Notificar y sugerir otra ubicación"),
        "e1": (E, "Equipo AirSunBox", 5, 1, ""),
        "q3": (T, "Equipo AirSunBox", 4, 0, "Calibrar sensores y registrar coeficientes"),
        "s1": (T, "Sistema", 5, 0, "Registrar estación, token y conectividad"),
        "c2": (T, "Ciudadano", 6, 0, "Instalar y encender el nodo"),
        "s2": (T, "Sistema", 7, 0, "Verificar primeras 24 h de lecturas"),
        "g2": (G, "Sistema", 8, 0, "¿Lecturas coherentes?"),
        "q4": (T, "Equipo AirSunBox", 9, 0, "Recalibrar o reubicar"),
        "s3": (T, "Sistema", 9, 0, "Publicar en el mapa público"),
        "e":  (E, "Sistema", 10, 0, ""),
    }, [("s", "c1", ""), ("c1", "q1", ""), ("q1", "g1", ""), ("g1", "q2", "No"), ("q2", "e1", ""),
        ("g1", "q3", "Sí"), ("q3", "s1", ""), ("s1", "c2", ""), ("c2", "s2", ""), ("s2", "g2", ""),
        ("g2", "q4", "No"), ("q4", "s2", ""), ("g2", "s3", "Sí"), ("s3", "e", "")]),

    Proceso("PRO-22", ["Institución", "Equipo AirSunBox", "Sistema"], {
        "s":  (S, "Institución", 0, 0, ""),
        "i1": (T, "Institución", 1, 0, "Solicitar datos (zona, rango, variables)"),
        "q1": (T, "Equipo AirSunBox", 2, 0, "Revisar propósito y convenio"),
        "g1": (G, "Equipo AirSunBox", 3, 0, "¿Aprobada?"),
        "q2": (T, "Equipo AirSunBox", 4, 1, "Notificar rechazo y motivo"),
        "e1": (E, "Equipo AirSunBox", 5, 1, ""),
        "s1": (T, "Sistema", 4, 0, "Generar extracto agregado sin datos de clientes"),
        "s2": (T, "Sistema", 5, 0, "Publicar en S3 con enlace temporal"),
        "i2": (T, "Institución", 6, 0, "Descargar el conjunto de datos"),
        "s3": (T, "Sistema", 7, 0, "Registrar la entrega (auditoría)"),
        "e":  (E, "Sistema", 8, 0, ""),
    }, [("s", "i1", ""), ("i1", "q1", ""), ("q1", "g1", ""), ("g1", "q2", "No"), ("q2", "e1", ""),
        ("g1", "s1", "Sí", "derecha"), ("s1", "s2", ""), ("s2", "i2", ""), ("i2", "s3", ""), ("s3", "e", "")]),
]


def main():
    SALIDA.mkdir(parents=True, exist_ok=True)
    for p in PROCESOS:
        (SALIDA / f"{p.codigo}.svg").write_text(p.svg(), encoding="utf-8")
        print(f"  {p.codigo}.svg  {p.W}x{p.H}")


if __name__ == "__main__":
    main()
