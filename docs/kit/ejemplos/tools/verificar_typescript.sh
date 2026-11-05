#!/usr/bin/env bash
# Verifica con `tsc --noEmit` (modo estricto) los ejemplos web/ y mobile/ contra:
#   - los tipos REALES generados del contrato (openapi-typescript kit-ia/api/openapi.yaml → schema.d.ts),
#   - kit-ia/design (tokens.json, tailwind.preset.ts, theme.native.ts),
#   - las librerías indicadas en los CLAUDE.md (Next 15, React 19, TanStack Query/Table, RHF, Zod, openapi-fetch,
#     expo-sqlite, NetInfo).
# Uso: ./kit-ia/ejemplos/tools/verificar_typescript.sh [directorio_de_trabajo]   (requiere npm con acceso al registro)
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
KIT="$(cd "$HERE/../.." && pwd)"
W="${1:-$(mktemp -d)}"
mkdir -p "$W"
cd "$W"

if [ ! -d node_modules/typescript ]; then
  npm init -y >/dev/null
  npm install --no-audit --no-fund --loglevel=error \
    typescript@5 next@15 react@19 react-dom@19 @types/react@19 @types/react-dom@19 @types/node@22 \
    @tanstack/react-query@5 @tanstack/react-table@8 react-hook-form@7 zod@3 @hookform/resolvers@3 \
    openapi-fetch openapi-typescript@7 tailwindcss@3 \
    expo-sqlite@15 @react-native-community/netinfo@11 react-native@0.79 >/dev/null
fi

rm -rf web mobile design
mkdir -p web mobile
cp -r "$KIT/ejemplos/web/src" web/src
cp -r "$KIT/ejemplos/mobile/src" mobile/src
cp -r "$KIT/design" design
npx openapi-typescript "$KIT/api/openapi.yaml" -o web/src/lib/api/schema.d.ts >/dev/null 2>&1
cp web/src/lib/api/schema.d.ts mobile/src/api/schema.d.ts

cat > tsconfig.web.json <<'JSON'
{
  "compilerOptions": {
    "target": "ES2022", "lib": ["dom", "dom.iterable", "ES2022"], "module": "esnext", "moduleResolution": "bundler",
    "jsx": "react-jsx", "strict": true, "noUncheckedIndexedAccess": true, "noEmit": true, "skipLibCheck": true,
    "resolveJsonModule": true, "esModuleInterop": true, "isolatedModules": true, "allowJs": false,
    "baseUrl": ".", "paths": { "@/design/*": ["design/*"], "@/*": ["web/src/*"] }
  },
  "include": ["web/src/**/*.ts", "web/src/**/*.tsx"]
}
JSON
cat > tsconfig.mobile.json <<'JSON'
{
  "compilerOptions": {
    "target": "ES2022", "lib": ["ES2022", "dom"], "module": "esnext", "moduleResolution": "bundler",
    "jsx": "react-jsx", "strict": true, "noUncheckedIndexedAccess": true, "noEmit": true, "skipLibCheck": true,
    "resolveJsonModule": true, "esModuleInterop": true, "isolatedModules": true,
    "baseUrl": ".", "paths": { "@/design/*": ["design/*"], "@/*": ["mobile/src/*"] }
  },
  "include": ["mobile/src/**/*.ts", "mobile/src/**/*.tsx"]
}
JSON

status=0
echo "tsc web/ …";    npx tsc -p tsconfig.web.json    && echo "OK  web: $(find web/src -name '*.ts*' ! -name schema.d.ts | wc -l) archivos sin errores" || status=1
echo "tsc mobile/ …"; npx tsc -p tsconfig.mobile.json && echo "OK  mobile: $(find mobile/src -name '*.ts*' ! -name schema.d.ts | wc -l) archivos sin errores" || status=1
exit $status
