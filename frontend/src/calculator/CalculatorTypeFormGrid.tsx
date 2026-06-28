import type { RefObject } from 'react'
import type { Material } from '../types'
import { MaterialCheckSwatch } from './MaterialCheckSwatch'
import { materialTextureLabel, type MaterialTextureFields } from './materialTextureLabel'
import {
  ProfileCardImageTileRow,
  type CalcCardImageFiles,
  type CalcCardImageUrls,
} from './calculatorCardTiles'

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
  cardFiles: CalcCardImageFiles
  onCardFileChange: (slot: number, file: File | null) => void
  cardTileUrls: CalcCardImageUrls
  cardInputRefs: [
    RefObject<HTMLInputElement | null>,
    RefObject<HTMLInputElement | null>,
    RefObject<HTMLInputElement | null>,
    RefObject<HTMLInputElement | null>,
  ]
  onPickTextureSlot: (slot: number) => void
  cardAriaLabel?: string
  materialsBlockTitle: string
  materialsListLabel: string
  onOpenMaterialSearch: () => void
  materialsHit: Material[]
  selectedMaterialIds: Record<number, true>
  onToggleMaterial: (materialId: number) => void
  texByMaterialId: Record<number, { texture_mode?: string; texture_color?: string; texture_image?: string | null; texture_library_item_name?: string | null; name?: string }>
}

export function MaterialTypeFormGrid({
  idPrefix,
  typeBlockTitle,
  typeName,
  onTypeNameChange,
  namePlaceholder,
  cardImageLabel,
  onCardFileChange,
  cardTileUrls,
  cardInputRefs,
  onPickTextureSlot,
  cardAriaLabel,
  materialsBlockTitle,
  materialsListLabel,
  onOpenMaterialSearch,
  materialsHit,
  selectedMaterialIds,
  onToggleMaterial,
  texByMaterialId,
}: MaterialTypeFormGridProps) {
  return (
    <div className="frame2-create-grid frame2-create-grid--file-status-pair frame2-create-grid--profile-type-slim">
      <div className="frame2-block frame2-create-tl">
        <div className="frame2-block-title">{typeBlockTitle}</div>
        <input
          className="admin-input"
          value={typeName}
          onChange={(e) => onTypeNameChange(e.target.value)}
          placeholder={namePlaceholder}
        />
        <div className="frame2-file-row">
          <div className="frame2-file-label-row">
            <span className="frame2-file-label">{cardImageLabel}</span>
          </div>
          {cardInputRefs.map((refEl, slot) => (
            <input
              key={slot}
              id={`${idPrefix}-card-image-${slot}`}
              ref={refEl}
              className="frame2-file-input frame2-file-input--sr"
              type="file"
              accept="image/*"
              onChange={(e) => onCardFileChange(slot, e.target.files?.[0] ?? null)}
            />
          ))}
        </div>
        <ProfileCardImageTileRow
          urls={cardTileUrls}
          inputRefs={cardInputRefs}
          onPickSlot={onPickTextureSlot}
          groupAriaLabel={cardAriaLabel}
        />
      </div>

      <div className="frame2-block frame2-create-tr">
        <div className="frame2-block-title">{materialsBlockTitle}</div>
        <div className="frame2-material-search-row">
          <button type="button" className="admin-secondary frame2-material-tree-search-btn" onClick={onOpenMaterialSearch}>
            Поиск
          </button>
        </div>
        <div className="frame2-file-row frame2-colors-for-card-label">
          <div className="frame2-file-label-row">
            <span className="frame2-file-label">{materialsListLabel}</span>
          </div>
        </div>
        {materialsHit.length > 0 && (
          <ul className="frame2-checklist">
            {materialsHit.map((m) => (
              <li key={m.id}>
                <label
                  className={['frame2-checkrow', selectedMaterialIds[m.id] ? 'frame2-checkrow--checked' : '']
                    .filter(Boolean)
                    .join(' ')}
                  title={matLabel(m)}
                >
                  <input
                    type="checkbox"
                    checked={selectedMaterialIds[m.id] === true}
                    onChange={() => onToggleMaterial(m.id)}
                  />
                  <span className="frame2-check-article">{m.article || '—'}</span>
                  <MaterialCheckSwatch name={materialTextureLabel(m)} material={m} texExtra={texByMaterialId[m.id]} />
                  <span className="frame2-check-name-wrap">
                    <span className="frame2-check-name">{materialTextureLabel(m)}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
        {Object.keys(selectedMaterialIds).length > 0 && (
          <div className="admin-muted">Выбрано материалов: {Object.keys(selectedMaterialIds).length}</div>
        )}
      </div>
    </div>
  )
}

export type ProfileColorFlags = { is_new: boolean; is_hit: boolean; is_sale: boolean }

export type ProfileTypeFormGridProps = {
  idPrefix: string
  typeName: string
  onTypeNameChange: (value: string) => void
  namePlaceholder: string
  cardImageLabel: string
  onCardFileChange: (slot: number, file: File | null) => void
  cardTileUrls: CalcCardImageUrls
  cardInputRefs: [
    RefObject<HTMLInputElement | null>,
    RefObject<HTMLInputElement | null>,
    RefObject<HTMLInputElement | null>,
    RefObject<HTMLInputElement | null>,
  ]
  onPickTextureSlot: (slot: number) => void
  onOpenMaterialSearch: () => void
  colorsHit: Material[]
  selectedColors: Record<number, ProfileColorFlags>
  onToggleColor: (materialId: number) => void
  onToggleColorFlag: (materialId: number, flag: keyof ProfileColorFlags) => void
  texByMaterialId: Record<number, { texture_mode?: string; texture_color?: string; texture_image?: string | null; texture_library_item_name?: string | null; name?: string }>
}

export function ProfileTypeFormGrid({
  idPrefix,
  typeName,
  onTypeNameChange,
  namePlaceholder,
  cardImageLabel,
  onCardFileChange,
  cardTileUrls,
  cardInputRefs,
  onPickTextureSlot,
  onOpenMaterialSearch,
  colorsHit,
  selectedColors,
  onToggleColor,
  onToggleColorFlag,
  texByMaterialId,
}: ProfileTypeFormGridProps) {
  return (
    <div className="frame2-create-grid frame2-create-grid--file-status-pair frame2-create-grid--profile-type-slim">
      <div className="frame2-block frame2-create-tl">
        <div className="frame2-block-title">Тип профиля</div>
        <input
          className="admin-input"
          value={typeName}
          onChange={(e) => onTypeNameChange(e.target.value)}
          placeholder={namePlaceholder}
        />
        <div className="frame2-file-row">
          <div className="frame2-file-label-row">
            <span className="frame2-file-label">{cardImageLabel}</span>
          </div>
          {cardInputRefs.map((refEl, slot) => (
            <input
              key={slot}
              id={`${idPrefix}-card-image-${slot}`}
              ref={refEl}
              className="frame2-file-input frame2-file-input--sr"
              type="file"
              accept="image/*"
              onChange={(e) => onCardFileChange(slot, e.target.files?.[0] ?? null)}
            />
          ))}
        </div>
        <ProfileCardImageTileRow urls={cardTileUrls} inputRefs={cardInputRefs} onPickSlot={onPickTextureSlot} />
      </div>

      <div className="frame2-block frame2-create-tr">
        <div className="frame2-block-title">Цвета (материалы)</div>
        <div className="frame2-material-search-row">
          <button type="button" className="admin-secondary frame2-material-tree-search-btn" onClick={onOpenMaterialSearch}>
            Поиск
          </button>
        </div>
        <div className="frame2-file-row frame2-colors-for-card-label">
          <div className="frame2-file-label-row">
            <span className="frame2-file-label">Цвета для карточки</span>
          </div>
        </div>
        {colorsHit.length > 0 && (
          <ul className="frame2-checklist">
            {colorsHit.map((m) => {
              const checked = selectedColors[m.id] != null
              const flags = selectedColors[m.id] ?? { is_new: false, is_hit: false, is_sale: false }
              return (
                <li key={m.id}>
                  <div
                    className={['frame2-checkrow', checked ? 'frame2-checkrow--checked' : ''].filter(Boolean).join(' ')}
                    title={matLabel(m)}
                  >
                    <input type="checkbox" checked={checked} onChange={() => onToggleColor(m.id)} />
                    <span className="frame2-check-article">{m.article || '—'}</span>
                    <MaterialCheckSwatch name={materialTextureLabel(m)} material={m} texExtra={texByMaterialId[m.id]} />
                    <span className="frame2-check-name-wrap">
                      <span className="frame2-check-name">{materialTextureLabel(m)}</span>
                    </span>
                  </div>
                  {checked && (
                    <div className="frame2-flags">
                      <label className="frame2-flag">
                        <input
                          type="checkbox"
                          checked={flags.is_new}
                          onChange={() => onToggleColorFlag(m.id, 'is_new')}
                        />{' '}
                        New
                      </label>
                      <label className="frame2-flag">
                        <input
                          type="checkbox"
                          checked={flags.is_hit}
                          onChange={() => onToggleColorFlag(m.id, 'is_hit')}
                        />{' '}
                        Hit
                      </label>
                      <label className="frame2-flag">
                        <input
                          type="checkbox"
                          checked={flags.is_sale}
                          onChange={() => onToggleColorFlag(m.id, 'is_sale')}
                        />{' '}
                        Sale
                      </label>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        {Object.keys(selectedColors).length > 0 && (
          <div className="admin-muted">Выбрано цветов: {Object.keys(selectedColors).length}</div>
        )}
      </div>
    </div>
  )
}
