---
name: furnitech-handoff
description: >-
  Furnitech (Django + React): калькулятор для магазина с админкой и клиентом.
  Передача контекста между сессиями. Используй в начале работы в этом репозитории
  или когда пользователь просит «продолжить / где мы / handoff / другой агент».
---

# Furnitech — передача контекста

## Сразу при старте сессии

1. Из **корня репозитория** выполнить: `py scripts/furnitech_status.py`  
   (в Unix/mac: `python3 scripts/furnitech_status.py` при необходимости.)
2. Прочитать **полный** [docs/PROGRESS.md](docs/PROGRESS.md) и при необходимости [docs/PLAN.md](docs/PLAN.md), [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). В PROGRESS и ARCHITECTURE зафиксированы **публичный калькулятор** (`/` без входа) и **анонимное GET** части API — не путать с полностью закрытым JWT API прошлых версий.

## Команда для нового агента (кратко)

```bash
py scripts/furnitech_status.py
```

## Что фиксировать в конце работы

- Обнови `docs/PROGRESS.md`: дата, фактическое состояние, снятые/новые чекпоинты.
- При смене API или структуры папок — правка `docs/ARCHITECTURE.md`.

## Стек и ориентиры

- Backend: `backend/`, DRF, приложение `materials`.
- Frontend: `frontend/`, Vite + React, прокси `/api` → `http://127.0.0.1:8000`.
- 1С: поля `external_id` / `last_synced_at` в моделях — не ломать без согласования.
