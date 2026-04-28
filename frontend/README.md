# Furnitech — фронтенд (Vite + React)

SPA для **Furnitech**: публичный калькулятор и веб‑админка (материалы, калькулятор с полным редактированием, заказы).

## Документация проекта

Корневой **[README.md](../README.md)** и папка **[docs/](../docs/)**:

- **[docs/PROGRESS.md](../docs/PROGRESS.md)** — актуальный прогресс и чеклист
- **[docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md)** — маршруты SPA, API, модули `src/`

## Маршруты (кратко)

| Маршрут | Кто |
|---------|-----|
| `/`, `/frame`, `/frame/size`, `/frame/filling`, … | Гость: калькулятор без входа (`variant="public"`) |
| `/login` | Вход |
| `/materials/*`, `/calculator/*`, `/orders/*` | После входа: `AdminApp` |

## Разработка

```bash
npm install
npm run dev
```

Прокси `/api` → `http://127.0.0.1:8000` (см. `vite.config.ts`).

---

Шаблон Vite (ESLint, расширение конфигурации): см. историю коммитов или [документацию Vite](https://vite.dev/).
