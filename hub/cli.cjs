const fs = require("fs");
const path = require("path");
const { PORT, createHub } = require("./hub.cjs");

const arg = (name, fallback) => {
  const at = process.argv.indexOf(`--${name}`);
  return at > 0 && process.argv[at + 1] ? process.argv[at + 1] : fallback;
};

const dir = path.resolve(arg("dir", path.join(__dirname, "..", "out")));
const file = path.join(process.cwd(), ".westbund", "show.json");
const store = {
  load: () => {
    try {
      return JSON.parse(fs.readFileSync(file, "utf8"));
    } catch {
      return null;
    }
  },
  save: (state) => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(state, null, 2));
  },
};

createHub({ port: Number(arg("port", PORT)), staticDir: dir, store }).then(
  (hub) => {
    console.log(`Show host "${hub.name}" listening on port ${hub.port}`);
    if (hub.serving) for (const address of hub.addresses()) console.log(`  screens: http://${address}:${hub.port}`);
    else console.log(`  no exported app at ${dir}; run \`bun run build\` so browsers can load screens from here`);
    const stop = () => hub.stop().then(() => process.exit(0));
    process.on("SIGINT", stop);
    process.on("SIGTERM", stop);
  },
  (error) => {
    console.error(error.code === "EADDRINUSE" ? `Port ${arg("port", PORT)} is already in use; a host may already be running.` : error);
    process.exit(1);
  },
);
