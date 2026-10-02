# Liquid glass · motion-пилот V_ostroslava

**Назначение.** Ограниченный motion-пилот liquid glass стиля, идея «стекло открывает то, что под капотом». Внутри три немые пробы 1080×1920 при 30 fps. Это кандидат: бренд-канон не меняется, публикации нет. Компоненты принадлежат пилоту и **не являются** зарегистрированными адаптерами ThrendEffects.

## Входы
- `references/` — бриф (`PROMPT-FOR-CLAUDE.md`), `DESIGN.md` v1 и ориентир оптики `04a_prism_satin.png` / `prism-variations.png`.
- `assets/fonts/` — Bebas Neue Cyrillic, Caveat, Inter вместе с лицензиями. SHA-256 совпадают с DESIGN.md.

## Источник правды
- `references/DESIGN.md` — стиль. Если что-то противоречит, побеждает он.
- `src/tokens.js` — палитра, шрифты, safe-профиль Reels, параметры стекла и ритм движения.

## Структура
| Файл | Что это |
| --- | --- |
| `src/tokens.js` | токены: цвет, шрифты, стекло, движение, safe-зона |
| `src/glass.js` | WebGL-проход рефракции (настоящее смещение выборки нижнего слоя) |
| `src/components.js` | `glassLabel`, `lens`, `breakdownLayer`, `stageLink`, демо-кадр, плоский fallback |
| `src/scenes/*.js` | `lens` · `layers` (главная) · `versions` |
| `src/stage.js` | композиция under → glass → over, debug-оверлей safe-зоны, геометрический аудит |
| `index.html` | вьюер (только оболочка просмотра) |
| `tools/render.mjs` | покадровый рендер в MP4 и контрольные кадры |
| `tools/qa.sh` | ffprobe, полный decode, кадры из MP4, мерцание, повторяемость |
| `TREATMENT.md`, `REPORT.md` | treatment и отчёт со статусами |

## Запуск
Нужны Node ≥18, Playwright с Chromium (`npm i -D playwright`, если глобального нет) и ffmpeg с libx264.
```bash
node tools/render.mjs --serve                          # вьюер: http://localhost:8123/index.html
node tools/render.mjs --scene all --concurrency 3      # out/lens.mp4, out/layers.mp4, out/versions.mp4
node tools/render.mjs --scene layers --optics 0        # резервная версия без оптики → out/layers_fallback.mp4
node tools/render.mjs --scene lens --stills 0,117 --debug 1   # PNG с debug-оверлеем safe-зоны
bash tools/qa.sh                                       # техническая проверка
```
Debug-оверлей включается только флагом `--debug 1` или галочкой во вьюере. В итоговые MP4 он не попадает.

**Профиль рендера.** Проверено в облачном контейнере: 4 vCPU, 15 GB RAM, без GPU, WebGL через SwiftShader. Там работают 3 параллельные сцены, по одной на страницу Chromium, плюс x264 `-preset slow -crf 16`. `videoBitrate` не задаётся, только CRF. На Mac Славы профиль нужно взять из `~/.codex/skills/threndeffects/registry/render-profiles.yaml` по фактическому железу. Эти правила здесь не проверялись, потому что файла в среде нет. `--concurrency` ограничен числом сцен.

## Результаты
- `out/*.mp4` — пробы.
- `out/*.audit.json` — покадровая геометрическая проверка safe-зоны.
- `out/frames/` — контрольные кадры: из MP4 и debug-PNG.
- `out/qa/` — ffprobe, decode, мерцание, повторяемость.

## Как проверить
Запустить `bash tools/qa.sh` и прочитать `out/qa/summary.txt`. Затем посмотреть `out/frames/*_debug.png`: там зелёные рамки критичных элементов внутри полигона, красные означали бы нарушение. Итоговые кадры — `*_mp4_*.png`.
