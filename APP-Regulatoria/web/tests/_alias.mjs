// Resuelve el alias "@/" de Next para las pruebas que importan módulos de lib/
// que lo usan (igual que scripts/eval-*.mjs). Se importa ANTES que el módulo
// bajo prueba, con import() dinámico, porque los import estáticos se resuelven
// antes de que corra cualquier línea del archivo.
import fs from "node:fs";
import path from "node:path";
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

registerHooks({
  resolve(esp, ctx, next) {
    if (esp.startsWith("@/")) {
      const base = path.join(WEB, esp.slice(2));
      return next(pathToFileURL(fs.existsSync(`${base}.ts`) ? `${base}.ts` : base).href, ctx);
    }
    return next(esp, ctx);
  },
});
