# Chillmon

Форк [HeliosLauncher](https://github.com/dscalzi/HeliosLauncher) под сборку **Chillmon** (Cobblemon).

- Вход: **Microsoft / Mojang** (пиратский оффлайн-логин не встроен).
- Сервер по умолчанию: `185.9.145.82:32615`
- Моды качаются из `distribution.json` пакета (`run-cobblemon-pack`).

## Запуск (dev)

1. В `run-cobblemon-pack`: `.\scripts\sync-from-run.ps1` затем `.\scripts\refresh-index.ps1` и `.\scripts\serve.ps1`
2. Здесь:

```powershell
npm install
npm start
```

Лаунчер читает `http://127.0.0.1:8765/distribution.json`. Публичный хост:

```powershell
$env:RUN_DISTRO_URL = 'https://your-host/distribution.json'
npm start
```

Сборка установщика: `npm run dist:win` (нужен Node 22).

Microsoft OAuth для релиза: см. `docs/MicrosoftAuth.md` (Azure App Id).

## Раздача друзьям

1. Выложи папку `run-cobblemon-pack` на HTTP (хостинг / GitHub Pages) и впиши URL в `RUN_DISTRO_URL`.
2. Собери установщик: `npm run dist:win` — файл в `dist\`.
3. Друг ставит Chillmon, входит Microsoft, жмёт **НАЧАТЬ ИГРУ**.
4. Лаунчер сам проверяет файлы и докачивает недостающие моды.

Друзьям на TLauncher по-прежнему zip: `run-cobblemon-pack\scripts\export-tlauncher-zip.ps1`.
