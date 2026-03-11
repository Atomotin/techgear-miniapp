# Пошаговый запуск: Railway + Supabase

Ниже самый простой путь, чтобы:

- сайт работал стабильно
- админка сохраняла товары навсегда
- заказы тоже не терялись

В этой схеме:

- `Railway` запускает твой Node.js сервер
- `Supabase` хранит товары, категории и заказы

## Что получится в итоге

После настройки у тебя будет:

- витрина: `https://твой-домен/`
- админка: `https://твой-домен/admin`
- проверка сервера: `https://твой-домен/api/health`

Если `/api/health` отвечает JSON и там `storage: "supabase"`, значит всё подключено правильно.

## Шаг 1. Создай проект в Supabase

1. Зайди на сайт `https://supabase.com`
2. Нажми `New project`
3. Выбери:
   - имя проекта
   - пароль для базы
   - регион поближе
4. Дождись, пока проект создастся

## Шаг 2. Создай таблицы в Supabase

1. Внутри проекта открой `SQL Editor`
2. Нажми `New query`
3. Открой файл [supabase/schema.sql](/c:/Users/User/Desktop/techgear-miniapp/supabase/schema.sql)
4. Скопируй весь SQL из файла
5. Вставь в Supabase
6. Нажми `Run`

После этого создадутся таблицы:

- `categories`
- `products`
- `orders`

## Шаг 3. Возьми ключи Supabase

Открой в Supabase:

`Project Settings` -> `API`

Там нужны 2 значения:

- `Project URL` -> это будет `SUPABASE_URL`
- `service_role` key -> это будет `SUPABASE_SERVICE_ROLE_KEY`

Важно:

- бери именно `service_role`
- этот ключ нельзя вставлять во фронтенд
- он должен быть только в Railway environment variables

## Шаг 4. Создай проект в Railway

1. Зайди на сайт `https://railway.app`
2. Нажми `New Project`
3. Выбери `Deploy from GitHub repo`
4. Подключи репозиторий `techgear-miniapp`

Railway сам увидит `package.json` и будет запускать:

```bash
npm start
```

## Шаг 5. Добавь переменные в Railway

В Railway открой:

`Project` -> `Variables`

Добавь туда:

```env
ADMIN_PASSWORD=твой-сложный-пароль-для-админки
ADMIN_SECRET=длинный-случайный-секрет-для-токенов
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=твой-service-role-key
PORT=3000
```

Где взять пример:

- смотри [.env.example](/c:/Users/User/Desktop/techgear-miniapp/.env.example)

## Шаг 6. Первый запуск

После первого запуска сервер сам проверит базу.

Если таблицы пустые, он автоматически перенесёт:

- категории
- товары

из [card-tovary.js](/c:/Users/User/Desktop/techgear-miniapp/card-tovary.js) в Supabase.

Это значит:

- старый каталог подтянется сам
- потом ты уже сможешь редактировать всё через `/admin`

## Шаг 7. Проверь, что всё работает

После деплоя открой:

### 1. Проверка сервера

Открой:

```text
https://твой-домен/api/health
```

Ты должен увидеть примерно такое:

```json
{
  "ok": true,
  "storage": "supabase",
  "supabaseEnabled": true
}
```

Если там `storage: "local"`, значит Railway не получил переменные Supabase.

### 2. Проверка магазина

Открой:

```text
https://твой-домен/
```

Должны загрузиться товары.

### 3. Проверка админки

Открой:

```text
https://твой-домен/admin
```

Введи `ADMIN_PASSWORD` из Railway Variables.

## Шаг 8. Проверь сохранение товара

В админке:

1. Создай тестовый товар
2. Сохрани
3. Обнови страницу
4. Проверь, что товар остался

Если остался после перезагрузки, значит всё уже сохраняется в Supabase, а не во временные файлы.

## Если что-то не работает

### Ошибка логина в админке

Проверь:

- правильно ли задан `ADMIN_PASSWORD`
- перезапустился ли Railway после изменения переменных

### `/api/health` показывает `local`

Проверь:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- нет ли пробелов в значениях

### Товары не появились после первого запуска

Проверь:

- запускался ли SQL из [supabase/schema.sql](/c:/Users/User/Desktop/techgear-miniapp/supabase/schema.sql)
- есть ли данные в [card-tovary.js](/c:/Users/User/Desktop/techgear-miniapp/card-tovary.js)
- нет ли ошибок в логах Railway

## Какие файлы теперь важны

- [server.js](/c:/Users/User/Desktop/techgear-miniapp/server.js) — сервер и API
- [supabase/schema.sql](/c:/Users/User/Desktop/techgear-miniapp/supabase/schema.sql) — структура базы
- [.env.example](/c:/Users/User/Desktop/techgear-miniapp/.env.example) — список переменных
- [SETUP_RAILWAY_SUPABASE_RU.md](/c:/Users/User/Desktop/techgear-miniapp/SETUP_RAILWAY_SUPABASE_RU.md) — эта инструкция
- [DEPLOY_RAILWAY_SUPABASE.md](/c:/Users/User/Desktop/techgear-miniapp/DEPLOY_RAILWAY_SUPABASE.md) — короткая англоязычная версия
