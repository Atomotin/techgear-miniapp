# Аналитика входов Mini App

Сейчас в приложении уже есть готовая отправка событий:

- `mini_app_open` — когда пользователь открыл mini app
- `order_submitted` — когда пользователь отправил заказ

Но по умолчанию аналитика выключена.

## Что нужно сделать

### 1. Создай Google Sheet

Создай таблицу, например:

`TechGear Analytics `

Сделай первую строку с колонками:

```text
event | session_id | opened_at | user_id | username | first_name | last_name | language_code | platform | extra
```

### 2. Создай Google Apps Script

Открой таблицу:

`Extensions` -> `Apps Script`

Вставь этот код:

```javascript
function doPost(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const data = JSON.parse(e.postData.contents || "{}");

  sheet.appendRow([
    data.event || "",
    data.session_id || "",
    data.opened_at || "",
    data.user_id || "",
    data.username || "",
    data.first_name || "",
    data.last_name || "",
    data.language_code || "",
    data.platform || "",
    JSON.stringify(data.extra || {})
  ]);

  return ContentService
    .createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}
```

### 3. Опубликуй как Web App

Нажми:

`Deploy` -> `New deployment` -> `Web app`

Поставь:

- `Execute as`: `Me`
- `Who has access`: `Anyone`

Скопируй выданный `Web app URL`

### 4. Включи аналитику в mini app

Открой [index.html](c:\Users\User\Desktop\techgear-miniapp\index.html) и найди:

```js
const CONFIG = {
  requireLocation: true,
  analyticsWebhookUrl: "",
  analyticsEnabled: false,
};
```

Замени на:

```js
const CONFIG = {
  requireLocation: true,
  analyticsWebhookUrl: "ТВОЙ_WEB_APP_URL",
  analyticsEnabled: true,
};
```

## Что ты получишь

После этого в таблице увидишь:

- кто открыл mini app
- Telegram ID пользователя
- username
- имя
- дату и время входа
- с какого устройства/платформы был вход
- сколько всего событий было
- в `extra` будет диагностика Telegram-контекста

## Как считать людей

### Сколько всего заходов

Считай количество строк с `mini_app_open`

### Сколько уникальных людей

Смотри уникальные `user_id`

### Кто оформил заказ

Смотри строки с `order_submitted`

## Важно

- если у пользователя нет `username`, поле будет пустым
- уникальность лучше считать по `user_id`
- без включения `analyticsEnabled: true` ничего отправляться не будет

## Если `user_id` и `username` пустые

Смотри колонку `extra`. Там есть поля:

- `has_tg_object`
- `has_init_data`
- `has_init_data_unsafe`
- `has_telegram_user`
- `has_username`
- `start_param`
- `query_id`
- `user_agent`

Если `has_telegram_user: false`, значит Telegram не передал пользователя в эту сессию Mini App.
