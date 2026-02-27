# DEVELOPERS

## Требования

- Node.js `>=24.14.0`
- npm `>=11.9.0`

## Установка

```bash
npm ci
```

## Основные команды

```bash
# type check
npm run typecheck

# сборка виджета
npm run build

# unit-тесты
npm test

# unit + coverage
npm run test:coverage

# lint
npm run lint

# prettier (write)
npm run format
```

## Политики коммита и PR

- Перед коммитом автоматически запускается `lint-staged` (включает `eslint --fix` и `prettier --write` для staged-файлов).
- `commit-msg` hook валидирует Conventional Commits через `commitlint`.
- Через линтер запрещены `any`, `@ts-ignore` (без описания), `eslint-disable` (кроме `eslint-disable-next-line` с описанием), а также некорректное использование `Promise` (например, `Promise` в условии) и "висящие" промисы без `await`/`void`.
- Для исключений указывайте причину прямо в комментарии отключения правила, например:
  - `// eslint-disable-next-line @typescript-eslint/no-explicit-any -- причина`
  - `// @ts-ignore: причина`
- Для PR действует workflow `PR Policy Gates`:
  - блокирует PR при невалидных сообщениях коммитов (Conventional Commits);
  - проверяет сообщения всех коммитов PR (диапазон `merge-base..HEAD`);
  - для PR в `main` автоматически синхронизирует версию `package.json`/`package-lock.json` (инкремент от версии target-ветки по текущему правилу bump из commit messages PR);
  - PR не в `main` не получают служебный version-коммит;
  - блокирует PR при падении `coverage` относительно целевой ветки;
  - блокирует PR, если `npm audit --omit=dev` показывает уязвимости;
  - ограничения по `coverage` и `npm audit` можно обойти только специальным лейблом `policy-exception`.
  - проверка Conventional Commits лейблом не обходится.

## E2E (Playwright)

```bash
# установить браузер Chromium
npm run test:e2e:install

# запуск e2e
npm run test:e2e

# запуск в headed-режиме
npm run test:e2e:headed
```

## Как тестируется `snippet.liquid` в e2e

- Шаблон `src/resources/snippet.liquid` рендерится через `liquidjs` внутри e2e-теста.
- Отрендеренный HTML вставляется в `<head>` страницы-энтрипоинта.
- `api_domain` в тестовом контексте задается как `127.0.0.1`, поэтому шаблон формирует URL трекера `https://127.0.0.1/scripts/v1/tracker.js`.
- Этот внешний скрипт мокается через `page.route(...)`, и в моке подменяется `window.mindbox`, чтобы фиксировать отправленные команды/операции.
- После этого подключается `/src/snippet.ts`, и тесты проверяют полный поток:
  - `viewCategory`
  - `viewProduct`
  - `setCart` / `clearCart`
  - `setWishList` / `clearWishList`
  - fallback `clearCart/clearWishList -> setCart/setWishList` с пустым списком, когда clear-операции не заданы
  - кейс работы всех сценариев без `endpointId`
  - негативный кейс, когда операции wishlist пустые

## CI

В GitHub Actions (`.github/workflows/release-widget.yml`) e2e запускаются в релизном job:

1. `npx playwright install --with-deps chromium`
2. `npm run test:e2e`
