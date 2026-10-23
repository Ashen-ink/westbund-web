import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const repoRoot = path.resolve(import.meta.dirname, "..");
const outputFile = path.join(repoRoot, "components/icons/icon-data.ts");
const entry = [path.join(repoRoot, "node_modules/@central-icons-react/all/index.mjs")].find(
  (candidate) => fs.existsSync(candidate),
);

const scanRoots = ["app", "components", "runtime"].map((directory) =>
  path.join(repoRoot, directory),
);
const skipDirectories = new Set([
  "node_modules",
  ".next",
  ".git",
  "OLD",
]);
const sourceExtensions = new Set([".ts", ".tsx"]);

const variants = ["outlined", "filled"].map((fill) => ({ join: "round", fill, radius: "3", stroke: "1.5" }));

function walk(directory, visit) {
  if (!fs.existsSync(directory)) return;
  for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
    if (item.isDirectory()) {
      if (skipDirectories.has(item.name)) continue;
      walk(path.join(directory, item.name), visit);
    } else if (sourceExtensions.has(path.extname(item.name))) {
      visit(path.join(directory, item.name));
    }
  }
}

function collectUsedNames() {
  const names = new Set();
  for (const root of scanRoots) {
    walk(root, (filePath) => {
      if (path.resolve(filePath) === outputFile) return;
      const source = fs.readFileSync(filePath, "utf8");
      for (const match of source.matchAll(/['"`](Icon[A-Za-z0-9]+)['"`]/g)) {
        names.add(match[1]);
      }
    });
  }
  return [...names].sort();
}

function readObjectAt(source, start) {
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'" || char === "`") quote = char;
    else if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error("Unbalanced object literal in the Central Icons bundle.");
}

function readCentralIconsBundle() {
  if (!entry) {
    throw new Error(
      "@central-icons-react/all is not installed. Run bun install first.",
    );
  }
  const source = fs.readFileSync(entry, "utf8");

  const metadataMatch = source.match(
    /[=,]\s*(\{\s*Icon[A-Za-z0-9]+\s*:\s*\{\s*title\s*:)/,
  );
  if (!metadataMatch) {
    throw new Error("Could not locate the icon metadata object.");
  }
  const metadataStart = metadataMatch.index + metadataMatch[0].indexOf("{");

  const iconsMatch = source.match(
    /[=,]\s*(\{\s*"(?:round|square)-(?:outlined|filled)-radius-\d-stroke-[\d.]+\/Icon)/,
  );
  if (!iconsMatch) {
    throw new Error("Could not locate the icon markup object.");
  }
  const iconsStart = iconsMatch.index + iconsMatch[0].indexOf("{");

  return {
    metadata: vm.runInNewContext(`(${readObjectAt(source, metadataStart)})`),
    icons: vm.runInNewContext(`(${readObjectAt(source, iconsStart)})`),
  };
}

function renderRecord(name, entries, suffix = "") {
  const body = entries
    .map(([key, value]) => `  ${JSON.stringify(key)}: ${JSON.stringify(value)}`)
    .join(",\n");
  return `export const ${name} = {\n${body}\n} as const${suffix};`;
}

function renderUnion(values) {
  return values.map((value) => `"${value}"`).join(" | ");
}

const usedNames = collectUsedNames();
const { metadata, icons } = readCentralIconsBundle();

const missing = usedNames.filter((name) => !metadata[name]);
if (missing.length > 0) {
  throw new Error(`Unknown icon names: ${missing.join(", ")}`);
}

const metadataEntries = usedNames.map((name) => [
  name,
  { title: metadata[name].title },
]);

const iconEntries = [];
for (const name of usedNames) {
  for (const variant of variants) {
    const key = `${variant.join}-${variant.fill}-radius-${variant.radius}-stroke-${variant.stroke}/${name}`;
    const markup = icons[key];
    if (!markup) throw new Error(`Missing icon variant ${key}`);
    iconEntries.push([key, markup]);
  }
}

const unique = (values) => [...new Set(values)];

const output = `${renderRecord("centralIconsMetadata", metadataEntries)}

export type CentralIconName = keyof typeof centralIconsMetadata;
export type CentralIconJoin = ${renderUnion(unique(variants.map((v) => v.join)))};
export type CentralIconFill = ${renderUnion(unique(variants.map((v) => v.fill)))};
export type CentralIconRadius = ${renderUnion(unique(variants.map((v) => v.radius)))};
export type CentralIconStroke = ${renderUnion(unique(variants.map((v) => v.stroke)))};
export type CentralIconPackageName =
  \`\${CentralIconJoin}-\${CentralIconFill}-radius-\${CentralIconRadius}-stroke-\${CentralIconStroke}\`;
export type CentralIconImportName =
  \`\${CentralIconPackageName}/\${CentralIconName}\`;

${renderRecord("centralIcons", iconEntries, " satisfies Record<CentralIconImportName, string>")}
`;

fs.writeFileSync(outputFile, output);
console.log(
  `Generated icon-data.ts with ${usedNames.length} icons and ${iconEntries.length} variants.`,
);
