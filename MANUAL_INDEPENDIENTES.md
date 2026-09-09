# Manual de Usuario — Organizaciones Independientes (Tipo B)

**Plataforma Sanik IoT**  
Versión 1.0 — Septiembre 2026

---

## 1. Introducción

### 1.1 ¿Qué es Sanik?
Sanik es una plataforma IoT para monitoreo ambiental (calidad de aire, agua, suelo, ruido, energía). Permite a organizaciones **independientes (Tipo B)** autogestionar sus espacios, estaciones, variables y configuración AQI sin depender del equipo Sanik.

### 1.2 Tipos de organización
| Tipo | Descripción | Quién la gestiona |
|------|-------------|-------------------|
| **A (Dependiente)** | Gestionada por Sanik; espacios ocultos, catálogo global | Equipo Sanik |
| **B (Independiente / Autogestionada)** | El cliente crea sus espacios, variables, AQI, estaciones | **Usted (este manual)** |

> **Este manual cubre exclusivamente organizaciones Tipo B.**

---

## 2. Acceso a la plataforma

### 2.1 Creación de cuenta (Registro)
1. Acceda a la URL de la plataforma (ej. `https://sanik.example.com`).
2. Haga clic en **"Registrarse"** / **"Crear cuenta"**.
3. Complete el formulario:
   - **Nombre completo**
   - **Correo electrónico corporativo** (será su usuario)
   - **Contraseña** (mín. 8 caracteres, mayúscula, número, símbolo)
   - **Nombre de la organización**
4. En **Tipo de organización**, seleccione **"Independiente (Autogestionada)"**.
5. Acepte términos y envíe.
6. Recibirá un correo de confirmación; haga clic en el enlace para activar la cuenta.

> **Nota:** El primer usuario que se registra en una organización queda como **Administrador** de la misma. Puede invitar a más usuarios desde **Configuración → Usuarios**.

### 2.2 Inicio de sesión (Login)
1. En la página principal, ingrese su **correo** y **contraseña**.
2. Si pertenece a varias organizaciones, se le pedirá **seleccionar la organización** al entrar.
3. Haga clic en **"Entrar"**.

### 2.3 Recuperación de contraseña
1. En la pantalla de login, haga clic en **"¿Olvidó su contraseña?"**.
2. Ingrese su correo electrónico registrado.
3. Recibirá un correo con un **enlace temporal** (válido 1 hora).
4. Haga clic en el enlace y defina una nueva contraseña.
5. Vuelva a la pantalla de login con la nueva clave.

---

## 3. Primeros pasos: Espacios

### 3.1 ¿Qué es un espacio?
Un **espacio** es el contenedor lógico donde define:
- El **dominio** de medición (aire, agua, suelo, ruido, energía, otro)
- Sus **variables** propias (nombre, unidad, ícono)
- La **configuración AQI** (categorías, variables participantes, límites)
- Las **estaciones** (dispositivos físicos) que pertenecen a ese espacio

### 3.2 Crear un espacio
1. En el menú lateral, vaya a **"Espacios"**.
2. Haga clic en **"+ Nuevo espacio"**.
3. Complete:
   - **Nombre** (ej. "Calidad de Aire - Planta Norte")
   - **Tipo**: Aire / Agua / Suelo / Ruido / Energía / Otro
   - **Color** (se usa en tarjetas, mapa, AQI)
   - **Icono** (opcional, se elige de la lista)
   - **Descripción** (opcional)
4. Guarde. El espacio aparece en la lista con su color e icono.

> **Tip:** Para que sus estaciones puedan aparecer en el **mapa público**, el espacio **debe ser de tipo "Aire"**.

### 3.3 Editar / Eliminar espacio
- **Editar**: Desde la lista de espacios, haga clic en el lápiz ✎.
- **Eliminar**: Solo si no tiene estaciones ni configuración AQI guardada. Botón 🗑 con confirmación.

---

## 4. Dashboard (Vista general)

Al entrar a un espacio, verá el **Dashboard** con:

| Tarjeta | Qué muestra |
|---------|-------------|
| **Estaciones online / total** | Conteo en tiempo real (verde = online, ámbar = sin señal >10 min) |
| **Última lectura AQI** | Índice general del espacio (si hay datos) |
| **Acceso rápido a AQI** | Botón "Configurar AQI y variables" |
| **Nueva estación** | Botón para dar de alta un dispositivo |
| **Lista de estaciones** | Tarjetas con nombre, label, coordenadas, variables asignadas, estado |

> El color de acento del espacio (definido al crearlo) tiñe botones, bordes y badges en toda la vista.

---

## 5. Estaciones (Dispositivos)

### 5.1 Crear una estación dentro del espacio
1. En el Dashboard del espacio, botón **"+ Nueva estación"**.
2. Complete el modal:
   - **Nombre de la estación** (ej. "Sensor Techo Planta 1")
   - **Label / Identificador** (se autogenera desde el nombre; editable)
   - **Ubicación (opcional)**: Latitud / Longitud — puede escribir coordenadas **o** usar el **mapa interactivo** (clic para colocar marcador, "Usar mi ubicación", arrastrar el pin).
   - **Variables a medir**: Seleccione de la lista (son las variables creadas en este espacio, ver §6). Use "Seleccionar todas" si corresponde.
3. **"Crear"**. La estación queda en estado **Pendiente** hasta que reporte su primera trama MQTT.

### 5.2 Editar variables de una estación
1. En la tarjeta de la estación, botón **✎ (lápiz)** "Editar variables".
2. Marque/desmarque variables del espacio.
3. **"Guardar"**. Los cambios aplican de inmediato.

### 5.3 Switch "Mostrar en mapa público" (solo espacios tipo Aire)
- En cada tarjeta de estación (espacios de tipo **Aire**), verá un interruptor: **"Mostrar en mapa público"**.
- **OFF (por defecto)**: La estación no sale en el mapa público `/mapa`.
- **ON**: La estación aparece en el mapa público con su AQI y coordenadas.
- Úselo solo cuando la estación esté instalada y operativa.

> **Regla:** Solo espacios de tipo **Aire** y no ocultos permiten este switch. En espacios de agua, suelo, etc., el switch no se muestra.

### 5.4 Ver detalle de una estación
- Haga clic en la tarjeta completa (o "Ver detalles").
- Verá: lecturas en tiempo real, gráficos históricos, AQI calculado con sus categorías y frases, variables, último reporte, coordenadas.

---

## 6. Configuración AQI del espacio

Es el corazón del índice de calidad. Tiene **3 pasos** que se guardan juntos.

### 6.1 Paso 1 — Categorías del índice
Define los **niveles** del AQI (ej. Bueno / Precaución / Malo).

| Campo | Descripción |
|-------|-------------|
| **Nombre** | Texto visible (ej. "Bueno", "Precaución", "Peligroso") |
| **Color** | Paleta preseleccionada o color personalizado (hex) |
| **Rango de score** | Se calcula automático al cambiar cantidad de categorías (0–100). El último nivel queda abierto (hasta 100). |
| **Frases de recomendación** | **Novedad:** una o varias frases por categoría. Se muestran al entrar a una estación cuando el AQI cae en ese nivel. Si pone varias, **rotan cada ~20 s** sin parpadear. |

**Acciones:**
- **"Agregar categoría"** (máx. 10).
- **Eliminar** (mínimo 1 categoría).
- Al cambiar la cantidad, los rangos de score se redistribuyen automáticamente.

### 6.2 Paso 2 — Variables del AQI
Variables que **participan en el cálculo** del índice, en orden de **prioridad** (la primera pesa más).

- **Crear variable nueva** (botón +):
  - **Nombre** (ej. "PM2.5", "Temperatura", "Humedad")
  - **Unidad**: chips predefinidos (µg/m³, ppm, °C, %, etc.) + campo editable para unidades propias.
  - El **label técnico** se genera automáticamente (minúsculas, sin tildes, guiones). Si renombra, el sistema **reutiliza** la variable existente en lugar de crear duplicados.
- **Reordenar**: arrastrar (arriba = mayor peso).
- **Eliminar**: solo si no tiene rangos en el Paso 3.

> **Unidades predefinidas:** °C, %, ppm, ppb, µg/m³, mg/m³, hPa, kPa, mm, km/h, m/s, kWh, W/m², dB, Lux.  
> **Chips navegables:** flechas ◀ ▶ para recorrer la lista.

### 6.3 Paso 3 — Límites por variable y categoría
Para **cada variable** (filas) y **cada categoría** (columnas, salvo la última que queda abierta), defina el **límite superior (max)**.

- La celda queda en **rojo** si:
  - Falta el valor (requerido en todas menos la última categoría).
  - El valor **no es estrictamente mayor** al de la categoría anterior (no se permiten iguales ni decrecientes).
- Mensaje de ayuda: *"Debe ser > X"* donde X es el max de la categoría anterior.
- El guardado **se bloquea** si hay celdas en rojo; muestra toast con el detalle.

### 6.4 Guardar configuración AQI
- Botón **"Guardar configuración"** (abajo del paso 3).
- Validaciones:
  - Al menos 1 categoría, 1 variable, y todos los max requeridos crecientes.
  - Toast verde: *"Configuración guardada correctamente."*
  - Toast rojo si hay error: detalle del problema.

> La configuración queda lista para que las estaciones del espacio calculen su AQI en tiempo real.

---

## 7. Mapa público

- URL: `/mapa` (accesible sin login).
- Muestra **solo**:
  - Estaciones de organizaciones **Tipo A (dependientes)** — siempre.
  - Estaciones de organizaciones **Tipo B** que tengan **switch ON** y estén en un espacio **tipo Aire** no oculto.
- Cada pin muestra: nombre, AQI actual, categoría, última actualización.
- Clic en pin → panel lateral con detalle y AQI.

---

## 8. Flujo típico de puesta en marcha

1. **Registrar organización** (Tipo B) y primer usuario admin.
2. **Crear espacio** tipo "Aire" (para mapa público) u otro tipo.
3. **Configurar AQI** del espacio (3 pasos).
4. **Crear estaciones** en el espacio, asignar variables, opcionalmente ubicarlas en el mapa.
5. **Activar switch "Mapa público"** en estaciones operativas (solo espacios Aire).
6. **Verificar** en Dashboard y en `/mapa` que todo aparece correctamente.

---

## 9. Preguntas frecuentes (FAQ)

| Pregunta | Respuesta |
|----------|-----------|
| **¿Puedo tener varios espacios?** | Sí, tantos como necesite (aire, agua, ruido...). |
| **¿Las variables se comparten entre espacios?** | No. Cada espacio tiene su catálogo propio (aislado). |
| **¿Qué pasa si renombro una variable?** | El sistema detecta el cambio y **actualiza la variable existente** (no crea duplicado). |
| **¿Puedo borrar una categoría si ya tiene límites?** | Primero borre los límites en el Paso 3, luego elimine la categoría. |
| **¿Las frases rotan en el mapa público?** | No, en el mapa público solo se ve la categoría y color. Las frases aparecen en el detalle de la estación. |
| **¿Cómo invito a otro usuario a mi organización?** | Configuración → Usuarios → "Invitar usuario" (recibe correo con enlace). |
| **¿Puedo cambiar el tipo de espacio después de crearlo?** | Sí, editando el espacio. Ojo: si cambia de "Aire" a otro, el switch de mapa público desaparece. |

---

## 10. Soporte y contacto

- **Documentación técnica / API**: `/docs` (dentro de la app).
- **Reportar incidencia**: Botón "Ayuda" → "Reportar problema" (abre formulario con logs).
- **Correo soporte**: `soporte@sanik.io`
- **Horario**: Lunes a viernes 9:00–18:00 (GMT-6).

---

## Anexo: Glosario rápido

| Término | Significado |
|---------|-------------|
| **AQI** | Air Quality Index — Índice de calidad del aire (0–100). |
| **Label** | Identificador técnico único (slug) de variable o estación. |
| **Space / Espacio** | Contenedor lógico de variables, AQI y estaciones. |
| **Dot / Trama** | Un paquete de datos MQTT enviado por la estación (variable + valor + timestamp). |
| **Org Tipo A / B** | Dependiente (Sanik) / Independiente (cliente). |
| **Mapa público** | Vista abierta `/mapa` con estaciones visibles según reglas. |

---

*Fin del manual — Organización Independiente (Tipo B)*