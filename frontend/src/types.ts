export type RoundingMode = 'none' | 'ceil_unit' | 'ceil_multiple'

export type MaterialClass = {
  id: number
  name: string
  code: string
  external_id: string | null
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
  }
  quantity: string
  /** Режим расчёта; по умолчанию как раньше — follow_parent. */
  quantity_scale?: RelatedQuantityScale
  line_total: string
}

export type MaterialOperationLineDto = {
  id: number
  name: string
  model_parameter: string
  quantity: string
  uom_id: number | null
  uom: UnitOfMeasure | null
  price: string
  /** Если true — сумма строки умножается на количество фасадов в калькуляторе. */
  price_per_facade?: boolean
}

export type Material = {
  id: number
  category: number
  name: string
  /** Артикул / внутр. код (сопоставление с учётом, 1С в т.ч.) */
  article?: string
  material_class_ids: number[]
  fnp_name: string
  uom: UnitOfMeasure
  uom_id: number
  unit_mass: string
  base_currency: string
  base_price: string
  /** Доп. параметры для будущего калькулятора. */
  thickness?: string
  min_length?: string
  max_length?: string
  min_width?: string
  max_width?: string
  designation?: string
  cut_coeff?: string
  calc_type?: string
  /** Текстура/цвет (параметры отображения в будущих эскизах). */
  texture_mode?: 'color' | 'texture' | string
  texture_color?: string
  texture_image?: string | null
  tex_offset_x?: string
  tex_offset_y?: string
  tex_step_x?: string
  tex_step_y?: string
  tex_opacity?: string
  tex_mirror?: boolean
  tex_specular_sharpness?: string
  tex_specular_brightness?: string
  tex_rotation_deg?: string
  /** Сохранённые цены в каждой выбранной альтернативной валюте. */
  alt_prices?: { currency: string; price: string }[]
  related_items?: MaterialRelatedItemDto[]
  operation_lines?: MaterialOperationLineDto[]
  note: string
  rounding_mode: RoundingMode
  rounding_multiple: string | null
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
  }
}

export type CalculatorFillingType = {
  id: number
  name: string
  image_url: string
  card_image?: string | null
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
