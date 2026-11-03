# Documentación de AirSunBox

| Documento | Fuente | PDF |
|---|---|---|
| Manual técnico: arquitectura, modelo de datos, API, seguridad, CI/CD y trazabilidad | [manual-tecnico.md](manual-tecnico.md) | [PDF](entregables/fase-3/Manual_Tecnico_AirSunBox.pdf) |
| Manual de usuario: clientes, equipo interno y ciudadanía | [manual-usuario.md](manual-usuario.md) | [PDF](entregables/fase-3/Manual_Usuario_AirSunBox.pdf) |
| Guía de despliegue y Runbook: despliegue, rollback, monitoreo e incidentes | [runbook.md](runbook.md) | [PDF](entregables/fase-3/Runbook_AirSunBox.pdf) |
| Escalabilidad futura: procesos BPMN, migraciones planificadas y microservicios | [escalabilidad.md](escalabilidad.md) | [PDF](entregables/fase-3/Escalabilidad_Futura_AirSunBox.pdf) |
| Casos de uso extendidos | [casos-de-uso.txt](casos-de-uso.txt) | — |
| Seguridad de producción: secretos y cifrado | [../infra/seguridad/README.md](../infra/seguridad/README.md) | — |

## Contenido de la carpeta

| Carpeta | Qué tiene |
|---|---|
| `diagramas/` | Arquitectura, flujo de datos, modelo de datos y CI/CD (código Graphviz `.dot` y su `.png`), la arquitectura de microservicios (`.svg`) y los procesos BPMN (`bpmn/`) |
| `capturas/` | Capturas de pantalla usadas por el manual de usuario |
| `entregables/fase-1/` | Entregas de análisis y diseño: fundamentos, problema y alcance, requisitos, análisis económico, riesgos, procesos de negocio, arquitecturas, mockups, GitFlow, y sus diagramas BPMN, de arquitectura y mockups en PNG |
| `entregables/fase-2/` | Documentación técnica y de usuario de la fase 2, planilla de casos de uso y las fuentes de sus diagramas (PlantUML, draw.io, SQL) |
| `entregables/fase-3/` | Los documentos actuales en PDF con el formato oficial |
| `plantilla/` | Plantillas oficiales en ODT (vertical y horizontal) |

`diagramas/modelo-datos.dot` se generó desde la base con todas las
migraciones aplicadas.

## Regenerar los entregables

Los documentos usan el **formato oficial de AirSunBox**: la plantilla
[`plantilla/plantilla-oficial.odt`](plantilla/plantilla-oficial.odt) aporta la
página Carta, el encabezado con el logo, la portada, las fuentes (Tlwg Typist /
Tlwg Typo) y los colores; los procesos BPMN usan la plantilla horizontal
`plantilla-procesos.odt`.

Requiere `python3-markdown`, Graphviz y LibreOffice con `python3-uno`, que
actualiza el índice y exporta el PDF:

```bash
python3 docs/build.py                   # todos
python3 docs/build.py manual-usuario.md # uno solo
```

Genera el `.odt` y el `.pdf` en `entregables/fase-3/`; los `.odt` no se versionan.
