from __future__ import annotations

import json
import re
import shutil
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from pathlib import Path
from zipfile import ZipFile


ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT / 'data'
OUTPUT_DIR = ROOT / 'frontend' / 'src' / 'data' / 'generated'
PUBLIC_IMAGE_DIR = ROOT / 'frontend' / 'public' / 'imported-data'

CHEMICAL_FILE = DATA_DIR / '化学品清单-副本.xlsx'
EQUIPMENT_FILE = DATA_DIR / '实验室仪器设备维护记录.xlsx'

NS = {
    'main': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
    'pkgrel': 'http://schemas.openxmlformats.org/package/2006/relationships',
    'xdr': 'http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing',
    'a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
}
REL_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'

WORKBOOK_KEYS = {
    '化学品清单-副本.xlsx': 'chemicals',
    '实验室仪器设备维护记录.xlsx': 'equipment',
}

SHEET_KEYS = {
    '总表': 'stock',
    '采购记录': 'purchases',
    '领用记录': 'usage',
    'Sheet1': 'sheet1',
}


@dataclass
class SheetData:
    name: str
    path: str
    rows: list[dict[str, str]]


def column_letters(cell_ref: str) -> str:
    match = re.match(r'[A-Z]+', cell_ref)
    return match.group(0) if match else ''


def normalize_text(value: str | None) -> str:
    return (value or '').replace('\n', ' ').strip()


def normalize_empty(value: str | None) -> str | None:
    cleaned = normalize_text(value)
    if cleaned in {'', '/'}:
        return None
    return cleaned


def normalize_date(value: str | None) -> str | None:
    cleaned = normalize_empty(value)
    if not cleaned:
        return None
    if cleaned == '不详':
        return None
    digits = re.sub(r'\D', '', cleaned)
    if len(digits) == 8:
        return f'{digits[0:4]}-{digits[4:6]}-{digits[6:8]}'
    if len(digits) == 6:
        return f'{digits[0:4]}-{digits[4:6]}'
    return cleaned


def parse_amount_number(value: str | None) -> float | None:
    cleaned = normalize_empty(value)
    if not cleaned:
        return None
    match = re.search(r'\d+(?:\.\d+)?', cleaned)
    return float(match.group(0)) if match else None


def slugify(value: str) -> str:
    normalized = normalize_text(value).lower()
    normalized = re.sub(r'[^a-z0-9]+', '-', normalized)
    normalized = normalized.strip('-')
    return normalized or 'sheet'


def read_shared_strings(zip_file: ZipFile) -> list[str]:
    if 'xl/sharedStrings.xml' not in zip_file.namelist():
        return []
    root = ET.fromstring(zip_file.read('xl/sharedStrings.xml'))
    shared = []
    for item in root.findall('main:si', NS):
        text_parts = [text.text or '' for text in item.iterfind('.//main:t', NS)]
        shared.append(''.join(text_parts))
    return shared


def workbook_sheet_paths(zip_file: ZipFile) -> list[tuple[str, str]]:
    workbook = ET.fromstring(zip_file.read('xl/workbook.xml'))
    rels = ET.fromstring(zip_file.read('xl/_rels/workbook.xml.rels'))
    rel_map = {
        rel.attrib['Id']: rel.attrib['Target']
        for rel in rels.findall('pkgrel:Relationship', NS)
    }
    sheets: list[tuple[str, str]] = []
    for sheet in workbook.find('main:sheets', NS):
        relationship_id = sheet.attrib[f'{{{REL_NS}}}id']
        target = rel_map[relationship_id]
        if target.startswith('worksheets/'):
            sheets.append((sheet.attrib['name'], f'xl/{target}'))
    return sheets


def parse_xlsx(path: Path) -> list[SheetData]:
    with ZipFile(path) as zip_file:
        shared_strings = read_shared_strings(zip_file)
        parsed_sheets: list[SheetData] = []
        for sheet_name, sheet_path in workbook_sheet_paths(zip_file):
            root = ET.fromstring(zip_file.read(sheet_path))
            rows: list[dict[str, str]] = []
            for row in root.findall('.//main:sheetData/main:row', NS):
                values: dict[str, str] = {}
                for cell in row.findall('main:c', NS):
                    ref = cell.attrib.get('r', '')
                    cell_type = cell.attrib.get('t')
                    value_node = cell.find('main:v', NS)
                    if value_node is None:
                        continue
                    value = value_node.text or ''
                    if cell_type == 's' and value.isdigit():
                        index = int(value)
                        value = shared_strings[index] if index < len(shared_strings) else value
                    values[column_letters(ref)] = normalize_text(value)
                if values:
                    rows.append(values)
            parsed_sheets.append(SheetData(sheet_name, sheet_path, rows))
        return parsed_sheets


def resolve_relationship_target(base_path: str, target: str) -> str:
    base_dir = Path(base_path).parent
    resolved = (base_dir / target).resolve().as_posix()
    marker = '/xl/'
    if marker in resolved:
        return resolved.split(marker, 1)[1].join(['xl/', ''])[:-0]
    return 'xl/' + target.replace('../', '')


def build_sheet_image_map(path: Path) -> dict[str, dict[int, list[str]]]:
    workbook_key = WORKBOOK_KEYS.get(path.name, slugify(path.stem))
    image_map: dict[str, dict[int, list[str]]] = {}

    with ZipFile(path) as zip_file:
        sheet_paths = workbook_sheet_paths(zip_file)
        for sheet_name, sheet_path in sheet_paths:
            rel_path = f"{Path(sheet_path).parent.as_posix()}/_rels/{Path(sheet_path).name}.rels"
            if rel_path not in zip_file.namelist():
                continue

            rels_root = ET.fromstring(zip_file.read(rel_path))
            drawing_target = None
            for rel in rels_root.findall('pkgrel:Relationship', NS):
                if rel.attrib.get('Type', '').endswith('/drawing'):
                    drawing_target = rel.attrib['Target']
                    break
            if not drawing_target:
                continue

            drawing_path = 'xl/' + drawing_target.replace('../', '')
            drawing_rel_path = f"{Path(drawing_path).parent.as_posix()}/_rels/{Path(drawing_path).name}.rels"
            if drawing_path not in zip_file.namelist() or drawing_rel_path not in zip_file.namelist():
                continue

            drawing_rels_root = ET.fromstring(zip_file.read(drawing_rel_path))
            drawing_rel_map = {
                rel.attrib['Id']: 'xl/' + rel.attrib['Target'].replace('../', '')
                for rel in drawing_rels_root.findall('pkgrel:Relationship', NS)
            }

            drawing_root = ET.fromstring(zip_file.read(drawing_path))
            sheet_key = SHEET_KEYS.get(sheet_name, slugify(sheet_name))
            sheet_images: dict[int, list[str]] = {}
            image_counters: dict[int, int] = {}

            for anchor in drawing_root:
                frm = anchor.find('xdr:from', NS)
                pic = anchor.find('xdr:pic', NS)
                if frm is None or pic is None:
                    continue
                row_text = frm.findtext('xdr:row', default='0', namespaces=NS)
                try:
                    row_number = int(row_text) + 1
                except ValueError:
                    continue
                blip = pic.find('.//a:blip', NS)
                if blip is None:
                    continue
                embed = blip.attrib.get(f'{{{REL_NS}}}embed')
                if not embed:
                    continue
                media_path = drawing_rel_map.get(embed)
                if not media_path or media_path not in zip_file.namelist():
                    continue

                extension = Path(media_path).suffix.lower() or '.bin'
                image_counters[row_number] = image_counters.get(row_number, 0) + 1
                image_index = image_counters[row_number]
                output_name = f'row-{row_number}-{image_index}{extension}'
                output_dir = PUBLIC_IMAGE_DIR / workbook_key / sheet_key
                output_dir.mkdir(parents=True, exist_ok=True)
                output_path = output_dir / output_name
                output_path.write_bytes(zip_file.read(media_path))
                public_path = f'/imported-data/{workbook_key}/{sheet_key}/{output_name}'
                sheet_images.setdefault(row_number, []).append(public_path)

            image_map[sheet_name] = sheet_images

    return image_map


def parse_chemical_sheets(image_map: dict[str, dict[int, list[str]]]) -> tuple[list[dict], list[dict], list[dict]]:
    sheets = {sheet.name: sheet.rows for sheet in parse_xlsx(CHEMICAL_FILE)}
    stock_rows = sheets['总表'][2:]
    purchase_rows = sheets['采购记录'][2:]
    usage_rows = sheets['领用记录'][2:]

    package_records: list[dict] = []
    current_base: dict[str, str | None] = {}
    package_id = 1
    for offset, row in enumerate(stock_rows, start=3):
        name = normalize_empty(row.get('B'))
        if name:
            current_base = {
                'name': name,
                'cas': normalize_empty(row.get('C')),
                'spec': normalize_empty(row.get('D')),
                'physicalForm': normalize_empty(row.get('E')),
            }
        if not current_base:
            continue
        images = image_map.get('总表', {}).get(offset, [])
        package_records.append(
            {
                'id': f'chem-package-{package_id}',
                'name': current_base['name'],
                'cas': current_base['cas'],
                'spec': current_base['spec'],
                'physicalForm': current_base['physicalForm'],
                'usageStatus': normalize_empty(row.get('F')) or '未知',
                'quantity': int(parse_amount_number(row.get('G')) or 0),
                'batchNo': normalize_empty(row.get('H')),
                'openedAt': normalize_date(row.get('I')),
                'expiresAt': normalize_date(row.get('J')),
                'remark': normalize_empty(row.get('K')),
                'images': images,
                'image': images[0] if images else None,
            }
        )
        package_id += 1

    grouped: dict[tuple[str | None, str | None, str | None, str | None], dict] = {}
    for item in package_records:
        key = (item['name'], item['cas'], item['spec'], item['physicalForm'])
        group = grouped.setdefault(
            key,
            {
                'id': f'chemical-{len(grouped) + 1}',
                'name': item['name'],
                'cas': item['cas'],
                'spec': item['spec'],
                'physicalForm': item['physicalForm'],
                'totalQuantity': 0,
                'openedQuantity': 0,
                'sealedQuantity': 0,
                'packageCount': 0,
                'earliestExpiry': None,
                'latestOpenedAt': None,
                'remark': item['remark'],
                'image': item['image'],
                'images': list(item['images']),
            },
        )
        group['totalQuantity'] += item['quantity']
        group['packageCount'] += 1
        if item['usageStatus'] == '开封':
            group['openedQuantity'] += item['quantity']
        if item['usageStatus'] == '未开封':
            group['sealedQuantity'] += item['quantity']
        if item['expiresAt'] and (
            group['earliestExpiry'] is None or item['expiresAt'] < group['earliestExpiry']
        ):
            group['earliestExpiry'] = item['expiresAt']
        if item['openedAt'] and (
            group['latestOpenedAt'] is None or item['openedAt'] > group['latestOpenedAt']
        ):
            group['latestOpenedAt'] = item['openedAt']
        if not group['remark'] and item['remark']:
            group['remark'] = item['remark']
        for image in item['images']:
            if image not in group['images']:
                group['images'].append(image)
        if not group['image'] and group['images']:
            group['image'] = group['images'][0]

    chemicals = sorted(grouped.values(), key=lambda item: item['name'] or '')

    purchases: list[dict] = []
    for index, row in enumerate(purchase_rows, start=1):
        excel_row = index + 2
        images = image_map.get('采购记录', {}).get(excel_row, [])
        purchases.append(
            {
                'id': f'purchase-{index}',
                'name': normalize_empty(row.get('B')) or '未命名化学品',
                'cas': normalize_empty(row.get('C')),
                'spec': normalize_empty(row.get('D')),
                'physicalForm': normalize_empty(row.get('E')),
                'purchasedAt': normalize_date(row.get('F')),
                'quantity': normalize_empty(row.get('G')),
                'batchNo': normalize_empty(row.get('H')),
                'expiresAt': normalize_date(row.get('I')),
                'remark': normalize_empty(row.get('J')),
                'image': images[0] if images else None,
                'images': images,
            }
        )

    usages: list[dict] = []
    current_used_at: str | None = None
    for index, row in enumerate(usage_rows, start=1):
        if normalize_empty(row.get('B')):
            current_used_at = normalize_date(row.get('B'))
        usages.append(
            {
                'id': f'usage-{index}',
                'usedAt': current_used_at,
                'name': normalize_empty(row.get('C')) or '未命名化学品',
                'amount': normalize_empty(row.get('D')),
                'purpose': normalize_empty(row.get('E')),
                'remark': normalize_empty(row.get('F')),
            }
        )

    return chemicals, purchases, usages


def parse_equipment_sheet(image_map: dict[str, dict[int, list[str]]]) -> list[dict]:
    sheets = parse_xlsx(EQUIPMENT_FILE)
    rows = sheets[0].rows[1:]
    equipment: list[dict] = []
    for index, row in enumerate(rows, start=2):
        images = image_map.get('Sheet1', {}).get(index, [])
        equipment.append(
            {
                'id': f"equipment-{row.get('A')}",
                'code': normalize_empty(row.get('A')),
                'name': normalize_empty(row.get('B')) or '未命名设备',
                'vendor': normalize_empty(row.get('C')),
                'model': normalize_empty(row.get('D')),
                'image': images[0] if images else None,
                'images': images,
                'status': normalize_empty(row.get('F')) or '未知',
                'lastMaintenanceAt': normalize_date(row.get('G')),
                'remark': normalize_empty(row.get('H')),
            }
        )
    return equipment


def build_movements(purchases: list[dict], usages: list[dict]) -> list[dict]:
    movements: list[dict] = []
    for item in purchases:
        movements.append(
            {
                'id': item['id'],
                'date': item['purchasedAt'],
                'name': item['name'],
                'type': '入库',
                'quantity': item['quantity'],
                'operator': '采购入库',
                'reason': item['remark'] or '采购记录',
                'image': item['image'],
            }
        )
    for item in usages:
        movements.append(
            {
                'id': item['id'],
                'date': item['usedAt'],
                'name': item['name'],
                'type': '出库',
                'quantity': item['amount'],
                'operator': '实验领用',
                'reason': item['purpose'] or item['remark'] or '领用记录',
                'image': None,
            }
        )
    movements.sort(key=lambda item: (item['date'] or '', item['id']), reverse=True)
    return movements


def write_json(name: str, payload: list[dict]) -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    path = OUTPUT_DIR / name
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def clean_generated_outputs() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    if PUBLIC_IMAGE_DIR.exists():
        shutil.rmtree(PUBLIC_IMAGE_DIR, ignore_errors=True)
    PUBLIC_IMAGE_DIR.mkdir(parents=True, exist_ok=True)


def main() -> None:
    clean_generated_outputs()

    chemical_images = build_sheet_image_map(CHEMICAL_FILE)
    equipment_images = build_sheet_image_map(EQUIPMENT_FILE)

    chemicals, purchases, usages = parse_chemical_sheets(chemical_images)
    equipment = parse_equipment_sheet(equipment_images)
    movements = build_movements(purchases, usages)

    write_json('chemicals.json', chemicals)
    write_json('chemical-purchases.json', purchases)
    write_json('chemical-usage.json', usages)
    write_json('movements.json', movements)
    write_json('equipment.json', equipment)

    print(f'Generated data files in {OUTPUT_DIR}')
    print(f'chemicals: {len(chemicals)}')
    print(f'purchases: {len(purchases)}')
    print(f'usages: {len(usages)}')
    print(f'movements: {len(movements)}')
    print(f'equipment: {len(equipment)}')


if __name__ == '__main__':
    main()
