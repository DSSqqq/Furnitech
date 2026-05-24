export type RoundingMode = 'none' | 'ceil_unit' | 'ceil_multiple'

/** Папки справочника классов материалов (отдельно от категорий номенклатуры). */
export type MaterialClassCategory = {
  id: number
  parent: number | null
  name: string
  code: string
  sort_order: number
  path: string
  children?: MaterialClassCategory[]
}

export type MaterialClass = {
  id: number
  category: number
  name: string
  code: string
  external_id: string | null
}

/** Папки списка формул расчёта (структура как у папок классов). */
export type CalculationFormulaCategory = {
  id: number
  parent: number | null
  name: string
  code: string
  sort_order: number
  path: string
  children?: CalculationFormulaCategory[]
}

export type CalculationFormulaToken =
  | { type: 'class'; class_id: number; label?: string }
  | { type: 'op'; value: '+' | '-' | '*' | '/' | '(' | ')' | '=' }
  | { type: 'number'; value: string }

export type CalculationFormula = {
  id: number
  category: number
  name: string
  expression: string
  tokens: CalculationFormulaToken[]
  is_active: boolean
  sort_order: number
  created_at?: string
  updated_at?: string
}

export type UnitOfMeasure = {
  id: number
  name: string
  short_name: string
  code: string | null
}

export type MaterialCategory = {
  id: number
  parent: number | null
  name: string
  code: string
  sort_order: number
  path: string
  children?: MaterialCategory[]
}

/** Дерево папок базы текстур (тот же контракт, что у категорий материалов). */
export type TextureCategory = MaterialCategory

export type TextureItem = {
  id: number
  category: number
  name: string
  image: string | null
  created_at?: string
  updated_at?: string
}

/** Как строка сопутствующего масштабируется в калькуляторе (см. docs/ARCHITECTURE). */
export type RelatedQuantityScale = 'follow_parent' | 'per_facade' | 'use_related_uom'

export type MaterialRelatedItemDto = {
  id: number
  related_material_id: number
  related_material: {
    id: number
    name: string
    article?: string
    uom: UnitOfMeasure
    base_price: string
    base_currency: string
    material_class_ids?: number[]
    pricing_calc_mode?: PricingCalcMode
    excess_coefficient?: string
  }
  quantity: string
  /** Режим расчёта; по умолчанию как раньше — follow_parent. */
  quantity_scale?: RelatedQuantityScale
  line_total: string
}

export type PricingCalcMode = '' | 'linear' | 'sheet' | 'piece'

export type Material = {
  id: number
  category: number
  name: string
  /** Артикул / внутр. код (сопоставление с учётом, 1С в т.ч.) */
  article?: string
  material_class_ids: number[]
  uom: UnitOfMeasure
  uom_id: number
  base_currency: string
  base_price: string
  /** Доп. параметры для будущего калькулятора. */
  thickness?: string
  min_length?: string
  max_length?: string
  min_width?: string
  max_width?: string
  /** Режим расчёта: погонаж / лист / штуки (взаимоисключающий). */
  pricing_calc_mode?: PricingCalcMode
  /** Текстура/цвет (параметры отображения в будущих эскизах). */
  texture_mode?: 'color' | 'texture' | string
  texture_color?: string
  texture_image?: string | null
  /** Ссылка на запись в базе текстур; URL картинки в `texture_image` при ответе API. */
  texture_library_item?: number | null
  texture_library_item_name?: string | null
  tex_offset_x?: string
  tex_offset_y?: string
  tex_step_x?: string
  tex_step_y?: string
  tex_opacity?: string
  tex_mirror?: boolean
  tex_specular_sharpness?: string
  tex_specular_brightness?: string
  tex_rotation_deg?: string
  related_items?: MaterialRelatedItemDto[]
  note: string
  rounding_mode: RoundingMode
  rounding_multiple: string | null
  /** Множитель к рассчитанному количеству (1 — без запаса). */
  excess_coefficient?: string
  is_active: boolean
  external_id: string | null
}

export type CalculatorProfileColorDto = {
  id: number
  color_material_id: number
  color_material: {
    id: number
    name: string
    article?: string
    uom: UnitOfMeasure
    base_price: string
    base_currency: string
    texture_mode?: 'color' | 'texture' | string
    texture_color?: string
    texture_image?: string | null
    texture_library_item?: number | null
    texture_library_item_name?: string | null
  }
}

export type CalculatorProfile = {
  id: number
  material: number
  material_summary: {
    id: number
    name: string
    article?: string
    uom: UnitOfMeasure
    base_price: string
    base_currency: string
    texture_mode?: 'color' | 'texture' | string
    texture_color?: string
    texture_image?: string | null
    texture_library_item?: number | null
    texture_library_item_name?: string | null
  } | null
  is_active: boolean
  sort_order: number
  colors: CalculatorProfileColorDto[]
  created_at: string
  updated_at: string
}

export type CalculatorProfileTypeColorDto = {
  id: number
  color_material_id: number
  color_material: {
    id: number
    name: string
    article?: string
    uom: UnitOfMeasure
    base_price: string
    base_currency: string
    texture_mode?: 'color' | 'texture' | string
    texture_color?: string
    texture_image?: string | null
    texture_library_item?: number | null
    texture_library_item_name?: string | null
  }
  is_new: boolean
  is_hit: boolean
  is_sale: boolean
}

export type CalculatorProfileType = {
  id: number
  name: string
  image_url: string
  /** Загруженный файл (URL с бэкенда, обычно /media/...) */
  card_image?: string | null
  card_image_2?: string | null
  card_image_3?: string | null
  card_image_4?: string | null
  is_active: boolean
  sort_order: number
  colors: CalculatorProfileTypeColorDto[]
  created_at: string
  updated_at: string
}

export type CalculatorFillingTypeMaterialDto = {
  id: number
  material_id: number
  material: {
    id: number
    name: string
    article?: string
    uom: UnitOfMeasure
    base_price: string
    base_currency: string
    texture_mode?: 'color' | 'texture' | string
    texture_color?: string
    texture_image?: string | null
    texture_library_item?: number | null
    texture_library_item_name?: string | null
  }
}

export type CalculatorFillingType = {
  id: number
  name: string
  image_url: string
  card_image?: string | null
  card_image_2?: string | null
  card_image_3?: string | null
  card_image_4?: string | null
  is_active: boolean
  sort_order: number
  materials: CalculatorFillingTypeMaterialDto[]
  created_at: string
  updated_at: string
}

/** Каталог петель (шаг присадки): та же форма, что у типов наполнения. */
export type CalculatorHingeTypeMaterialDto = CalculatorFillingTypeMaterialDto
export type CalculatorHingeType = {
  id: number
  name: string
  image_url: string
  card_image?: string | null
  card_image_2?: string | null
  card_image_3?: string | null
  card_image_4?: string | null
  is_active: boolean
  sort_order: number
  materials: CalculatorHingeTypeMaterialDto[]
  created_at: string
  updated_at: string
}

/** Справочник d для шага 7 (публичный GET — только строки с client_visible). */
export type CalculatorHandleHoleDiameter = {
  id: number
  diameter_mm: number
  client_visible: boolean
  sort_order: number
  created_at: string
  updated_at: string
}
