# Импорт и экспорт каталога материалов (таблица XLSX и XML)

Обмен **XLSX** и **XML** в формате `Database/Materials/Material` и типовой таблицы Excel (русские заголовки колонок), совместимый с типовыми выгрузками каталога номенклатуры из учётных систем.

## Код и точки входа

| Компонент | Путь |
|-----------|------|
| Логика парсинга, сборки файлов, сопоставления колонок | `backend/materials/material_import_export.py` |
| HTTP: права, обработчики | `backend/materials/views.py` (`export_materials_table`, `import_materials_table`) |
| Регистрация URL **до** `include(materials.urls)` | `backend/config/urls.py` — `api/materials-export/`, `api/materials-import/` |
| Клиент SPA | `frontend/src/api.ts` — `downloadMaterialsExport`, `importMaterialsTable` |
| Снимок полной строки таблицы на карточке | `Material.import_export_snapshot` (`JSONField`) |

## HTTP API

### Экспорт

- **URL:** `GET /api/materials-export/`
- **Авторизация:** JWT; **`MaterialExportPermission`** (staff или права `view`/`change`/`add` на `Material`).
- **Query:**
  - **`export_format`** — `xlsx` (по умолчанию) или `xml`.  
    **Важно:** не использовать **`format=`** — в DRF это зарезервировано и может дать **404** (см. `URL_FORMAT_OVERRIDE`).
  - **`category`** — необязательный id папки (`MaterialCategory`); в выборку входят материалы этой папки и **вложенных** папок.

**Ответ:** файл `materials-catalog.xlsx` или `materials-catalog.xml`.

### Импорт

- **URL:** `POST /api/materials-import/`
- **Тело:** `multipart/form-data`, поле **`file`** — `.xlsx` или `.xml`.
- **Авторизация:** **`MaterialImportPermission`**.
- **Ответ JSON:** `created`, `updated`, `skipped`, `errors`.

## XML

- Корень: `<Database><Materials>`, строка — `<Material>`.
- Имена элементов — как в типовой схеме: `Article`, `Name`, `Group_Name`, …
- **`Group_Code` в XML нет** (только в Excel).
- Порядок тегов: **`MATERIALS_TABLE_XML_ELEMENT_ORDER`** в `material_import_export.py` (в XML сначала `DX`/`DY`, затем `OffsetX`/`OffsetY` — в Excel колонки в другом порядке).

## XLSX

Константы: **`_MATERIALS_TABLE_XLSX_COLUMN_PAIRS`**, **`EXPORT_XLSX_HEADERS`** (русские подписи в порядке колонок).

| № | Заголовок в файле | Внутренний тег |
|---|-------------------|----------------|
| 1 | Артикул материала | Article |
| 2 | Наименование материала | Name |
| 3 | Номер группы | Group_Code |
| 4 | Наименование группы | Group_Name |
| 5 | Единица измерения | Unit_Measure |
| 6 | Стоимость | Price |
| 7 | Коэффициент | Coef |
| 8 | Длина | Length |
| 9 | Ширина | Width |
| 10 | Толщина | Thickness |
| 11 | Обозначение | Sign |
| 12 | Свес | Overhang |
| 13 | Цвет (целое число) | Color |
| 14 | Текстура | Texture |
| 15 | Класс | Class |
| 16 | Тип материала | IsTape |
| 17 | Идентификатор для синхронизации | Sync_External |
| 18 | Масса | Weight |
| 19 | Примечание | Comment |
| 20 | Нет в наличии | NoAvailable |
| 21 | Растянуть | Stretch |
| 22 | Зеркально | Retry |
| 23 | Зеркальность | Mirror |
| 24 | Прозрачность | Transparent |
| 25 | Резкость блика | Shiness |
| 26 | Яркость блика | Bright |
| 27 | Смещение по X | OffsetX |
| 28 | Смещение по Y | OffsetY |
| 29 | Шаг по Х | DX |
| 30 | Шаг по Y | DY |
| 31 | Угол поворота | Angle |
| 32 | Коэффициент избытка с учетом раскроя | Coef_Exc_Cutting |
| 33 | Способ округления | Round_Mode |
| 34 | Цена в альтернативной валюте | Alt_Price |
| 35 | Цвет (RGB) | Color_RGB |
| 36 | Цвет (HEX) | Color_HEX |

В Excel порядок «смещения» раньше «шагов», чем в XML.

- Логические: **«Нет в наличии»**, **«Тип материала»** — boolean (`t="b"`); в русской локали Excel — ИСТИНА/ЛОЖЬ.
- Числовые поля при экспорте: **`_xlsx_numeric_tags`** в **`build_export_xlsx_bytes`**.

## Импорт в модель

- Папка из **`Group_Name`**, нормализация сегментов пути.
- Поиск материала: артикул или папка + имя.
- Полный канон строки → **`import_export_snapshot`** для кругового экспорта.
- Алиасы старых русских заголовков: **`_LEGACY_MATERIALS_TABLE_XLSX_HEADERS`**.

## Дефолты

**`_materials_table_tag_defaults`** / **`_MATERIALS_TABLE_TAG_DEFAULTS`**; перекрытие в **`material_to_export_canon`**.

## Зависимости

- Экспорт XLSX: **`openpyxl`**.
- Импорт XLSX: разбор OOXML без openpyxl.

## Фронтенд

```ts
downloadMaterialsExport(categoryId, 'xlsx' | 'xml')
importMaterialsTable(file) // POST /api/materials-import/
```

## См. также

- [ARCHITECTURE.md](ARCHITECTURE.md)
- **`MaterialExportPermission`**, **`MaterialImportPermission`** в `materials/views.py`.
