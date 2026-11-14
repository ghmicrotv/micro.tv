# Micro.tv — запуск на Windows

Все команды для PowerShell. Подробности и решение проблем — в [docs/11_Setup.md](docs/11_Setup.md).

## 1. Установить Go, Node.js и Git

```powershell
winget install --id GoLang.Go -e
```

```powershell
winget install --id OpenJS.NodeJS.LTS -e
```

```powershell
winget install --id Git.Git -e
```

После установки **закройте и снова откройте PowerShell**, затем проверьте:

```powershell
go version; node --version; git --version
```

Если `npm` пишет «выполнение сценариев отключено», разрешите скрипты для своего пользователя:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

## 2. Скачать проект

```powershell
git clone <адрес-репозитория> KinoSite; cd KinoSite
```

Папку `Media` с видео положите в корень проекта, рядом с `apps`. Она не хранится в git; без неё вместо видео будут заглушки.

## 3. Установить зависимости

```powershell
cd apps\api; go mod download; cd ..\..
```

```powershell
cd apps\web; npm ci; cd ..\..
```

## 4. Запустить

Два окна PowerShell, оба в папке `KinoSite`.

Окно 1 — API (порт 8080):

```powershell
cd apps\api; go run ./cmd/api
```

Окно 2 — сайт (порт 3000):

```powershell
cd apps\web; npm run dev
```

Откройте http://localhost:3000.

## 5. Запуск сборки (как в продакшене)

```powershell
cd apps\api; go build -o bin\api.exe ./cmd/api; .\bin\api.exe
```

```powershell
cd apps\web; npm run build; npm run start
```

Перед `npm run build` остановите `npm run dev` (Ctrl+C).

## 6. Полезное

Сменить «Трейлер недели»:

```powershell
cd apps\api; go run ./cmd/admin hero ogni-porta
```

Сбросить демо-данные (сначала остановите API):

```powershell
Remove-Item -Recurse -Force apps\api\data
```
