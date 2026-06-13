import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";

const root = process.cwd();
const sourcePath = path.resolve(root, "../stock-ice-scroll.jsx");
const targetPath = path.resolve(root, "src/data/defaultProducts.js");

const source = fs.readFileSync(sourcePath, "utf8");

function extractConst(name) {
  const match = source.match(new RegExp(`const ${name} = ([\\s\\S]*?);\\n`));
  if (!match) throw new Error(`No se pudo extraer ${name}`);
  return match[1];
}

const categorias = vm.runInNewContext(extractConst("CATEGORIAS"));
const proveedores = vm.runInNewContext(extractConst("PROVEEDORES"));
const tiposMov = vm.runInNewContext(extractConst("TIPOS_MOV"));
const responsables = vm.runInNewContext(extractConst("RESPONSABLES"));
const productsMatch = source.match(/const PRODUCTOS_INIT = ([\s\S]*?\]\.map\(p => \(\{ \.\.\.p, stockInicial:0, stockMinimo:0, stockObjetivo:0, activo:true, observaciones:"" \}\)\));/);

if (!productsMatch) throw new Error("No se pudo extraer PRODUCTOS_INIT");

const products = vm.runInNewContext(productsMatch[1]);

const file = `export const CATEGORIAS = ${JSON.stringify(categorias, null, 2)};

export const PROVEEDORES = ${JSON.stringify(proveedores, null, 2)};
export const TIPOS_MOV = ${JSON.stringify(tiposMov, null, 2)};
export const RESPONSABLES = ${JSON.stringify(responsables, null, 2)};

export const DEFAULT_PRODUCTS = ${JSON.stringify(products, null, 2)}.map((product) => ({
  ...product,
  updatedAt: Date.now(),
}));
`;

fs.writeFileSync(targetPath, file);
console.log(`Exportados ${products.length} productos a ${path.relative(root, targetPath)}`);
