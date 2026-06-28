import { useState, type RefObject, type ChangeEvent } from 'react'

import type { Material } from '../types'

import { MaterialCheckSwatch } from './MaterialCheckSwatch'

import { materialTextureLabel, type MaterialTextureFields } from './materialTextureLabel'

import {

  CALC_CARD_IMAGE_SLOT_COUNT,

  CardImageChecklist,

  PROFILE_CARD_IMAGE_SLOT_COUNT,

} from './calculatorCardTiles'

import { MaterialColorFlagsGear, type ProfileColorFlags } from './materialColorFlagsGear'



export type { ProfileColorFlags }



export type ProfileColorEntry = ProfileColorFlags & { is_active: boolean }



export type AttachedMaterialEntry = { is_active: boolean }



export function defaultProfileColorEntry(): ProfileColorEntry {

  return { is_active: true, is_new: false, is_hit: false, is_sale: false }

}



export function defaultAttachedMaterialEntry(): AttachedMaterialEntry {

  return { is_active: true }

}



export function isAttachedEntryActive(entry: { is_active?: boolean } | undefined): boolean {

  return entry?.is_active !== false

}



export function activeAttachedRows<T extends { is_active?: boolean }>(rows: T[] | undefined | null): T[] {

  return (rows ?? []).filter((r) => r.is_active !== false)

}



const CHECKLIST_TEXT_MAX = 10



function truncateChecklistText(text: string, maxLen = CHECKLIST_TEXT_MAX): string {

  return text.length > maxLen ? `${text.slice(0, maxLen)}...` : text

}



function matLabel(m: MaterialTextureFields & { article?: string | null }) {

  const a = (m.article ?? '').trim()

  const lab = materialTextureLabel(m)

  return a ? `${lab} (${a})` : lab

}



export type MaterialTypeFormGridProps = {

  idPrefix: string

  typeBlockTitle: string

  typeName: string

  onTypeNameChange: (value: string) => void

  namePlaceholder: string

  cardImageLabel: string

  cardTileUrls: readonly string[]

  onAddCardImage: () => void

  onRemoveCardImage: (slot: number) => void

  onReplaceCardImage: (slot: number) => void

  cardFileInputRef: RefObject<HTMLInputElement | null>

  onCardFileInputChange: (e: ChangeEvent<HTMLInputElement>) => void

  materialsBlockTitle: string

  materialsListLabel: string

  onOpenMaterialSearch: () => void

  materialsHit: Material[]

  selectedMaterials: Record<number, AttachedMaterialEntry>

  onToggleMaterialActive: (materialId: number) => void

  onRemoveMaterial: (materialId: number) => void

  texByMaterialId: Record<number, { texture_mode?: string; texture_color?: string; texture_image?: string | null; texture_library_item_name?: string | null; name?: string }>

}



export function MaterialTypeFormGrid({

  idPrefix,

  typeBlockTitle,

  typeName,

  onTypeNameChange,

  namePlaceholder,

  cardImageLabel,

  cardTileUrls,

  onAddCardImage,

  onRemoveCardImage,

  onReplaceCardImage,

  cardFileInputRef,

  onCardFileInputChange,

  materialsBlockTitle,

  materialsListLabel,

  onOpenMaterialSearch,

  materialsHit,

  selectedMaterials,

  onToggleMaterialActive,

  onRemoveMaterial,

  texByMaterialId,

}: MaterialTypeFormGridProps) {

  return (

    <>

      <div className="calculator-type-form-modal-name-row">

        <input

          className="admin-input"

          value={typeName}

          onChange={(e) => onTypeNameChange(e.target.value)}

          placeholder={namePlaceholder}

        />

      </div>

      <div className="frame2-create-grid frame2-create-grid--file-status-pair frame2-create-grid--profile-type-slim calculator-type-form-grid">

      <div className="frame2-block frame2-create-tl calculator-type-form-section calculator-type-form-section--images">

        <div className="frame2-block-title">{typeBlockTitle}</div>

        <CardImageChecklist

          idPrefix={idPrefix}

          label={cardImageLabel}

          urls={cardTileUrls}

          maxSlots={CALC_CARD_IMAGE_SLOT_COUNT}

          onAdd={onAddCardImage}

          onRemove={onRemoveCardImage}

          onReplace={onReplaceCardImage}

          fileInputRef={cardFileInputRef}

          onFileInputChange={onCardFileInputChange}

        />

      </div>



      <div className="frame2-block frame2-create-tr calculator-type-form-section calculator-type-form-section--materials">

        <div className="frame2-block-title">{materialsBlockTitle}</div>

        <div className="calculator-type-form-materials-toolbar">

          <div className="frame2-file-row frame2-colors-for-card-label">

            <div className="frame2-file-label-row">

              <span className="frame2-file-label">{materialsListLabel}</span>

            </div>

          </div>

          <div className="frame2-material-search-row">

            <button type="button" className="admin-secondary frame2-material-tree-search-btn" onClick={onOpenMaterialSearch}>

              Добавить

            </button>

          </div>

        </div>

        {materialsHit.length > 0 && (

          <ul className="frame2-checklist">

            {materialsHit.map((m) => {

              const attached = selectedMaterials[m.id] != null

              if (!attached) return null

              const checked = isAttachedEntryActive(selectedMaterials[m.id])

              const articleFull = m.article || '—'

              const nameFull = materialTextureLabel(m)

              return (

                <li key={m.id}>

                  <div

                    className={[

                      'frame2-checkrow',

                      checked ? 'frame2-checkrow--checked' : 'frame2-checkrow--inactive',

                    ]

                      .filter(Boolean)

                      .join(' ')}

                    title={matLabel(m)}

                  >

                    <input

                      type="checkbox"

                      checked={checked}

                      onChange={() => onToggleMaterialActive(m.id)}

                    />

                    <MaterialCheckSwatch name={nameFull} material={m} texExtra={texByMaterialId[m.id]} />

                    <span className="frame2-check-article" title={articleFull}>

                      {truncateChecklistText(articleFull)}

                    </span>

                    <span className="frame2-check-name-wrap">

                      <span className="frame2-check-name" title={nameFull}>

                        {truncateChecklistText(nameFull)}

                      </span>

                    </span>

                    <button

                      type="button"

                      className="calculator-type-form-card-image-remove admin-primary"

                      aria-label={`Удалить ${matLabel(m)}`}

                      title={`Удалить ${matLabel(m)}`}

                      onClick={() => onRemoveMaterial(m.id)}

                    >

                      Удалить

                    </button>

                  </div>

                </li>

              )

            })}

          </ul>

        )}

        {Object.values(selectedMaterials).some(isAttachedEntryActive) && (

          <div className="admin-muted">

            Активных материалов: {Object.values(selectedMaterials).filter(isAttachedEntryActive).length}

          </div>

        )}

      </div>

    </div>

    </>

  )

}



export type ProfileTypeFormGridProps = {

  idPrefix: string

  typeName: string

  onTypeNameChange: (value: string) => void

  namePlaceholder: string

  cardImageLabel: string

  cardTileUrls: readonly string[]

  onAddCardImage: () => void

  onRemoveCardImage: (slot: number) => void

  onReplaceCardImage: (slot: number) => void

  cardFileInputRef: RefObject<HTMLInputElement | null>

  onCardFileInputChange: (e: ChangeEvent<HTMLInputElement>) => void

  onOpenMaterialSearch: () => void

  colorsHit: Material[]

  selectedColors: Record<number, ProfileColorEntry>

  onToggleColorActive: (materialId: number) => void

  onRemoveColor: (materialId: number) => void

  onToggleColorFlag: (materialId: number, flag: keyof ProfileColorFlags) => void

  texByMaterialId: Record<number, { texture_mode?: string; texture_color?: string; texture_image?: string | null; texture_library_item_name?: string | null; name?: string }>

}



export function ProfileTypeFormGrid({

  idPrefix,

  typeName,

  onTypeNameChange,

  namePlaceholder,

  cardImageLabel,

  cardTileUrls,

  onAddCardImage,

  onRemoveCardImage,

  onReplaceCardImage,

  cardFileInputRef,

  onCardFileInputChange,

  onOpenMaterialSearch,

  colorsHit,

  selectedColors,

  onToggleColorActive,

  onRemoveColor,

  onToggleColorFlag,

  texByMaterialId,

}: ProfileTypeFormGridProps) {

  const [openFlagsMaterialId, setOpenFlagsMaterialId] = useState<number | null>(null)



  return (

    <>

      <div className="calculator-type-form-modal-name-row">

        <input

          className="admin-input"

          value={typeName}

          onChange={(e) => onTypeNameChange(e.target.value)}

          placeholder={namePlaceholder}

        />

      </div>

      <div className="frame2-create-grid frame2-create-grid--file-status-pair frame2-create-grid--profile-type-slim calculator-type-form-grid">

      <div className="frame2-block frame2-create-tl calculator-type-form-section calculator-type-form-section--images">

        <div className="frame2-block-title">Тип профиля</div>

        <CardImageChecklist

          idPrefix={idPrefix}

          label={cardImageLabel}

          urls={cardTileUrls}

          maxSlots={PROFILE_CARD_IMAGE_SLOT_COUNT}

          onAdd={onAddCardImage}

          onRemove={onRemoveCardImage}

          onReplace={onReplaceCardImage}

          fileInputRef={cardFileInputRef}

          onFileInputChange={onCardFileInputChange}

        />

      </div>



      <div className="frame2-block frame2-create-tr calculator-type-form-section calculator-type-form-section--materials">

        <div className="frame2-block-title">Цвета (материалы)</div>

        <div className="calculator-type-form-materials-toolbar">

          <div className="frame2-file-row frame2-colors-for-card-label">

            <div className="frame2-file-label-row">

              <span className="frame2-file-label">Цвета для карточки</span>

            </div>

          </div>

          <div className="frame2-material-search-row">

            <button type="button" className="admin-secondary frame2-material-tree-search-btn" onClick={onOpenMaterialSearch}>

              Добавить

            </button>

          </div>

        </div>

        {colorsHit.length > 0 && (

          <ul className="frame2-checklist">

            {colorsHit.map((m) => {

              const attached = selectedColors[m.id] != null

              if (!attached) return null

              const checked = isAttachedEntryActive(selectedColors[m.id])

              const entry = selectedColors[m.id] ?? defaultProfileColorEntry()

              const flags: ProfileColorFlags = {

                is_new: entry.is_new,

                is_hit: entry.is_hit,

                is_sale: entry.is_sale,

              }

              const articleFull = m.article || '—'

              const nameFull = materialTextureLabel(m)

              return (

                <li key={m.id}>

                  <div

                    className={[

                      'frame2-checkrow',

                      checked ? 'frame2-checkrow--checked' : 'frame2-checkrow--inactive',

                    ]

                      .filter(Boolean)

                      .join(' ')}

                    title={matLabel(m)}

                  >

                    <input type="checkbox" checked={checked} onChange={() => onToggleColorActive(m.id)} />

                    <MaterialCheckSwatch name={nameFull} material={m} texExtra={texByMaterialId[m.id]} />

                    <span className="frame2-check-article" title={articleFull}>

                      {truncateChecklistText(articleFull)}

                    </span>

                    <span className="frame2-check-name-wrap">

                      <span className="frame2-check-name" title={nameFull}>

                        {truncateChecklistText(nameFull)}

                      </span>

                    </span>

                    <div className="frame2-checkrow-actions">

                      <MaterialColorFlagsGear

                        flags={flags}

                        onToggleFlag={(flag) => onToggleColorFlag(m.id, flag)}

                        open={openFlagsMaterialId === m.id}

                        onToggle={(e) => {

                          e.stopPropagation()

                          setOpenFlagsMaterialId((prev) => (prev === m.id ? null : m.id))

                        }}

                        onClose={() => setOpenFlagsMaterialId(null)}

                        ariaLabel={`Метки: ${matLabel(m)}`}

                      />

                      <button

                        type="button"

                        className="calculator-type-form-card-image-remove admin-primary"

                        aria-label={`Удалить ${matLabel(m)}`}

                        title={`Удалить ${matLabel(m)}`}

                        onClick={() => onRemoveColor(m.id)}

                      >

                        Удалить

                      </button>

                    </div>

                  </div>

                </li>

              )

            })}

          </ul>

        )}

        {Object.values(selectedColors).some(isAttachedEntryActive) && (

          <div className="admin-muted">

            Активных цветов: {Object.values(selectedColors).filter(isAttachedEntryActive).length}

          </div>

        )}

      </div>

    </div>

    </>

  )

}


