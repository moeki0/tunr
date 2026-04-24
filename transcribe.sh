#!/bin/bash
# Transcribe recent audio segments using whisper-cpp
set -euo pipefail

AUDIO_DIR="$HOME/Library/Application Support/uitocc/audio"
MODEL_DIR="$HOME/.cache/uitocc/models"
MODEL="${UITOCC_WHISPER_MODEL:-$MODEL_DIR/ggml-large-v3-turbo-q5_0.bin}"

# Download model if not present
if [ ! -f "$MODEL" ]; then
  mkdir -p "$MODEL_DIR"
  echo "Downloading whisper model..." >&2
  curl -L -o "$MODEL" \
    "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo-q5_0.bin"
fi

# Find the 2 most recent segments
segments=()
while IFS= read -r f; do
  segments+=("$f")
done < <(ls -t "$AUDIO_DIR"/segment-*.wav 2>/dev/null | head -2)

if [ ${#segments[@]} -eq 0 ]; then
  echo "No audio segments found" >&2
  exit 1
fi

# Reverse to chronological order
ordered=()
for ((i=${#segments[@]}-1; i>=0; i--)); do
  ordered+=("${segments[$i]}")
done

# Concatenate segments
tmpdir=$(mktemp -d)
trap 'rm -rf "$tmpdir"' EXIT

concat_list="$tmpdir/concat.txt"
for f in "${ordered[@]}"; do
  echo "file '$f'" >> "$concat_list"
done

merged="$tmpdir/merged.wav"
ffmpeg -y -f concat -safe 0 -i "$concat_list" -c copy "$merged" 2>/dev/null

# Transcribe with whisper-cpp
whisper-cli -m "$MODEL" -l ja -nt -f "$merged" 2>/dev/null
