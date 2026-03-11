# Как пушить проект на GitHub из VS Code

## Что уже готово

- Git в проекте уже есть
- имя и email Git уже настроены
- добавлен `.gitignore`, чтобы не пушить лишние файлы

## 1. Создай пустой репозиторий на GitHub

Создай новый репозиторий без `README`, без `.gitignore` и без лицензии.

Пример:

- `techgear-miniapp`

После создания скопируй URL репозитория. Он будет выглядеть так:

```bash
https://github.com/USERNAME/techgear-miniapp.git
```

## 2. Привяжи локальный проект к GitHub

Открой терминал в VS Code в папке проекта и выполни:

```bash
git remote add origin https://github.com/USERNAME/techgear-miniapp.git
git branch -M main
git add .
git commit -m "Initial commit"
git push -u origin main
```

Если `origin` уже существует, используй:

```bash
git remote set-url origin https://github.com/USERNAME/techgear-miniapp.git
```

## 3. Как потом пушить из VS Code

После изменений:

```bash
git add .
git commit -m "Описание изменений"
git push
```

Или через интерфейс VS Code:

1. Открой `Source Control`
2. Нажми `+` возле файлов или `Stage All Changes`
3. Введи сообщение коммита
4. Нажми `Commit`
5. Нажми `Sync Changes` или `Push`

## 4. Если GitHub просит вход

Обычно VS Code сам откроет окно авторизации GitHub. Подтверди вход в браузере.

Если нужен токен, создай `Personal Access Token` на GitHub и используй его вместо пароля.

## 5. Проверка

Проверить, что всё подключено:

```bash
git remote -v
git status
```
