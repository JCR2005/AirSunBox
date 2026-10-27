# Documentación de AirSunBox

| Documento | Fuente | Entregable |
|---|---|---|
| Manual técnico: arquitectura, modelo de datos, seguridad, trazabilidad | [manual-tecnico.md](manual-tecnico.md) | [ODT](entregables/Manual_Tecnico_AirSunBox.odt) · [PDF](entregables/Manual_Tecnico_AirSunBox.pdf) |
| Guía de despliegue y Runbook: despliegue, rollback, monitoreo, incidentes | [runbook.md](runbook.md) | [ODT](entregables/Runbook_AirSunBox.odt) · [PDF](entregables/Runbook_AirSunBox.pdf) |
| Manual de usuario (organizaciones independientes) | [../MANUAL_INDEPENDIENTES.md](../MANUAL_INDEPENDIENTES.md) | [PDF](../MANUAL_INDEPENDIENTES.pdf) |
| Seguridad de producción: secretos y cifrado | [../infra/seguridad/README.md](../infra/seguridad/README.md) | — |

Los diagramas están en [`diagramas/`](diagramas) como código Graphviz (`.dot`).
`modelo-datos.dot` se generó desde la base con todas las migraciones aplicadas.

## Formato

Los entregables usan el **formato oficial de AirSunBox**: la plantilla
[`plantilla/plantilla-oficial.odt`](plantilla/plantilla-oficial.odt) aporta
la página Carta, el encabezado con el logo, la portada, las fuentes
(Tlwg Typist / Tlwg Typo) y los colores; los diagramas siguen el estilo de los
diagramas oficiales.

## Regenerar los entregables

Requiere `python3-markdown`, Graphviz y LibreOffice con `python3-uno` (actualiza
el índice y exporta el PDF):

```bash
python3 docs/build.py
```
