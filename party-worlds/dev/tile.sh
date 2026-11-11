#!/bin/sh
# dev/tile.sh out.png cols file1 file2 ...   — tile screenshots (scaled to 640 wide) into one sheet
out="$1"; cols="$2"; shift 2
n=$#; inputs=""; filt=""; layout=""; i=0
for f in "$@"; do
  inputs="$inputs -i $f"
  filt="$filt[$i:v]scale=640:-1[s$i];"
  x=$(( (i % cols) * 640 )); y=$(( (i / cols) * 360 ))
  layout="$layout${layout:+|}${x}_${y}"
  i=$((i+1))
done
stack=""; j=0; while [ $j -lt $n ]; do stack="$stack[s$j]"; j=$((j+1)); done
ffmpeg -loglevel error $inputs -filter_complex "${filt}${stack}xstack=inputs=$n:layout=$layout:fill=white" -frames:v 1 -y "$out"
