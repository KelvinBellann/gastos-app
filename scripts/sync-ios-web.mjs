// Copia o site estatico (out/, gerado por `next build`) para dentro do app iOS em
// ios/Sources/GastosApp/Web, que o Package.swift declara como recurso do bundle.
import { cpSync, existsSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "out");
const target = join(root, "ios", "Sources", "GastosApp", "Web");

if (!existsSync(join(source, "index.html"))) {
  console.error("out/index.html nao existe: rode `next build` primeiro.");
  process.exit(1);
}

rmSync(target, { recursive: true, force: true });
cpSync(source, target, { recursive: true });
console.log(`Site copiado para ${target}`);
