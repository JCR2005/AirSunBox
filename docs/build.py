#!/usr/bin/env python3
"""Genera los entregables (.odt y .pdf) a partir de los .md de docs/.

    python3 docs/build.py

Requisitos: python3-markdown, Graphviz (dot) y LibreOffice (soffice).
Los diagramas .dot se renderizan a PNG y se embeben en el documento.
"""
import base64
import re
import shutil
import struct
import subprocess
import sys
import tempfile
from pathlib import Path

import markdown

DOCS = Path(__file__).resolve().parent
OUT = DOCS / "entregables"
DOCUMENTOS = {
    "manual-tecnico.md": "Manual_Tecnico_AirSunBox",
    "runbook.md": "Runbook_AirSunBox",
}
ANCHO_IMAGEN = 640  # px en el HTML ≈ ancho útil de una página A4

CSS = """
body { font-family: 'DejaVu Sans', 'Liberation Sans', sans-serif; font-size: 10pt; color: #1F2933; }
h1, h2, h3 { font-family: 'DejaVu Sans', 'Liberation Sans', sans-serif; }
h1 { font-size: 17pt; color: #1F5F8B; border-bottom: 2px solid #67B7E8; padding-bottom: 4pt; margin-top: 18pt; }
h2 { font-size: 13pt; color: #2A7BB0; margin-top: 14pt; }
h3 { font-size: 11pt; color: #2A7BB0; }
p, li { line-height: 1.35; }
code { font-family: 'DejaVu Sans Mono', monospace; font-size: 8.5pt; color: #8A3B12; }
pre { font-family: 'DejaVu Sans Mono', monospace; font-size: 8pt; background: #F4F7FA; border: 1px solid #D5DEE7; padding: 6pt; }
table { border-collapse: collapse; width: 100%; font-size: 8.5pt; }
th { color: #FFFFFF; text-align: left; }
td, th { padding: 3pt; vertical-align: top; }
.toc ul { list-style: none; }
"""


def png_size(data: bytes):
    # Ancho y alto del encabezado IHDR del PNG
    w, h = struct.unpack(">II", data[16:24])
    return w, h


def render_diagramas():
    for dot in sorted((DOCS / "diagramas").glob("*.dot")):
        png = dot.with_suffix(".png")
        subprocess.run(["dot", "-Tpng", "-Gdpi=170", str(dot), "-o", str(png)], check=True)


def portada(meta: dict) -> str:
    return f"""
<p style="margin-top: 120pt" align="center"><font size="6" color="#1F5F8B"><b>{meta.get('titulo', '')}</b></font></p>
<p align="center"><font size="4" color="#2A7BB0">{meta.get('subtitulo', '')}</font></p>
<p align="center" style="margin-top: 60pt"><b>AirSunBox</b></p>
<p align="center">{meta.get('institucion', '')}</p>
<p align="center">{meta.get('curso', '')}</p>
<p align="center">Equipo: {meta.get('equipo', '')}</p>
<p align="center">Versión {meta.get('version', '')}</p>
<h1 style="page-break-before: always; border: none; display: none"></h1>
"""


def a_html(md_path: Path) -> str:
    texto = md_path.read_text(encoding="utf-8")
    meta = {}
    m = re.match(r"^---\n(.*?)\n---\n", texto, re.S)
    if m:
        for linea in m.group(1).splitlines():
            k, _, v = linea.partition(":")
            meta[k.strip()] = v.strip()
        texto = texto[m.end():]

    cuerpo = markdown.markdown(
        texto,
        extensions=["tables", "fenced_code", "toc", "sane_lists"],
        extension_configs={"toc": {"title": "Contenido", "toc_depth": "1-2"}},
    )

    # Imágenes embebidas (data URI) con tamaño proporcional al ancho de página
    def embeber(match):
        src, alt = match.group("src"), match.group("alt")
        data = (DOCS / src).read_bytes()
        w, h = png_size(data)
        ancho = min(ANCHO_IMAGEN, w)
        alto = round(h * ancho / w)
        b64 = base64.b64encode(data).decode()
        return (f'<p align="center"><img src="data:image/png;base64,{b64}" alt="{alt}" '
                f'width="{ancho}" height="{alto}"></p><p align="center"><i><font size="2">{alt}</font></i></p>')

    cuerpo = re.sub(r'<p><img alt="(?P<alt>[^"]*)" src="(?P<src>[^"]+)"\s*/?></p>', embeber, cuerpo)

    # Tablas con bordes y encabezado de color (atributos que LibreOffice respeta)
    cuerpo = cuerpo.replace("<table>", '<table border="1" cellpadding="4" cellspacing="0" bordercolor="#C9D6E2" width="100%">')
    cuerpo = cuerpo.replace("<th>", '<th bgcolor="#2A7BB0">').replace('<th style="text-align: left;">', '<th bgcolor="#2A7BB0">')

    # Aire después de cada tabla (LibreOffice ignora el margin de las tablas)
    cuerpo = cuerpo.replace("</table>", "</table><p style=\"font-size: 4pt\">&nbsp;</p>")
    # Títulos en sans-serif: LibreOffice usa su estilo de encabezado (serif) si no se indica la fuente
    cuerpo = re.sub(r"<(h[1-3])([^>]*)>(.*?)</\1>", r'<\1\2><font face="DejaVu Sans">\3</font></\1>', cuerpo)

    # Cada sección de primer nivel empieza en página nueva
    cuerpo = re.sub(r"<h1 ", '<h1 style="page-break-before: always" ', cuerpo)

    return f"""<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><title>{meta.get('titulo', md_path.stem)} — AirSunBox</title>
<style>{CSS}</style></head>
<body>{portada(meta)}{cuerpo}</body></html>"""


def convertir(html: str, nombre: str):
    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        src = tmp / f"{nombre}.html"
        src.write_text(html, encoding="utf-8")
        subprocess.run(["soffice", "--headless", "--infilter=HTML (StarWriter)",
                        "--convert-to", "odt:writer8", str(src), "--outdir", str(tmp)],
                       check=True, capture_output=True)
        odt = tmp / f"{nombre}.odt"
        subprocess.run(["soffice", "--headless", "--convert-to", "pdf:writer_pdf_Export",
                        str(odt), "--outdir", str(tmp)], check=True, capture_output=True)
        OUT.mkdir(exist_ok=True)
        for ext in ("odt", "pdf"):
            shutil.copy(tmp / f"{nombre}.{ext}", OUT / f"{nombre}.{ext}")
            print(f"  {OUT.relative_to(DOCS.parent) / f'{nombre}.{ext}'}")


def main():
    for herramienta in ("dot", "soffice"):
        if not shutil.which(herramienta):
            sys.exit(f"Falta {herramienta}")
    render_diagramas()
    for md, nombre in DOCUMENTOS.items():
        print(md)
        convertir(a_html(DOCS / md), nombre)


if __name__ == "__main__":
    main()
