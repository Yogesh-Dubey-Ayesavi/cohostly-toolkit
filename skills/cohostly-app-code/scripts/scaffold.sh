#!/usr/bin/env bash
# Copies one of the example apps into a new folder and gives it your project name.
#   scaffold.sh --list                      list the examples
#   scaffold.sh <example> <folder> [name]   copy assets/examples/<example> to <folder>; name defaults to the folder's name
# It never overwrites: the folder must not exist yet. It changes only the "name" in cohostly.json and package.json.
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
EXAMPLES="$HERE/assets/examples"

if [ "${1:-}" = "--list" ] || [ $# -lt 2 ]; then
  [ "${1:-}" = "--list" ] || echo "usage: scaffold.sh <example> <folder> [name]   (or --list)" >&2
  for d in "$EXAMPLES"/*/; do printf '%-18s %s\n' "$(basename "$d")" "$(sed -n 's/^# *//;2,3{/^[A-Za-z]/p;}' "$d/README.md" | head -1)"; done
  [ "${1:-}" = "--list" ] && exit 0 || exit 2
fi

SRC="$EXAMPLES/$1"; DEST="$2"; NAME="${3:-$(basename "$DEST")}"
[ -d "$SRC" ] || { echo "no example called '$1' (see --list)" >&2; exit 1; }
[ ! -e "$DEST" ] || { echo "$DEST already exists; pick a new folder so nothing is overwritten" >&2; exit 1; }
# The platform makes the app's address from the name itself (dots and underscores become dashes), so the name only has to be plain and
# must not hold "--", which separates a project from an instance in a URL.
printf '%s' "$NAME" | grep -Eq '^[A-Za-z0-9][A-Za-z0-9._-]*$' && [[ "$NAME" != *--* ]] || { echo "the name '$NAME' must be letters, digits, dots, underscores or single dashes (for example my-notes)" >&2; exit 1; }

cp -R "$SRC" "$DEST"
OLD="$(basename "$SRC")"
for f in "$DEST/cohostly.json" "$DEST/package.json"; do
  [ -f "$f" ] && sed -i.bak "s/\"$OLD\"/\"$NAME\"/g; s/--project $OLD/--project $NAME/g" "$f" && rm -f "$f.bak"
done
echo "Created $DEST from '$1' as project '$NAME'."
echo "Next: read $DEST/README.md, then run it with 'platform dev' and deploy with the cohostly-host skill."
