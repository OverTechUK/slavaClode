#!/usr/bin/env bash
# Техническая проверка экспортов: ffprobe, полный decode, контрольные кадры из MP4,
# мерцание на hold-участках, повторяемость рендера (повторный рендер кадров → сравнение хэшей).
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=out; QA=$OUT/qa; mkdir -p "$QA" "$OUT/frames"
declare -A BEATS=(
  [lens]="entry=0.5 move=2.8 peak=3.9 hold=5.6 exit=8.1 end=9.5"
  [layers]="entry=0.6 explode=3.4 peak=5.1 hold=7.3 collapse=9.9 end=12.2"
  [versions]="entry=0.9 branch=3.0 peak=4.0 hold=5.6 link=7.5 end=9.5"
)
# hold-участки для проверки мерцания (секунды): статичная картинка должна быть неподвижной
declare -A HOLD=([lens]="4.4 7.4" [layers]="11.0 12.9" [versions]="8.4 9.9")
for s in lens layers versions; do
  f=$OUT/$s.mp4; [ -f "$f" ] || { echo "$s: MP4 нет"; continue; }
  ffprobe -v error -show_entries stream=codec_name,profile,width,height,pix_fmt,r_frame_rate,nb_frames:format=duration,size -of json "$f" > "$QA/$s.ffprobe.json"
  if ffmpeg -v error -xerror -i "$f" -f null - 2> "$QA/$s.decode.log"; then dec=ok; else dec=FAIL; fi
  for b in ${BEATS[$s]}; do ffmpeg -v error -y -ss "${b#*=}" -i "$f" -frames:v 1 "$OUT/frames/${s}_mp4_${b%%=*}.png"; done
  read a z <<< "${HOLD[$s]}"
  # средняя межкадровая разница (YDIF) на hold: ~0 → нет мерцания
  ydif=$(ffmpeg -v error -ss "$a" -to "$z" -i "$f" -vf signalstats,metadata=print:key=lavfi.signalstats.YDIF:file=- -f null - | awk -F= '/YDIF/{s+=$2;n++; if($2>m)m=$2} END{printf "mean=%.4f max=%.4f n=%d", s/n, m, n}')
  echo "$s: decode=$dec hold_ydif[$a-$z]: $ydif" | tee -a "$QA/summary.txt"
done
# повторяемость: два независимых рендера одних и тех же кадров
for run in 1 2; do
  node tools/render.mjs --scene lens --stills 117,240 --out "$QA/repeat$run" --port 8125 >/dev/null
  node tools/render.mjs --scene layers --stills 150,170 --out "$QA/repeat$run" --port 8125 >/dev/null
  node tools/render.mjs --scene versions --stills 120,230 --out "$QA/repeat$run" --port 8125 >/dev/null
done
if diff <(cd "$QA/repeat1/frames" && sha256sum *) <(cd "$QA/repeat2/frames" && sha256sum *) >/dev/null; then rep=identical; else rep=DIFFERENT; fi
echo "repeatability (6 кадров, 2 прогона): $rep" | tee -a "$QA/summary.txt"
