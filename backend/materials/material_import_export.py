"""
Импорт и экспорт каталога материалов (таблица XLSX и XML Database/Materials/Material).

XLSX читается через разбор OOXML вручную: часть файлов содержит некорректные
типы ячеек (boolean как строка «true»), из‑за чего openpyxl падает.

Сводка: docs/MATERIALS_IMPORT_EXPORT.md (репозиторий Furnitech).
"""

from __future__ import annotations

import re
import xml.etree.ElementTree as ET
import zipfile
from dataclasses import dataclass, field
from decimal import Decimal, InvalidOperation
from io import BytesIO
from pathlib import Path
from typing import BinaryIO

from django.db import IntegrityError, transaction

from .models import Material, MaterialCategory, MaterialClass, RoundingMode, TextureItem, UnitOfMeasure

NS_MAIN = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"


def _col_letters_to_index(col: str) -> int:
    n = 0
    for ch in col.upper():
        if not ("A" <= ch <= "Z"):
            break
        n = n * 26 + (ord(ch) - ord("A") + 1)
    return n - 1


def _parse_cell_ref(ref: str) -> tuple[int, int] | None:
    m = re.match(r"^([A-Za-z]+)(\d+)$", ref or "")
    if not m:
        return None
    return int(m.group(2)), _col_letters_to_index(m.group(1))


def _read_shared_strings(zf: zipfile.ZipFile) -> list[str]:
    try:
        raw = zf.read("xl/sharedStrings.xml")
    except KeyError:
        return []
    root = ET.fromstring(raw)
    out: list[str] = []
    for si in root.findall(f"{NS_MAIN}si"):
        t = si.find(f"{NS_MAIN}t")
        if t is not None and t.text is not None:
            out.append(t.text)
            continue
        parts: list[str] = []
        for node in si.iter():
            if node.tag == f"{NS_MAIN}t" and node.text:
                parts.append(node.text)
        out.append("".join(parts))
    return out


def _xlsx_rows_from_bytes(data: bytes) -> tuple[list[str], list[list[str | None]]]:
    """Возвращает (заголовки строкой, строки данных как список ячеек по позициям)."""
    zf = zipfile.ZipFile(BytesIO(data))
    strings = _read_shared_strings(zf)
    sheet_xml = zf.read("xl/worksheets/sheet1.xml")
    zf.close()
    root = ET.fromstring(sheet_xml)
    # row_r -> {col_idx: value_str}
    by_row: dict[int, dict[int, str]] = {}
    max_col = 0
    for row_el in root.iter():
        if not row_el.tag.endswith("row"):
            continue
        r_attr = row_el.get("r")
        if not r_attr or not r_attr.isdigit():
            continue
        row_idx = int(r_attr)
        row_cells: dict[int, str] = {}
        for c in row_el:
            if not c.tag.endswith("c"):
                continue
            ref = c.get("r") or ""
            parsed = _parse_cell_ref(ref)
            if not parsed:
                continue
            _, col_idx = parsed
            max_col = max(max_col, col_idx)
            t = c.get("t")
            v_el = None
            is_el = None
            for child in c:
                if child.tag.endswith("v"):
                    v_el = child
                elif child.tag.endswith("is"):
                    is_el = child
            val: str | None = None
            if t == "s" and v_el is not None and v_el.text is not None:
                try:
                    val = strings[int(v_el.text)]
                except (ValueError, IndexError):
                    val = v_el.text
            elif t == "inlineStr" and is_el is not None:
                parts = []
                for tnode in is_el.iter():
                    if tnode.tag.endswith("t") and tnode.text:
                        parts.append(tnode.text)
                val = "".join(parts)
            elif t == "b" and v_el is not None and v_el.text is not None:
                val = "true" if v_el.text.strip() == "1" else "false"
            elif v_el is not None and v_el.text is not None:
                val = v_el.text
            if val is not None:
                row_cells[col_idx] = val
        if row_cells:
            by_row[row_idx] = row_cells

    if not by_row:
        return [], []

    sorted_rows = sorted(by_row.keys())
    header_row_i = sorted_rows[0]
    header_map = by_row[header_row_i]
    headers = []
    for ci in range(max_col + 1):
        headers.append(header_map.get(ci, "") or "")

    data: list[list[str | None]] = []
    for ri in sorted_rows[1:]:
        cells = by_row[ri]
        row = [cells.get(ci) for ci in range(max_col + 1)]
        if any(x is not None and str(x).strip() for x in row):
            data.append(row)
    return headers, data


def _norm_header(h: str) -> str:
    return re.sub(r"\s+", " ", (h or "").strip().lower())


# Русские заголовки таблицы импорта/экспорта → внутренние ключи
_HEADER_ALIASES: dict[str, str] = {
    "артикул материала": "article",
    "наименование материала": "name",
    "номер группы": "group_code",
    "наименование группы": "group_path",
    "единица измерения": "uom",
    "стоимость": "price",
    "длина": "length",
    "ширина": "width",
    "толщина": "thickness",
    "примечание": "note",
    "цвет (целое число)": "color_int",
    "текстура": "texture_path",
    "класс": "class_text",
    "идентификатор для синхронизации": "external_id",
    "цвет (hex)": "color_hex",
    "цвет (rgb)": "color_rgb",
    "нет в наличии": "no_available",
    # Англ. теги XML как заголовки (если кто-то сохранит вручную)
    "article": "article",
    "name": "name",
    "group_name": "group_path",
    "group_code": "group_code",
    "unit_measure": "uom",
    "price": "price",
    "color (hex)": "color_hex",
    "color_hex": "color_hex",
    "color (rgb)": "color_rgb",
    "color (int)": "color_int",
}


def _map_headers(headers: list[str]) -> dict[str, int]:
    key_to_idx: dict[str, int] = {}
    for i, h in enumerate(headers):
        key = _HEADER_ALIASES.get(_norm_header(str(h)))
        if key:
            key_to_idx[key] = i
    return key_to_idx


def _strip_numeric_prefix(segment: str) -> str:
    s = segment.strip()
    return re.sub(r"^\d+\.\s*", "", s) or s


def _split_group_path(path: str) -> list[str]:
    if not path or not str(path).strip():
        return []
    parts = re.split(r"[\\/]+", str(path).strip())
    return [_strip_numeric_prefix(p) for p in parts if p.strip()]


def _ensure_category_path(segments: list[str]) -> MaterialCategory:
    parent: MaterialCategory | None = None
    last: MaterialCategory | None = None
    for name in segments:
        if not name:
            continue
        cat, _created = MaterialCategory.objects.get_or_create(
            parent=parent,
            name=name,
            defaults={"sort_order": 0},
        )
        parent = cat
        last = cat
    if last is None:
        raise ValueError("Пустой путь папки")
    return last


def _resolve_uom(label: str | None) -> UnitOfMeasure:
    raw = (label or "").strip().lower().replace("²", "2")
    synonyms: dict[str, tuple[str, ...]] = {
        "mp": ("м", "м.", "п.м", "п.м.", "м.п", "м.п.", "пог.м", "м/п", "m", "mp", "linear"),
        "pc": ("шт", "шт.", "штука", "штук", "pc", "pcs"),
        "m2": ("м2", "м²", "кв.м", "кв м", "m2", "sqm"),
        "m3": ("м3", "м³", "m3"),
        "kg": ("кг", "kg"),
        "l": ("л", "l"),
    }
    for code, variants in synonyms.items():
        if raw in variants:
            u = UnitOfMeasure.objects.filter(code=code).first()
            if u:
                return u
    # fallback: по short_name
    u = UnitOfMeasure.objects.filter(short_name__iexact=label.strip()).first() if label else None
    if u:
        return u
    u = UnitOfMeasure.objects.filter(code="pc").first()
    if u:
        return u
    return UnitOfMeasure.objects.order_by("id").first()


def _dec(s: str | None) -> Decimal:
    if s is None or str(s).strip() == "":
        return Decimal("0")
    t = str(s).strip().replace(",", ".")
    try:
        return Decimal(t)
    except InvalidOperation:
        return Decimal("0")


def _hex_color(s: str | None) -> str:
    if not s:
        return ""
    t = str(s).strip().upper().replace("#", "")
    if len(t) == 3 and re.fullmatch(r"[0-9A-F]{3}", t):
        return f"#{t[0]}{t[0]}{t[1]}{t[1]}{t[2]}{t[2]}"
    if len(t) == 6 and re.fullmatch(r"[0-9A-F]{6}", t):
        return f"#{t}"
    if len(t) == 8 and re.fullmatch(r"[0-9A-F]{8}", t):
        # AARRGGBB (как в .NET / части выгрузок)
        return f"#{t[2:8]}"
    return ""


def _hex_from_color_int(n: int) -> str:
    """Целое как Win32 COLORREF 0x00BBGGRR (младший байт — синий)."""
    n = int(n) & 0xFFFFFF
    b = n & 0xFF
    g = (n >> 8) & 0xFF
    r = (n >> 16) & 0xFF
    return f"#{r:02X}{g:02X}{b:02X}"


def _hex_from_color_int_cell(s: str | None) -> str:
    if s is None or str(s).strip() == "":
        return ""
    t = str(s).strip().replace(",", ".")
    try:
        n = int(float(t))
    except (ValueError, TypeError):
        return ""
    return _hex_from_color_int(n)


def _hex_from_rgb_string(s: str | None) -> str:
    if not s:
        return ""
    t = str(s).strip()
    m = re.match(r"rgb\s*\(\s*(\d{1,3})\s*[,;]\s*(\d{1,3})\s*[,;]\s*(\d{1,3})\s*\)", t, re.I)
    if m:
        r, g, b = int(m.group(1)), int(m.group(2)), int(m.group(3))
    else:
        parts = [p for p in re.split(r"[,;\s]+", t) if p]
        if len(parts) != 3:
            return ""
        try:
            r, g, b = int(parts[0]), int(parts[1]), int(parts[2])
        except ValueError:
            return ""
    if not all(0 <= x <= 255 for x in (r, g, b)):
        return ""
    return f"#{r:02X}{g:02X}{b:02X}"


def _parse_boolish(s: str | None) -> bool | None:
    if s is None:
        return None
    x = str(s).strip().lower()
    if x in ("y", "yes", "true", "1", "да", "истина"):
        return True
    if x in ("n", "no", "false", "0", "нет", "ложь"):
        return False
    return None


# Порядок колонок и подписей XLSX — как в файле 123.xlsx (те же строки заголовков).
# Внутренние теги XML (123.xml) слева; порядок колонок Excel отличается от порядка тегов в XML (Offset/DX).
_MATERIALS_TABLE_XLSX_COLUMN_PAIRS: list[tuple[str, str]] = [
    ("Article", "Артикул материала"),
    ("Name", "Наименование материала"),
    ("Group_Code", "Номер группы"),
    ("Group_Name", "Наименование группы"),
    ("Unit_Measure", "Единица измерения"),
    ("Price", "Стоимость"),
    ("Coef", "Коэффициент"),
    ("Length", "Длина"),
    ("Width", "Ширина"),
    ("Thickness", "Толщина"),
    ("Sign", "Обозначение"),
    ("Overhang", "Свес"),
    ("Color", "Цвет (целое число)"),
    ("Texture", "Текстура"),
    ("Class", "Класс"),
    ("IsTape", "Тип материала"),
    ("Sync_External", "Идентификатор для синхронизации"),
    ("Weight", "Масса"),
    ("Comment", "Примечание"),
    ("NoAvailable", "Нет в наличии"),
    ("Stretch", "Растянуть"),
    ("Retry", "Зеркально"),
    ("Mirror", "Зеркальность"),
    ("Transparent", "Прозрачность"),
    ("Shiness", "Резкость блика"),
    ("Bright", "Яркость блика"),
    ("OffsetX", "Смещение по X"),
    ("OffsetY", "Смещение по Y"),
    ("DX", "Шаг по Х"),
    ("DY", "Шаг по Y"),
    ("Angle", "Угол поворота"),
    ("Coef_Exc_Cutting", "Коэффициент избытка с учетом раскроя"),
    ("Round_Mode", "Способ округления"),
    ("Alt_Price", "Цена в альтернативной валюте"),
    ("Color_RGB", "Цвет (RGB)"),
    ("Color_HEX", "Цвет (HEX)"),
]

# Порядок тегов в XML как в 123.xml (без Group_Code)
MATERIALS_TABLE_XML_ELEMENT_ORDER = [
    "Article",
    "Name",
    "Group_Name",
    "Unit_Measure",
    "Price",
    "Coef",
    "Length",
    "Width",
    "Thickness",
    "Sign",
    "Overhang",
    "Color",
    "Texture",
    "Class",
    "IsTape",
    "Sync_External",
    "Weight",
    "Comment",
    "NoAvailable",
    "Stretch",
    "Retry",
    "Mirror",
    "Transparent",
    "Shiness",
    "Bright",
    "DX",
    "DY",
    "OffsetX",
    "OffsetY",
    "Angle",
    "Coef_Exc_Cutting",
    "Round_Mode",
    "Alt_Price",
    "Color_RGB",
    "Color_HEX",
]

EXPORT_XLSX_HEADERS = [ru for _, ru in _MATERIALS_TABLE_XLSX_COLUMN_PAIRS]
_XLSX_NORM_TO_XML_TAG: dict[str, str] = {_norm_header(ru): tag for tag, ru in _MATERIALS_TABLE_XLSX_COLUMN_PAIRS}
for _tag_en, _ru in _MATERIALS_TABLE_XLSX_COLUMN_PAIRS:
    _XLSX_NORM_TO_XML_TAG.setdefault(_norm_header(_tag_en), _tag_en)

# Старые подписи колонок (предыдущие выгрузки) — импорт без переделки файлов
_LEGACY_MATERIALS_TABLE_XLSX_HEADERS: list[tuple[str, str]] = [
    ("Sign", "Знак"),
    ("IsTape", "Лента"),
    ("Weight", "Вес"),
    ("Stretch", "Растяжение"),
    ("Retry", "Повтор"),
    ("Shiness", "Блеск"),
    ("Bright", "Яркость"),
    ("DX", "DX"),
    ("DY", "DY"),
    ("OffsetX", "Смещение X"),
    ("OffsetY", "Смещение Y"),
    ("Angle", "Угол"),
    ("Coef_Exc_Cutting", "Коэффициент исключения резки"),
    ("Round_Mode", "Режим округления"),
    ("Alt_Price", "Альтернативная цена"),
]
for _t, _ru in _LEGACY_MATERIALS_TABLE_XLSX_HEADERS:
    _XLSX_NORM_TO_XML_TAG.setdefault(_norm_header(_ru), _t)


def _materials_table_tag_defaults() -> dict[str, str]:
    """Полная строка полей таблицы: пустые / нули как в типовой выгрузке (123.xml)."""
    d: dict[str, str] = {tag: "" for tag, _ in _MATERIALS_TABLE_XLSX_COLUMN_PAIRS}
    d.update(
        {
            "Coef": "1",
            "Price": "0",
            "Length": "0",
            "Width": "0",
            "Thickness": "0",
            "Sign": "",
            "Overhang": "0",
            "Color": "0",
            "IsTape": "Y",
            "Weight": "0",
            "Stretch": "0",
            "Retry": "1",
            "Mirror": "0",
            "Transparent": "0",
            "Shiness": "0",
            "Bright": "0",
            "DX": "0",
            "DY": "0",
            "OffsetX": "150",
            "OffsetY": "150",
            "Angle": "0",
            "Coef_Exc_Cutting": "1",
            "Round_Mode": ".1",
            "Alt_Price": "0",
            "Color_RGB": "(0, 0, 0)",
            "Color_HEX": "000000",
            "NoAvailable": "N",
        }
    )
    return d


_MATERIALS_TABLE_TAG_DEFAULTS = _materials_table_tag_defaults()

# Доп. варианты заголовков
for _alias, _internal in list(_HEADER_ALIASES.items()):
    if _alias in _XLSX_NORM_TO_XML_TAG:
        continue
    if _internal == "note":
        _XLSX_NORM_TO_XML_TAG.setdefault(_alias, "Comment")
    elif _internal == "texture_path":
        _XLSX_NORM_TO_XML_TAG.setdefault(_alias, "Texture")
    elif _internal == "class_text":
        _XLSX_NORM_TO_XML_TAG.setdefault(_alias, "Class")
    elif _internal == "external_id":
        _XLSX_NORM_TO_XML_TAG.setdefault(_alias, "Sync_External")
    elif _internal == "no_available":
        _XLSX_NORM_TO_XML_TAG.setdefault(_alias, "NoAvailable")
_XLSX_NORM_TO_XML_TAG.setdefault("istape", "IsTape")
_XLSX_NORM_TO_XML_TAG.setdefault("цвет (hex)", "Color_HEX")
_XLSX_NORM_TO_XML_TAG.setdefault("цвет (rgb)", "Color_RGB")


@dataclass
class MaterialsTableRow:
    article: str = ""
    name: str = ""
    group_path: str = ""
    group_code: str = ""
    uom_label: str = ""
    price: Decimal = field(default_factory=lambda: Decimal("0"))
    length: Decimal = field(default_factory=lambda: Decimal("0"))
    width: Decimal = field(default_factory=lambda: Decimal("0"))
    thickness: Decimal = field(default_factory=lambda: Decimal("0"))
    note: str = ""
    texture_path: str = ""
    class_text: str = ""
    external_id: str = ""
    color_hex: str = ""
    no_available: bool | None = None
    rounding_label: str = ""


def _xml_local_tag(el: ET.Element) -> str:
    t = el.tag
    return t.split("}")[-1] if "}" in t else t


def xml_material_to_canonical(mat_el: ET.Element) -> dict[str, str]:
    out: dict[str, str] = {}
    for el in mat_el:
        tag = _xml_local_tag(el)
        out[tag] = (el.text or "").strip()
    return out


def iter_materials_table_xml_dicts(fileobj: BinaryIO) -> list[dict[str, str]]:
    from defusedxml.ElementTree import parse as safe_parse

    tree = safe_parse(fileobj)
    root = tree.getroot()
    rows: list[dict[str, str]] = []
    for mat in root.iter():
        if not mat.tag.endswith("Material"):
            continue
        canon = xml_material_to_canonical(mat)
        if canon.get("Name") or canon.get("Article"):
            rows.append(canon)
    return rows


def xlsx_row_to_canonical(headers: list[str], cells: list[str | None]) -> dict[str, str]:
    canon: dict[str, str] = {}
    for i, h in enumerate(headers):
        raw_h = str(h or "").strip()
        if not raw_h:
            continue
        nh = _norm_header(raw_h)
        tag = _XLSX_NORM_TO_XML_TAG.get(nh) or _XLSX_NORM_TO_XML_TAG.get(_norm_header(raw_h))
        if not tag:
            tag = _HEADER_ALIASES.get(nh)
            if tag == "article":
                tag = "Article"
            elif tag == "name":
                tag = "Name"
            elif tag == "group_path":
                tag = "Group_Name"
            elif tag == "group_code":
                tag = "Group_Code"
            elif tag == "uom":
                tag = "Unit_Measure"
            elif tag == "price":
                tag = "Price"
            elif tag == "length":
                tag = "Length"
            elif tag == "width":
                tag = "Width"
            elif tag == "thickness":
                tag = "Thickness"
            elif tag == "note":
                tag = "Comment"
            elif tag == "texture_path":
                tag = "Texture"
            elif tag == "class_text":
                tag = "Class"
            elif tag == "external_id":
                tag = "Sync_External"
            elif tag == "color_hex":
                tag = "Color_HEX"
            elif tag == "color_rgb":
                tag = "Color_RGB"
            elif tag == "color_int":
                tag = "Color"
            elif tag == "no_available":
                tag = "NoAvailable"
        val = ""
        if i < len(cells) and cells[i] is not None:
            val = str(cells[i]).strip()
        if tag:
            canon[tag] = val
        else:
            canon[f"__{raw_h}"] = val
    return canon


def materials_table_row_from_canonical(c: dict[str, str]) -> MaterialsTableRow:
    r = MaterialsTableRow()
    r.article = (c.get("Article") or "").strip()
    r.name = (c.get("Name") or "").strip()
    r.group_path = (c.get("Group_Name") or "").strip()
    r.group_code = (c.get("Group_Code") or "").strip()
    r.uom_label = (c.get("Unit_Measure") or "").strip()
    r.price = _dec(c.get("Price"))
    r.length = _dec(c.get("Length"))
    r.width = _dec(c.get("Width"))
    r.thickness = _dec(c.get("Thickness"))
    r.note = (c.get("Comment") or "").strip()
    r.texture_path = (c.get("Texture") or "").strip().replace("\\\\", "\\")
    r.class_text = (c.get("Class") or "").strip()
    r.external_id = (c.get("Sync_External") or "").strip()
    ch = c.get("Color_HEX") or ""
    r.color_hex = _hex_color(ch)
    if not r.color_hex:
        raw_c = (c.get("Color") or "").strip()
        if raw_c:
            r.color_hex = _hex_color(raw_c) or _hex_from_color_int_cell(raw_c)
    if not r.color_hex:
        r.color_hex = _hex_from_rgb_string(c.get("Color_RGB") or c.get("ColorRGB"))
    na_raw = c.get("NoAvailable") or ""
    if na_raw:
        r.no_available = _parse_boolish(na_raw)
    r.rounding_label = (c.get("Round_Mode") or "").strip()
    return r


def _category_export_path(cat: MaterialCategory | None) -> str:
    if cat is None:
        return ""
    parts: list[str] = [cat.name]
    p: MaterialCategory | None = cat.parent
    while p is not None:
        parts.append(p.name)
        p = p.parent
    return "/".join(reversed(parts))


def _snapshot_copy(c: dict[str, str]) -> dict[str, str]:
    return {str(k): ("" if v is None else str(v)) for k, v in c.items() if not isinstance(v, (dict, list))}


def _texture_item_by_exact_name(name: str) -> TextureItem | None:
    t = name.strip()
    if not t:
        return None
    return TextureItem.objects.filter(name__iexact=t).order_by("id").first()


def resolve_texture_item_from_import_label(texture_label: str) -> TextureItem | None:
    """
    Колонка «Текстура»: в типовых выгрузках — путь вида ``Modus\\инокс.jpg``.
    Полный путь не используем для сопоставления: берём только **имя файла без расширения**
    последнего сегмента (``инокс``), затем ``TextureItem.name`` с учётом **__iexact**.
    Если в ячейке только подпись без пути и точек (``инокс``), последний «сегмент» — всё содержимое,
    расширения нет — stem совпадает с именем. При нескольких совпадениях берётся меньший ``id``.
    """
    raw = (texture_label or "").strip()
    if not raw:
        return None
    norm = raw.replace("\\", "/")
    basename = Path(norm).name.strip()
    if not basename:
        return None
    stem_key = Path(basename).stem.strip()
    if not stem_key:
        return None
    return _texture_item_by_exact_name(stem_key)


def texture_path_hint_from_material_note(note: str) -> str:
    """В части Excel-выгрузок колонку «Текстура» не заполняют; путь в строке примечания («Текстура (импорт): …»)."""
    marker = "Текстура (импорт):"
    for raw in (note or "").replace("\r\n", "\n").split("\n"):
        line = raw.strip()
        if line.casefold().startswith(marker.casefold()):
            return line[len(marker) :].strip()
    return ""


def assign_material_texture_from_import_row(
    material: Material,
    *,
    texture_mode: str,
    resolved_library_texture: TextureItem | None,
) -> None:
    """Цвет против текстуры из базы: в режиме color — только заливка; texture — уже найденная TextureItem."""
    if texture_mode == "color":
        material.texture_item = None
        material.texture_image = None
        return
    if resolved_library_texture is None:
        material.texture_item = None
        return
    material.texture_item = resolved_library_texture
    material.texture_image = None


def _apply_canonical_texture_extras(material: Material, c: dict[str, str]) -> None:
    ox = c.get("OffsetX")
    if ox is not None and str(ox).strip() != "":
        material.tex_offset_x = _dec(ox)
    oy = c.get("OffsetY")
    if oy is not None and str(oy).strip() != "":
        material.tex_offset_y = _dec(oy)
    dx = c.get("DX")
    if dx is not None and str(dx).strip() != "" and _dec(dx) != 0:
        material.tex_step_x = _dec(dx)
    dy = c.get("DY")
    if dy is not None and str(dy).strip() != "" and _dec(dy) != 0:
        material.tex_step_y = _dec(dy)
    ang = c.get("Angle")
    if ang is not None and str(ang).strip() != "":
        material.tex_rotation_deg = _dec(ang)
    mir = c.get("Mirror")
    if mir is not None and str(mir).strip() != "":
        try:
            material.tex_mirror = _dec(mir) != 0
        except Exception:
            material.tex_mirror = str(mir).strip() not in ("0", "")
    br = c.get("Bright")
    if br is not None and str(br).strip() != "":
        try:
            b = float(str(br).replace(",", "."))
            material.tex_specular_brightness = Decimal(str(max(0.0, min(1.0, b))))
        except (ValueError, TypeError):
            pass


def _rounding_from_export_label(label: str) -> tuple[str, object]:
    t = (label or "").strip()
    if t in (".1", "", "-1"):
        return RoundingMode.NONE, None
    try:
        d = Decimal(t.replace(",", "."))
        if d > 0:
            return RoundingMode.CEIL_MULTIPLE, d
    except InvalidOperation:
        pass
    return RoundingMode.NONE, None


def apply_materials_table_row(
    r: MaterialsTableRow,
    *,
    stats: dict[str, int],
    errors: list[str],
    line_no: int,
    snapshot: dict[str, str] | None = None,
) -> None:
    if not r.name and not r.article:
        return
    segments = _split_group_path(r.group_path)
    if not segments:
        errors.append(f"Строка {line_no}: нет пути группы (папки)")
        stats["skipped"] = stats.get("skipped", 0) + 1
        return
    try:
        category = _ensure_category_path(segments)
    except Exception as e:  # noqa: BLE001
        errors.append(f"Строка {line_no}: папка — {e}")
        stats["skipped"] = stats.get("skipped", 0) + 1
        return

    uom = _resolve_uom(r.uom_label)
    is_active = True if r.no_available is None else (not r.no_available)

    note = r.note
    canon_src = snapshot if snapshot is not None else {}
    snap_store = _snapshot_copy(canon_src)

    texture_color = r.color_hex if r.color_hex else ""
    tex_path_trim = (r.texture_path or "").strip()
    if not tex_path_trim:
        tex_path_trim = texture_path_hint_from_material_note(note)
    resolved_library_texture: TextureItem | None = (
        resolve_texture_item_from_import_label(tex_path_trim) if tex_path_trim else None
    )
    if resolved_library_texture is not None:
        texture_mode = "texture"
    else:
        texture_mode = "color"

    rounding_mode, rounding_multiple = _rounding_from_export_label(r.rounding_label)

    article_clean = r.article.strip()

    with transaction.atomic():
        material: Material | None = None
        if article_clean:
            material = Material.objects.filter(article=article_clean).first()
        if material is None and not article_clean:
            material = Material.objects.filter(category=category, name=r.name.strip()).first()
        if material is None:
            material = Material(
                category=category,
                name=r.name.strip() or article_clean or "Без имени",
                article=article_clean,
                uom=uom,
                base_price=r.price,
                note=note,
                thickness=r.thickness,
                max_length=r.length,
                min_length=Decimal("0"),
                max_width=r.width,
                min_width=Decimal("0"),
                is_active=is_active,
                texture_mode=texture_mode,
                texture_color=texture_color or "",
                rounding_mode=rounding_mode,
                rounding_multiple=rounding_multiple,
                import_export_snapshot=snap_store,
            )
            if r.external_id:
                material.external_id = r.external_id[:64]
            assign_material_texture_from_import_row(
                material,
                texture_mode=texture_mode,
                resolved_library_texture=resolved_library_texture,
            )
            _apply_canonical_texture_extras(material, canon_src)
            try:
                material.save()
            except IntegrityError as e:
                raise ValueError(f"Конфликт уникальности (артикул или external_id): {e}") from e
            stats["created"] = stats.get("created", 0) + 1
        else:
            material.category = category
            material.name = r.name.strip() or material.name
            if article_clean:
                material.article = article_clean
            material.uom = uom
            material.base_price = r.price
            material.note = note
            material.thickness = r.thickness
            material.max_length = r.length
            material.max_width = r.width
            material.is_active = is_active
            material.texture_mode = texture_mode
            if texture_color:
                material.texture_color = texture_color
            material.rounding_mode = rounding_mode
            material.rounding_multiple = rounding_multiple
            material.import_export_snapshot = snap_store
            if r.external_id:
                material.external_id = r.external_id[:64]
            assign_material_texture_from_import_row(
                material,
                texture_mode=texture_mode,
                resolved_library_texture=resolved_library_texture,
            )
            _apply_canonical_texture_extras(material, canon_src)
            try:
                material.save()
            except IntegrityError as e:
                raise ValueError(f"Конфликт уникальности (артикул или external_id): {e}") from e
            stats["updated"] = stats.get("updated", 0) + 1

        # Классы: по токенам из class_text
        tokens = [t for t in re.split(r"\s+", r.class_text.strip()) if t]
        if tokens:
            ids: list[int] = []
            for tok in tokens:
                mc = MaterialClass.objects.filter(code__iexact=tok).first() or MaterialClass.objects.filter(
                    name__iexact=tok
                ).first()
                if mc:
                    ids.append(mc.id)
            if ids:
                material.material_classes.set(ids)


def _export_queryset(category_id: int | None = None):
    qs = (
        Material.objects.all()
        .select_related("category", "uom", "texture_item")
        .prefetch_related("material_classes")
        .order_by("category_id", "name")
    )
    if category_id is None:
        return qs
    ids = {category_id}
    stack = [category_id]
    while stack:
        cid = stack.pop()
        for ch in MaterialCategory.objects.filter(parent_id=cid).values_list("id", flat=True):
            if ch not in ids:
                ids.add(ch)
                stack.append(ch)
    return qs.filter(category_id__in=ids)


def material_to_export_canon(m: Material) -> dict[str, str]:
    schema_tags = [tag for tag, _ in _MATERIALS_TABLE_XLSX_COLUMN_PAIRS]
    out: dict[str, str] = {tag: _MATERIALS_TABLE_TAG_DEFAULTS[tag] for tag in schema_tags}
    snap = m.import_export_snapshot if isinstance(m.import_export_snapshot, dict) else {}
    for k, v in snap.items():
        sk = str(k)
        if isinstance(v, (dict, list)):
            continue
        if sk.startswith("__"):
            out[sk] = "" if v is None else str(v)
            continue
        if sk in out:
            out[sk] = "" if v is None else str(v)

    cat = m.category
    out["Article"] = m.article or ""
    out["Name"] = m.name or ""
    out["Group_Name"] = _category_export_path(cat)
    out["Group_Code"] = str(m.category_id) if m.category_id else ""
    if m.uom_id and m.uom:
        out["Unit_Measure"] = (m.uom.short_name or m.uom.name or "")[:32]
    out["Price"] = str(float(m.base_price)).replace(",", ".")
    out["Length"] = str(float(m.max_length)).replace(",", ".")
    out["Width"] = str(float(m.max_width)).replace(",", ".")
    out["Thickness"] = str(float(m.thickness)).replace(",", ".")
    out["Comment"] = m.note or ""
    out["Class"] = " ".join((c.code or c.name) for c in m.material_classes.all())
    out["NoAvailable"] = "N" if m.is_active else "Y"
    out["Sync_External"] = m.external_id or ""
    if m.texture_mode == "texture":
        if m.texture_item_id and getattr(m, "texture_item", None):
            out["Texture"] = (m.texture_item.name or "").strip()
        else:
            tpath = (snap.get("Texture") or "").strip()
            out["Texture"] = tpath
    else:
        out["Texture"] = ""

    hx = (m.texture_color or "").replace("#", "").strip().upper()
    if len(hx) == 6 and re.fullmatch(r"[0-9A-F]{6}", hx):
        out["Color_HEX"] = hx
        r_i = int(hx[0:2], 16)
        g_i = int(hx[2:4], 16)
        b_i = int(hx[4:6], 16)
        out["Color_RGB"] = f"({r_i}, {g_i}, {b_i})"
        out["Color"] = str(b_i | (g_i << 8) | (r_i << 16))
    elif m.texture_mode == "color" and not hx:
        out["Color"] = "-1"
        out["Color_RGB"] = "(0, 0, 0)"
        out["Color_HEX"] = "000000"

    if m.rounding_mode == RoundingMode.CEIL_MULTIPLE and m.rounding_multiple is not None:
        out["Round_Mode"] = str(m.rounding_multiple).replace(",", ".")
    elif not (out.get("Round_Mode") or "").strip():
        out["Round_Mode"] = ".1"

    out["OffsetX"] = str(float(m.tex_offset_x)).replace(",", ".")
    out["OffsetY"] = str(float(m.tex_offset_y)).replace(",", ".")
    out["DX"] = str(float(m.tex_step_x)).replace(",", ".")
    out["DY"] = str(float(m.tex_step_y)).replace(",", ".")
    out["Angle"] = str(float(m.tex_rotation_deg)).replace(",", ".")
    if m.tex_mirror:
        out["Mirror"] = (snap.get("Mirror") or "").strip() or "1"
    else:
        mv = (snap.get("Mirror") or "").strip()
        out["Mirror"] = mv if mv else "0"
    out["Bright"] = str(float(m.tex_specular_brightness)).replace(",", ".")
    return out


def _extra_xlsx_keys_union(qs) -> list[str]:
    keys: set[str] = set()
    for m in qs:
        snap = m.import_export_snapshot if isinstance(m.import_export_snapshot, dict) else {}
        for k in snap:
            if str(k).startswith("__"):
                keys.add(str(k))
    return sorted(keys)


def import_materials_table_file(
    upload,
    *,
    filename: str,
) -> tuple[dict[str, int], list[str]]:
    name = (filename or "").lower()
    stats: dict[str, int] = {"created": 0, "updated": 0, "skipped": 0}
    errors: list[str] = []
    canon_rows: list[dict[str, str]] = []

    if name.endswith(".xml"):
        upload.seek(0)
        canon_rows = iter_materials_table_xml_dicts(upload)
    elif name.endswith(".xlsx"):
        upload.seek(0)
        data = upload.read()
        headers, data_rows = _xlsx_rows_from_bytes(data)
        if not data_rows:
            errors.append("В XLSX нет строк данных.")
            return stats, errors
        colmap = _map_headers(headers)
        if "name" not in colmap and "group_path" not in colmap:
            errors.append(
                "Не удалось сопоставить колонки XLSX. Нужны «Наименование материала» и «Наименование группы»."
            )
            return stats, errors
        for cells in data_rows:
            canon_rows.append(xlsx_row_to_canonical(headers, cells))
    else:
        errors.append("Поддерживаются файлы .xml и .xlsx")
        return stats, errors

    start_line = 2 if name.endswith(".xlsx") else 1
    for i, canon in enumerate(canon_rows, start=start_line):
        r = materials_table_row_from_canonical(canon)
        try:
            apply_materials_table_row(r, stats=stats, errors=errors, line_no=i, snapshot=canon)
        except Exception as e:  # noqa: BLE001
            errors.append(f"Строка {i}: {e}")
            stats["skipped"] = stats.get("skipped", 0) + 1
    return stats, errors


def build_export_xlsx_bytes(category_id: int | None = None) -> bytes:
    from openpyxl import Workbook
    from openpyxl.styles import Font

    qs = _export_queryset(category_id)
    extra_keys = _extra_xlsx_keys_union(qs)
    headers = list(EXPORT_XLSX_HEADERS) + [k[2:] if k.startswith("__") else k for k in extra_keys]
    _xlsx_numeric_tags = {
        "Price",
        "Coef",
        "Length",
        "Width",
        "Thickness",
        "Overhang",
        "Weight",
        "Stretch",
        "Retry",
        "Mirror",
        "Transparent",
        "Shiness",
        "Bright",
        "DX",
        "DY",
        "OffsetX",
        "OffsetY",
        "Angle",
        "Coef_Exc_Cutting",
        "Alt_Price",
    }

    wb = Workbook()
    ws = wb.active
    ws.title = "Materials"
    ws.append(headers)
    for cell in ws[1]:
        cell.font = Font(bold=True)

    for m in qs:
        rowd = material_to_export_canon(m)
        row_out: list[str | float | bool] = []
        for tag, _ru in _MATERIALS_TABLE_XLSX_COLUMN_PAIRS:
            if tag == "NoAvailable":
                row_out.append(bool(not m.is_active))
                continue
            if tag == "IsTape":
                tb = _parse_boolish(rowd.get("IsTape", "Y"))
                row_out.append(bool(True if tb is None else tb))
                continue
            v = rowd.get(tag, "")
            if tag in _xlsx_numeric_tags and str(v).strip() != "":
                try:
                    row_out.append(float(str(v).replace(",", ".")))
                    continue
                except ValueError:
                    pass
            row_out.append(v)
        for ek in extra_keys:
            row_out.append(rowd.get(ek, ""))
        ws.append(row_out)
    bio = BytesIO()
    wb.save(bio)
    return bio.getvalue()


def build_export_xml_bytes(category_id: int | None = None) -> bytes:
    qs = _export_queryset(category_id)
    root = ET.Element("Database")
    mats = ET.SubElement(root, "Materials")
    for m in qs:
        rowd = material_to_export_canon(m)
        mel = ET.SubElement(mats, "Material")
        for tag in MATERIALS_TABLE_XML_ELEMENT_ORDER:
            el = ET.SubElement(mel, tag)
            t = rowd.get(tag, "")
            el.text = t if t else None
    return ET.tostring(root, encoding="utf-8", xml_declaration=True)
