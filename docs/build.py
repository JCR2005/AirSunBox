#!/usr/bin/env python3
"""Genera los entregables (.odt y .pdf) con el formato oficial de AirSunBox.

    python3 docs/build.py

Toma como plantilla `plantilla/plantilla-oficial.odt` (documento oficial del
equipo): conserva su página Carta, encabezado con logo, fuentes Tlwg Typist /
Tlwg Typo, colores y portada, y rellena el cuerpo con el contenido de los .md
usando los mismos estilos. LibreOffice actualiza el índice y exporta el PDF.

Requisitos: python3-markdown, Graphviz (dot) y LibreOffice con python3-uno.
"""
import random
import re
import shutil
import struct
import subprocess
import sys
import tempfile
import time
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path
from xml.sax.saxutils import escape

import markdown

DOCS = Path(__file__).resolve().parent
OUT = DOCS / "entregables" / "fase-3"
FECHA = "Martes, 27 de octubre, 2026"
FASE = "Fase 3"
VERTICAL = dict(plantilla="plantilla-oficial.odt", titulo_plantilla="iniciales",
                ancho=17.59, alto=19.0, salto_h2=False, salto_figura=False)
HORIZONTAL = dict(plantilla="plantilla-procesos.odt", titulo_plantilla="Procesos de Negocio",
                  ancho=23.94, alto=13.0, salto_h2=r"^PRO-\d+", salto_figura=True)
DOCUMENTOS = {
    "manual-tecnico.md": ("Manual_Tecnico_AirSunBox", "Manual técnico", VERTICAL),
    "runbook.md": ("Runbook_AirSunBox", "Guía de despliegue y Runbook", VERTICAL),
    "manual-usuario.md": ("Manual_Usuario_AirSunBox", "Manual de usuario", VERTICAL),
    "escalabilidad.md": ("Escalabilidad_Futura_AirSunBox", "Documentación para escalabilidad futura", HORIZONTAL),
}
ANCHO_UTIL_CM = 17.59        # se ajusta por documento (Carta vertical u horizontal)
ALTO_MAX_IMAGEN_CM = 19.0
AZUL, CELESTE, GRIS = "#2a6099", "#729fcf", "#808080"

# Estilos del cuerpo: los mismos valores que usan los documentos oficiales
# (títulos centrados azules en Tlwg Typo, subtítulos azules, texto justificado
# en Tlwg Typo, etiquetas de viñeta celestes en Tlwg Typist, leyendas grises).
ESTILOS = f"""
<style:style style:name="XH1" style:family="paragraph" style:parent-style-name="Text_20_body">
  <style:paragraph-properties fo:text-align="center" fo:break-before="page" fo:margin-top="0.4cm" fo:margin-bottom="0.5cm" fo:keep-with-next="always"/>
  <style:text-properties fo:color="{AZUL}" style:font-name="Tlwg Typo" fo:font-size="18pt" fo:font-weight="bold"/></style:style>
<style:style style:name="XH2" style:family="paragraph" style:parent-style-name="Text_20_body">
  <style:paragraph-properties fo:margin-top="0.55cm" fo:margin-bottom="0.25cm" fo:keep-with-next="always"/>
  <style:text-properties fo:color="{AZUL}" style:font-name="Tlwg Typo" fo:font-size="14pt" fo:font-weight="bold"/></style:style>
<style:style style:name="XH3" style:family="paragraph" style:parent-style-name="Text_20_body">
  <style:paragraph-properties fo:margin-top="0.45cm" fo:margin-bottom="0.2cm" fo:keep-with-next="always"/>
  <style:text-properties fo:color="{AZUL}" style:font-name="Tlwg Typist" fo:font-size="12pt" fo:font-style="italic" fo:font-weight="bold"/></style:style>
<style:style style:name="XH4" style:family="paragraph" style:parent-style-name="Text_20_body">
  <style:paragraph-properties fo:margin-top="0.25cm" fo:margin-bottom="0.1cm" fo:keep-with-next="always"/>
  <style:text-properties fo:color="{CELESTE}" style:font-name="Tlwg Typo" fo:font-size="12pt" fo:font-weight="bold"/></style:style>
<style:style style:name="XH2B" style:family="paragraph" style:parent-style-name="Text_20_body">
  <style:paragraph-properties fo:break-before="page" fo:margin-top="0.2cm" fo:margin-bottom="0.25cm" fo:keep-with-next="always"/>
  <style:text-properties fo:color="{AZUL}" style:font-name="Tlwg Typo" fo:font-size="14pt" fo:font-weight="bold"/></style:style>
<style:style style:name="XFIGB" style:family="paragraph" style:parent-style-name="Standard">
  <style:paragraph-properties fo:text-align="center" fo:break-before="page" fo:margin-top="0.6cm" fo:margin-bottom="0.2cm" fo:keep-with-next="always"/></style:style>
<style:style style:name="XP" style:family="paragraph" style:parent-style-name="Text_20_body">
  <style:paragraph-properties fo:text-align="justify" fo:text-indent="1.25cm" fo:margin-top="0.1cm" fo:margin-bottom="0.25cm"/>
  <style:text-properties style:font-name="Tlwg Typo" fo:font-size="11pt"/></style:style>
<style:style style:name="XLP" style:family="paragraph" style:parent-style-name="Text_20_body">
  <style:paragraph-properties fo:text-align="start" fo:margin-top="0cm" fo:margin-bottom="0.06cm"/>
  <style:text-properties style:font-name="Tlwg Typo" fo:font-size="11pt"/></style:style>
<style:style style:name="XPRE" style:family="paragraph" style:parent-style-name="Standard">
  <style:paragraph-properties fo:margin-left="0.4cm" fo:margin-top="0.1cm" fo:margin-bottom="0.3cm" fo:background-color="#f2f5f9" fo:padding="0.15cm" fo:border="0.5pt solid #b4c7dc"/>
  <style:text-properties style:font-name="Tlwg Typo" fo:font-size="8.5pt" fo:color="#1f3b57"/></style:style>
<style:style style:name="XFIG" style:family="paragraph" style:parent-style-name="Standard">
  <style:paragraph-properties fo:text-align="center" fo:margin-top="0.2cm" fo:margin-bottom="0.1cm" fo:keep-with-next="always"/></style:style>
<style:style style:name="XCAP" style:family="paragraph" style:parent-style-name="Standard">
  <style:paragraph-properties fo:text-align="start" fo:margin-bottom="0.4cm"/>
  <style:text-properties fo:color="{GRIS}" style:font-name="Tlwg Typist" fo:font-size="11pt" fo:font-style="italic" fo:font-weight="bold"/></style:style>
<style:style style:name="XTOCT" style:family="paragraph" style:parent-style-name="Text_20_body">
  <style:paragraph-properties fo:text-align="center" fo:break-before="page" fo:margin-bottom="0.5cm"/>
  <style:text-properties fo:color="{AZUL}" style:font-name="Tlwg Typist" fo:font-size="18pt" fo:font-style="italic" fo:font-weight="bold"/></style:style>
<style:style style:name="XTHP" style:family="paragraph" style:parent-style-name="Standard">
  <style:text-properties fo:color="#ffffff" style:font-name="Tlwg Typist" fo:font-size="9pt" fo:font-weight="bold"/></style:style>
<style:style style:name="XTDP" style:family="paragraph" style:parent-style-name="Standard">
  <style:text-properties style:font-name="Tlwg Typo" fo:font-size="8.5pt"/></style:style>
<style:style style:name="XTH" style:family="table-cell">
  <style:table-cell-properties fo:background-color="{AZUL}" fo:padding="0.1cm" fo:border="0.5pt solid #6c8ebf"/></style:style>
<style:style style:name="XTR" style:family="table-row">
  <style:table-row-properties fo:keep-together="always"/></style:style>
<style:style style:name="XTD" style:family="table-cell">
  <style:table-cell-properties fo:padding="0.1cm" fo:border="0.5pt solid #6c8ebf"/></style:style>
<style:style style:name="XTDA" style:family="table-cell">
  <style:table-cell-properties fo:background-color="#eef3fa" fo:padding="0.1cm" fo:border="0.5pt solid #6c8ebf"/></style:style>
<style:style style:name="XLAB" style:family="text">
  <style:text-properties fo:color="{CELESTE}" style:font-name="Tlwg Typist" fo:font-weight="bold"/></style:style>
<style:style style:name="XB" style:family="text"><style:text-properties fo:font-weight="bold"/></style:style>
<style:style style:name="XI" style:family="text"><style:text-properties fo:font-style="italic"/></style:style>
<style:style style:name="XC" style:family="text">
  <style:text-properties style:font-name="Tlwg Typo" fo:color="#1f3b57" fo:background-color="#eef3fa"/></style:style>
<style:style style:name="XG" style:family="graphic" style:parent-style-name="Graphics">
  <style:graphic-properties style:vertical-pos="top" style:vertical-rel="baseline" fo:border="none" style:mirror="none"/></style:style>
<style:style style:name="XSECT" style:family="section"><style:section-properties style:editable="false"/></style:style>
<text:list-style style:name="XLB">
  <text:list-level-style-bullet text:level="1" text:bullet-char="•"><style:list-level-properties text:space-before="0.75cm" text:min-label-width="0.5cm"/><style:text-properties fo:color="{AZUL}"/></text:list-level-style-bullet>
  <text:list-level-style-bullet text:level="2" text:bullet-char="◦"><style:list-level-properties text:space-before="1.6cm" text:min-label-width="0.5cm"/></text:list-level-style-bullet>
  <text:list-level-style-bullet text:level="3" text:bullet-char="▪"><style:list-level-properties text:space-before="2.4cm" text:min-label-width="0.5cm"/></text:list-level-style-bullet>
</text:list-style>
<text:list-style style:name="XLN">
  <text:list-level-style-number text:level="1" style:num-suffix="." style:num-format="1"><style:list-level-properties text:space-before="0.6cm" text:min-label-width="0.65cm"/><style:text-properties fo:color="{AZUL}" fo:font-weight="bold"/></text:list-level-style-number>
  <text:list-level-style-number text:level="2" style:num-suffix="." style:num-format="1"><style:list-level-properties text:space-before="1.6cm" text:min-label-width="0.65cm"/></text:list-level-style-number>
  <text:list-level-style-number text:level="3" style:num-suffix=")" style:num-format="a"><style:list-level-properties text:space-before="2.4cm" text:min-label-width="0.65cm"/></text:list-level-style-number>
</text:list-style>
"""

ESTILOS_INDICE_PLANTILLA = """
<style:style style:name="Contents_20_Heading" style:display-name="Contents Heading" style:family="paragraph" style:parent-style-name="Standard" style:class="index">
  <style:paragraph-properties fo:text-align="center" fo:break-before="page" fo:margin-bottom="0.5cm"/>
  <style:text-properties fo:color="#2a6099" style:font-name="Tlwg Typist" fo:font-size="18pt" fo:font-style="italic" fo:font-weight="bold"/></style:style>
<style:style style:name="Contents_20_1" style:display-name="Contents 1" style:family="paragraph" style:parent-style-name="Standard" style:class="index">
  <style:paragraph-properties fo:margin-top="0.15cm" fo:margin-bottom="0.05cm"><style:tab-stops><style:tab-stop style:position="{TAB1}" style:type="right" style:leader-style="dotted" style:leader-text="."/></style:tab-stops></style:paragraph-properties>
  <style:text-properties fo:color="#2a6099" style:font-name="Tlwg Typo" fo:font-size="11pt" fo:font-weight="bold"/></style:style>
<style:style style:name="Contents_20_2" style:display-name="Contents 2" style:family="paragraph" style:parent-style-name="Standard" style:class="index">
  <style:paragraph-properties fo:margin-left="0.6cm"><style:tab-stops><style:tab-stop style:position="{TAB2}" style:type="right" style:leader-style="dotted" style:leader-text="."/></style:tab-stops></style:paragraph-properties>
  <style:text-properties style:font-name="Tlwg Typo" fo:font-size="10pt"/></style:style>
"""


def x(texto: str) -> str:
    return escape(texto, {'"': "&quot;"})


class Conversor:
    """Convierte el HTML que produce python-markdown a XML de OpenDocument."""

    def __init__(self, salto_h2=False, salto_figura=False):
        self.salto_h2, self.salto_figura = salto_h2, salto_figura
        self.tablas = []      # estilos automáticos de cada tabla
        self.imagenes = []    # (ruta en el .odt, archivo de origen)

    # ── texto en línea ──
    def inline(self, el, texto_inicial=True, preservar=False):
        partes = []
        if texto_inicial and el.text:
            partes.append(self.texto(el.text, preservar))
        for hijo in el:
            partes.append(self.elemento_inline(hijo, preservar))
            if hijo.tail:
                partes.append(self.texto(hijo.tail, preservar))
        return "".join(partes)

    def texto(self, t, preservar=False):
        if preservar:
            return self.espacios(t)
        return x(re.sub(r"\s+", " ", t))

    @staticmethod
    def espacios(t):
        out = []
        for i, linea in enumerate(t.split("\n")):
            if i:
                out.append("<text:line-break/>")
            for m in re.finditer(r"( {2,})|([^ ]+| )", linea):
                if m.group(1):
                    out.append(f' <text:s text:c="{len(m.group(1)) - 1}"/>')
                else:
                    out.append(x(m.group(2)))
        return "".join(out)

    def elemento_inline(self, el, preservar=False):
        contenido = self.inline(el, preservar=preservar)
        if el.tag == "strong":
            return f'<text:span text:style-name="XB">{contenido}</text:span>'
        if el.tag == "em":
            return f'<text:span text:style-name="XI">{contenido}</text:span>'
        if el.tag == "code":
            return f'<text:span text:style-name="XC">{self.espacios(el.text or "")}</text:span>'
        if el.tag == "a":
            href = el.get("href", "")
            if href.startswith("http"):
                return f'<text:a xlink:type="simple" xlink:href="{x(href)}">{contenido}</text:a>'
            return contenido
        if el.tag == "br":
            return "<text:line-break/>"
        return contenido

    def con_etiqueta(self, el):
        """Ítem que empieza con **Etiqueta:** → etiqueta celeste, como en los documentos oficiales."""
        hijos = list(el)
        if hijos and hijos[0].tag == "strong" and not (el.text or "").strip():
            etiqueta = "".join(hijos[0].itertext())
            if etiqueta.rstrip().endswith(":"):
                resto = self.texto(hijos[0].tail or "")
                for h in hijos[1:]:
                    resto += self.elemento_inline(h) + (self.texto(h.tail) if h.tail else "")
                return f'<text:span text:style-name="XLAB">{x(etiqueta)}</text:span>{resto}'
        return None

    # ── bloques ──
    def bloques(self, contenedor):
        out = []
        for el in contenedor:
            out.append(self.bloque(el))
        return "".join(out)

    def bloque(self, el):
        t = el.tag
        if t in ("h1", "h2", "h3"):
            nivel = int(t[1])
            texto_h = "".join(el.itertext()).strip()
            salto = nivel == 2 and self.salto_h2 and re.match(self.salto_h2, texto_h)
            estilo = "XH2B" if salto else f"XH{nivel}"
            return (f'<text:h text:style-name="{estilo}" text:outline-level="{nivel}">'
                    f'{self.inline(el)}</text:h>')
        if t == "h4":
            return f'<text:p text:style-name="XH4">{self.inline(el)}</text:p>'
        if t == "p":
            hijos = list(el)
            if len(hijos) == 1 and hijos[0].tag == "img" and not (el.text or "").strip():
                return self.figura(hijos[0])
            return f'<text:p text:style-name="XP">{self.inline(el)}</text:p>'
        if t in ("ul", "ol"):
            return self.lista(el)
        if t == "pre":
            codigo = el.find("code")
            texto = (codigo.text if codigo is not None else el.text) or ""
            return f'<text:p text:style-name="XPRE">{self.espacios(texto.rstrip())}</text:p>'
        if t == "table":
            return self.tabla(el)
        return f'<text:p text:style-name="XP">{self.inline(el)}</text:p>'

    def lista(self, el, nivel=1):
        estilo = "XLN" if el.tag == "ol" else "XLB"
        items = []
        for li in el.findall("li"):
            items.append(f"<text:list-item>{self.item(li, nivel)}</text:list-item>")
        return f'<text:list text:style-name="{estilo}">{"".join(items)}</text:list>'

    def item(self, li, nivel):
        out, actual = [], []
        texto_ini = li.text or ""

        def cerrar():
            if actual or texto_ini.strip():
                pass

        # Contenido en línea hasta el primer bloque anidado
        en_linea = ET.Element("li")
        en_linea.text = texto_ini
        bloques = []
        for hijo in li:
            if hijo.tag in ("ul", "ol", "p", "pre", "table"):
                bloques.append(hijo)
            elif bloques:
                bloques.append(hijo)
            else:
                en_linea.append(hijo)
        if (en_linea.text or "").strip() or len(en_linea):
            contenido = self.con_etiqueta(en_linea) or self.inline(en_linea)
            out.append(f'<text:p text:style-name="XLP">{contenido.strip()}</text:p>')
        for b in bloques:
            if b.tag in ("ul", "ol"):
                out.append(self.lista(b, nivel + 1))
            elif b.tag == "p":
                contenido = self.con_etiqueta(b) or self.inline(b)
                out.append(f'<text:p text:style-name="XLP">{contenido}</text:p>')
            else:
                out.append(self.bloque(b))
        if not out:
            out.append('<text:p text:style-name="XLP"/>')
        return "".join(out)

    def tabla(self, el):
        n = len(self.tablas) + 1
        filas = el.findall(".//tr")
        ncol = max(len(f.findall("th") + f.findall("td")) for f in filas)
        # Ancho mínimo: la palabra más larga de la columna (sin cortarla);
        # el resto del ancho se reparte según el largo medio del contenido.
        CM_POR_CARACTER = 0.19
        minimo = [1.2] * ncol
        peso = [1.0] * ncol
        for f in filas:
            for i, c in enumerate(f.findall("th") + f.findall("td")):
                texto = " ".join("".join(c.itertext()).split())
                palabra = max((len(w) for w in texto.split(" ")), default=0)
                minimo[i] = max(minimo[i], min(palabra * CM_POR_CARACTER + 0.35, 5.5))
                peso[i] += min(len(texto), 90)
        if sum(minimo) > ANCHO_UTIL_CM:
            minimo = [m * ANCHO_UTIL_CM / sum(minimo) for m in minimo]
        libre = ANCHO_UTIL_CM - sum(minimo)
        anchos = [m + libre * w / sum(peso) for m, w in zip(minimo, peso)]
        estilos = [f'<style:style style:name="XT{n}" style:family="table"><style:table-properties '
                   f'style:width="{ANCHO_UTIL_CM}cm" table:align="margins" fo:margin-top="0.15cm" fo:margin-bottom="0.35cm"/></style:style>']
        for i, a in enumerate(anchos):
            estilos.append(f'<style:style style:name="XT{n}.C{i}" style:family="table-column">'
                           f'<style:table-column-properties style:column-width="{a:.3f}cm"/></style:style>')
        self.tablas.append("".join(estilos))
        out = [f'<table:table table:name="Tabla{n}" table:style-name="XT{n}">']
        out += [f'<table:table-column table:style-name="XT{n}.C{i}"/>' for i in range(ncol)]
        for k, f in enumerate(filas):
            celdas = f.findall("th") + f.findall("td")
            encabezado = bool(f.findall("th"))
            if encabezado:
                out.append("<table:table-header-rows>")
            out.append('<table:table-row table:style-name="XTR">')
            for c in celdas:
                estilo = "XTH" if encabezado else ("XTDA" if k % 2 == 0 else "XTD")
                pstyle = "XTHP" if encabezado else "XTDP"
                out.append(f'<table:table-cell table:style-name="{estilo}" office:value-type="string">'
                           f'<text:p text:style-name="{pstyle}">{self.inline(c)}</text:p></table:table-cell>')
            for _ in range(ncol - len(celdas)):
                out.append('<table:table-cell table:style-name="XTD"><text:p text:style-name="XTDP"/></table:table-cell>')
            out.append("</table:table-row>")
            if encabezado:
                out.append("</table:table-header-rows>")
        out.append("</table:table>")
        return "".join(out)

    def figura(self, img):
        src, alt = img.get("src"), img.get("alt", "")
        origen = DOCS / src
        if origen.suffix == ".svg":
            cab = origen.read_text(encoding="utf-8")[:400]
            w = float(re.search(r'width="([\d.]+)"', cab).group(1))
            h = float(re.search(r'height="([\d.]+)"', cab).group(1))
            mime = "image/svg+xml"
        else:
            w, h = struct.unpack(">II", origen.read_bytes()[16:24])
            mime = "image/png"
        ancho = ANCHO_UTIL_CM
        alto = h * ancho / w
        if alto > ALTO_MAX_IMAGEN_CM:
            alto = ALTO_MAX_IMAGEN_CM
            ancho = w * alto / h
        destino = f"Pictures/airsunbox-{origen.stem}{origen.suffix}"
        self.imagenes.append((destino, origen, mime))
        n = len(self.imagenes)
        estilo = "XFIGB" if self.salto_figura else "XFIG"
        return (f'<text:p text:style-name="{estilo}"><draw:frame draw:style-name="XG" draw:name="Figura{n}" '
                f'text:anchor-type="as-char" svg:width="{ancho:.3f}cm" svg:height="{alto:.3f}cm" draw:z-index="{n}">'
                f'<draw:image xlink:href="{destino}" xlink:type="simple" xlink:show="embed" xlink:actuate="onLoad" '
                f'draw:mime-type="{mime}"/></draw:frame></text:p>'
                f'<text:p text:style-name="XCAP">Figura {n}. {x(alt)}</text:p>')


def indice():
    plantilla_entrada = (
        '<text:index-entry-link-start/><text:index-entry-text/>'
        '<text:index-entry-tab-stop style:type="right" style:leader-char="."/>'
        '<text:index-entry-page-number/><text:index-entry-link-end/>')
    return (
        '<text:table-of-content text:style-name="XSECT" text:protected="true" text:name="Índice">'
        '<text:table-of-content-source text:outline-level="2" text:use-index-marks="false">'
        '<text:index-title-template text:style-name="Contents_20_Heading">Índice</text:index-title-template>'
        f'<text:table-of-content-entry-template text:outline-level="1" text:style-name="Contents_20_1">{plantilla_entrada}</text:table-of-content-entry-template>'
        f'<text:table-of-content-entry-template text:outline-level="2" text:style-name="Contents_20_2">{plantilla_entrada}</text:table-of-content-entry-template>'
        '</text:table-of-content-source><text:index-body>'
        '<text:index-title text:style-name="XSECT" text:name="Índice_Head"><text:p text:style-name="Contents_20_Heading">Índice</text:p></text:index-title>'
        '<text:p text:style-name="Contents_20_1">Índice</text:p>'
        '</text:index-body></text:table-of-content>')


def portada(content_xml: str, titulo: str, titulo_plantilla: str) -> str:
    """Portada oficial de la plantilla con el título y la fecha de este documento."""
    ini = content_xml.index("<text:p", content_xml.index("<office:text"))
    fin = content_xml.index("</text:p>", content_xml.index("Quetzaltenango")) + len("</text:p>")
    cov = content_xml[ini:fin]
    cov = re.sub(r'(<text:p text:style-name="P2">)(?:(?!</text:p>).)*' + re.escape(titulo_plantilla) + r'.*?(</text:p>)',
                 r"\g<1>" + x(titulo) + r"\g<2>", cov, count=1, flags=re.S)
    if titulo_plantilla in cov:
        sys.exit("No se pudo reemplazar el título de la portada de la plantilla")
    if len(titulo) > 28:
        raya = cov.index("_____")
        inicio_raya = cov.rindex("<text:p", 0, raya)
        previo = cov[:inicio_raya]
        for _ in range(3):
            m = list(re.finditer(r'<text:p text:style-name="P\d+"/>', previo))
            if m:
                previo = previo[:m[-1].start()] + previo[m[-1].end():]
        cov = previo + cov[inicio_raya:]
    fecha_vieja = "Martes, 18 de agosto, 2026"
    def nueva_fecha(m):
        espacios = int(m.group(1)) - (len(FECHA) - len(fecha_vieja))
        return f'<text:s text:c="{espacios}"/></text:span>{FECHA}'
    cov = re.sub(r'<text:s text:c="(\d+)"/></text:span>Martes, 1<text:span text:style-name="T\d+">8</text:span> de agosto, 2026',
                 nueva_fecha, cov)
    if FECHA not in cov:
        sys.exit("No se encontró la fecha en la portada de la plantilla")
    return cov


def construir_odt(md_path: Path, titulo: str, destino: Path, cfg: dict):
    global ANCHO_UTIL_CM, ALTO_MAX_IMAGEN_CM
    ANCHO_UTIL_CM, ALTO_MAX_IMAGEN_CM = cfg["ancho"], cfg["alto"]
    texto = md_path.read_text(encoding="utf-8")
    texto = re.sub(r"^---\n.*?\n---\n", "", texto, flags=re.S).replace("[TOC]", "")
    html = markdown.markdown(texto, extensions=["tables", "fenced_code", "sane_lists"])
    raiz = ET.fromstring(f"<root>{html}</root>")
    conv = Conversor(cfg["salto_h2"], cfg["salto_figura"])
    cuerpo = conv.bloques(raiz)

    with zipfile.ZipFile(DOCS / "plantilla" / cfg["plantilla"]) as z:
        archivos = {n: z.read(n) for n in z.namelist()}
    content = archivos["content.xml"].decode("utf-8")
    styles = archivos["styles.xml"].decode("utf-8")

    # Encabezado: número de fase
    styles = styles.replace(">Fase 1<", f">{FASE}<", 1)
    if f">{FASE}<" not in styles:
        sys.exit("No se encontró 'Fase 1' en el encabezado de la plantilla")
    # Estilos del índice (se reemplazan si la plantilla ya trae unos propios)
    styles = re.sub(r'<style:style style:name="Contents_20_(1|2|Heading)".*?</style:style>', "", styles, flags=re.S)
    indice_estilos = (ESTILOS_INDICE_PLANTILLA.replace("{TAB1}", f"{ANCHO_UTIL_CM - 0.1:.2f}cm")
                      .replace("{TAB2}", f"{ANCHO_UTIL_CM - 0.7:.2f}cm"))
    styles = styles.replace("</office:styles>", indice_estilos + "</office:styles>", 1)

    prologo = content[:content.index("</office:automatic-styles>")]
    apertura = content[content.index("<office:body>"):content.index("<text:p", content.index("<office:text"))]
    nuevo = (prologo + ESTILOS + "".join(conv.tablas) + "</office:automatic-styles>" + apertura
             + portada(content, titulo, cfg["titulo_plantilla"]) + indice() + cuerpo
             + "</office:text></office:body></office:document-content>")

    # Solo se conservan las imágenes que usan el encabezado y la portada
    usadas = set(re.findall(r'xlink:href="(Pictures/[^"]+)"', styles + nuevo))
    manifest = archivos["META-INF/manifest.xml"].decode("utf-8")
    manifest = re.sub(r'\s*<manifest:file-entry manifest:full-path="(Pictures/[^"]+|Thumbnails/[^"]+)"[^>]*/>',
                      lambda m: m.group(0) if m.group(1) in usadas else "", manifest)
    for ruta, _, mime in conv.imagenes:
        manifest = manifest.replace("</manifest:manifest>",
                                    f' <manifest:file-entry manifest:full-path="{ruta}" manifest:media-type="{mime}"/>\n</manifest:manifest>')

    destino.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(destino, "w") as z:
        z.writestr(zipfile.ZipInfo("mimetype"), archivos["mimetype"], compress_type=zipfile.ZIP_STORED)
        for nombre, data in archivos.items():
            if nombre == "mimetype" or nombre.startswith("Thumbnails/"):
                continue
            if nombre.startswith("Pictures/") and nombre not in usadas:
                continue
            if nombre == "content.xml":
                data = nuevo.encode("utf-8")
            elif nombre == "styles.xml":
                data = styles.encode("utf-8")
            elif nombre == "META-INF/manifest.xml":
                data = manifest.encode("utf-8")
            z.writestr(nombre, data, compress_type=zipfile.ZIP_DEFLATED)
        for ruta, origen, _ in conv.imagenes:
            z.write(origen, ruta, compress_type=zipfile.ZIP_DEFLATED)


def actualizar_y_exportar(odts):
    """Con LibreOffice: actualiza el índice (números de página), guarda y exporta a PDF."""
    import uno
    from com.sun.star.beans import PropertyValue

    def prop(nombre, valor):
        p = PropertyValue()
        p.Name, p.Value = nombre, valor
        return p

    puerto = random.randint(20000, 40000)
    perfil = tempfile.mkdtemp(prefix="lo-perfil-")
    proc = subprocess.Popen(["soffice", "--headless", "--invisible", "--norestore", "--nologo",
                             f"--accept=socket,host=127.0.0.1,port={puerto};urp;",
                             f"-env:UserInstallation=file://{perfil}"],
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        local = uno.getComponentContext()
        resolver = local.ServiceManager.createInstanceWithContext("com.sun.star.bridge.UnoUrlResolver", local)
        for _ in range(60):
            try:
                ctx = resolver.resolve(f"uno:socket,host=127.0.0.1,port={puerto};urp;StarOffice.ComponentContext")
                break
            except Exception:
                time.sleep(0.5)
        else:
            sys.exit("LibreOffice no respondió")
        desktop = ctx.ServiceManager.createInstanceWithContext("com.sun.star.frame.Desktop", ctx)
        for odt in odts:
            doc = desktop.loadComponentFromURL(uno.systemPathToFileUrl(str(odt)), "_blank", 0, (prop("Hidden", True),))
            indices = doc.getDocumentIndexes()
            for _ in range(2):  # la segunda pasada corrige páginas desplazadas por el propio índice
                for i in range(indices.getCount()):
                    indices.getByIndex(i).update()
            doc.store()
            pdf = odt.with_suffix(".pdf")
            doc.storeToURL(uno.systemPathToFileUrl(str(pdf)), (prop("FilterName", "writer_pdf_Export"),))
            doc.close(True)
            print(f"  {odt.relative_to(DOCS.parent)}\n  {pdf.relative_to(DOCS.parent)}")
        desktop.terminate()
    finally:
        try:
            proc.wait(timeout=20)
        except subprocess.TimeoutExpired:
            proc.kill()
        shutil.rmtree(perfil, ignore_errors=True)


def main():
    for herramienta in ("dot", "soffice"):
        if not shutil.which(herramienta):
            sys.exit(f"Falta {herramienta}")
    subprocess.run([sys.executable, str(DOCS / "bpmn.py")], check=True, stdout=subprocess.DEVNULL)
    for dot in sorted((DOCS / "diagramas").glob("*.dot")):
        subprocess.run(["dot", "-Tpng", "-Gdpi=170", str(dot), "-o", str(dot.with_suffix(".png"))], check=True)
    salidas = []
    solo = set(sys.argv[1:])   # p. ej.: python3 docs/build.py escalabilidad.md
    for md, (nombre, titulo, cfg) in DOCUMENTOS.items():
        if solo and md not in solo:
            continue
        destino = OUT / f"{nombre}.odt"
        construir_odt(DOCS / md, titulo, destino, cfg)
        salidas.append(destino)
    actualizar_y_exportar(salidas)


if __name__ == "__main__":
    main()
