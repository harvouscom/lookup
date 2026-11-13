#!/bin/zsh
# Tiles review stills 2×2 into contact sheets, in order: scripts/sheet.sh out/sheets a.png b.png ...
out=$1; shift; mkdir -p $out; n=0
while (( $# > 0 )); do
  files=("${@[1,4]}"); shift $(( $# < 4 ? $# : 4 ))
  while (( ${#files} < 4 )); do files+=("${files[-1]}"); done
  ffmpeg -loglevel error -y -i $files[1] -i $files[2] -i $files[3] -i $files[4] -filter_complex \
    "[0]scale=960:540[a];[1]scale=960:540[b];[2]scale=960:540[c];[3]scale=960:540[d];[a][b][c][d]xstack=inputs=4:layout=0_0|w0_0|0_h0|w0_h0" $out/sheet-$n.png
  echo "$out/sheet-$n.png: ${files[*]:t}"
  n=$((n+1))
done
