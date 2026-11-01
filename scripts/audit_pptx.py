#!/usr/bin/env python3
"""Read-only PPTX checks using Python's standard library; no Office required."""
import argparse
import json
import math
import posixpath
import re
import sys
import zipfile
from pathlib import Path
import xml.etree.ElementTree as ET

NS = {'a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
      'p': 'http://schemas.openxmlformats.org/presentationml/2006/main',
      'c': 'http://schemas.openxmlformats.org/drawingml/2006/chart',
      'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
      's': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
REL = '{http://schemas.openxmlformats.org/package/2006/relationships}'

def xml(z, part):
    data = z.read(part)
    if b'<!DOCTYPE' in data.upper() or b'<!ENTITY' in data.upper():
        raise ValueError(f'Unsupported DTD/entity in {part}')
    return ET.fromstring(data)

def target(owner, relative):
    return posixpath.normpath(posixpath.join(posixpath.dirname(owner), relative))

def relationship_map(z, owner):
    folder, name = posixpath.split(owner)
    relpart = posixpath.join(folder, '_rels', name + '.rels')
    if relpart not in z.namelist():
        return {}
    return {e.attrib['Id']: e.attrib for e in xml(z, relpart)}

def chart_check(z, part, failures):
    root = xml(z, part)
    for v in root.findall('.//c:numCache/c:pt/c:v', NS) + root.findall('.//c:numLit/c:pt/c:v', NS):
        try:
            assert math.isfinite(float(v.text))
        except (ValueError, TypeError, AssertionError):
            failures.append(f'{part}: non-finite chart point')
    ext = root.find('c:externalData', NS)
    rels = relationship_map(z, part)
    rel = rels.get(ext.get('{'+NS['r']+'}id')) if ext is not None else None
    if not rel or rel.get('TargetMode') == 'External':
        failures.append(f'{part}: missing embedded editable chart workbook')
        return
    bookpart = target(part, rel['Target'])
    if bookpart not in z.namelist():
        failures.append(f'{part}: chart workbook relationship is broken')
        return
    import io
    with zipfile.ZipFile(io.BytesIO(z.read(bookpart))) as book:
        wb = xml(book, 'xl/workbook.xml')
        wb_rels = relationship_map(book, 'xl/workbook.xml')
        sheets = {}
        for sheet in wb.findall('s:sheets/s:sheet', NS):
            rid = sheet.get('{'+NS['r']+'}id')
            dest = target('xl/workbook.xml', wb_rels[rid]['Target'])
            if dest.startswith('/'):
                dest = dest.lstrip('/')
            cells = {c.get('r'): c.findtext('s:v', namespaces=NS)
                     for c in xml(book, dest).findall('.//s:c', NS)}
            sheets[sheet.get('name')] = cells
        for ref in root.findall('.//c:val/c:numRef', NS):
            formula = ref.findtext('c:f', namespaces=NS) or ''
            match = re.fullmatch(r"(?:'([^']+)'|([^!]+))!\$?([A-Z]+)\$?(\d+):\$?([A-Z]+)\$?(\d+)", formula)
            if not match:
                failures.append(f'{part}: unsupported or missing series formula')
                continue
            name = match[1] or match[2]
            if match[3] != match[5]:
                failures.append(f'{part}: expected a column data range')
                continue
            try:
                values = [float(sheets[name][match[3]+str(i)]) for i in range(int(match[4]), int(match[6])+1)]
                cached = [float(v.text) for v in ref.findall('c:numCache/c:pt/c:v', NS)]
                if values != cached:
                    failures.append(f'{part}: workbook values differ from chart cache')
            except (KeyError, ValueError, TypeError):
                failures.append(f'{part}: unreadable chart workbook numeric cells')

def audit(file, min_text=0, max_pictures=None, scene=None):
    failures = []
    counts = {'slides': 0, 'text_boxes': 0, 'native_shapes': 0, 'native_paths': 0,
              'native_charts': 0, 'pictures': 0}
    texts = []
    with zipfile.ZipFile(file) as z:
        names = set(z.namelist())
        if sum(i.file_size for i in z.infolist()) > 150_000_000:
            raise ValueError('PPTX exceeds bounded audit size')
        for part in names:
            if part.endswith(('.xml', '.rels')):
                xml(z, part)
        for part in names:
            if not part.endswith('.rels'):
                continue
            owner = posixpath.join(posixpath.dirname(posixpath.dirname(part)), posixpath.basename(part)[:-5])
            if part == '_rels/.rels':
                owner = ''
            for rel in xml(z, part):
                if rel.get('TargetMode') != 'External':
                    dest = target(owner, rel.get('Target', '')).lstrip('/')
                    if dest not in names:
                        failures.append(f'Broken relationship: {part} -> {dest}')
        presentation = xml(z, 'ppt/presentation.xml')
        size = presentation.find('p:sldSz', NS)
        width, height = int(size.get('cx')), int(size.get('cy'))
        slides = sorted(n for n in names if re.fullmatch(r'ppt/slides/slide\d+\.xml', n))
        counts['slides'] = len(slides)
        for part in slides:
            root = xml(z, part)
            for shape in root.findall('.//p:sp', NS):
                counts['native_shapes'] += 1
                if shape.find('p:txBody', NS) is not None:
                    counts['text_boxes'] += 1
                    texts.append(''.join(t.text or '' for t in shape.findall('.//a:t', NS)))
                counts['native_paths'] += len(shape.findall('.//a:custGeom', NS))
            counts['pictures'] += len(root.findall('.//p:pic', NS))
            counts['native_charts'] += len(root.findall('.//c:chart', NS))
            for transform in root.findall('.//p:spPr/a:xfrm', NS):
                off, ext = transform.find('a:off', NS), transform.find('a:ext', NS)
                if off is None or ext is None:
                    continue
                x, y, w, h = (int(off.get('x')), int(off.get('y')), int(ext.get('cx')), int(ext.get('cy')))
                # 1px tolerance accommodates rounding at thin strokes.
                if x < -9525 or y < -9525 or x+w > width+9525 or y+h > height+9525:
                    failures.append(f'{part}: shape bounds extend outside canvas')
        for part in names:
            if re.fullmatch(r'ppt/(?:slides/)?charts/chart\d+\.xml', part):
                chart_check(z, part, failures)
    if counts['text_boxes'] < min_text:
        failures.append('Too few native text boxes')
    if max_pictures is not None and counts['pictures'] > max_pictures:
        failures.append('Too many raster/image objects')
    if scene:
        expected = json.loads(Path(scene).read_text(encoding='utf-8'))
        if len(expected['slides']) != counts['slides']:
            failures.append('Slide count does not match scene')
        joined = re.sub(r'\s+', '', '\n'.join(texts))
        for slide in expected['slides']:
            for e in slide['elements']:
                if e['type'] == 'text':
                    text = e.get('text', ''.join(r['text'] for r in e.get('runs', [])))
                    if re.sub(r'\s+', '', text) not in joined:
                        failures.append(f"Missing scene text: {e['id']}")
    return {'passed': not failures, **counts, 'failures': failures,
            'boundary': 'Structural and data checks only; rendered fidelity and native PowerPoint opening are separate.'}

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('pptx')
    parser.add_argument('--min-text', type=int, default=0)
    parser.add_argument('--max-pictures', type=int)
    parser.add_argument('--scene')
    args = parser.parse_args()
    try:
        result = audit(args.pptx, args.min_text, args.max_pictures, args.scene)
    except Exception as exc:
        result = {'passed': False, 'failures': [str(exc)]}
    print(json.dumps(result, ensure_ascii=False, indent=2))
    sys.exit(0 if result['passed'] else 1)
