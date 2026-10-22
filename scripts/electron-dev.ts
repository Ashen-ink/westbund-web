const url = "http://localhost:3000";

const next = Bun.spawn(["bun", "--bun", "next", "dev"], { stdio: ["inherit", "inherit", "inherit"] });

while (true) {
  try {
    await fetch(url);
    break;
  } catch {
    if (next.exitCode !== null) process.exit(next.exitCode);
    await Bun.sleep(300);
  }
}

const electron = Bun.spawn(["electron", "."], {
  env: { ...process.env, ELECTRON_START_URL: url },
  stdio: ["inherit", "inherit", "inherit"],
});

const stop = () => {
  electron.kill();
  next.kill();
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
await Promise.race([electron.exited, next.exited]);
stop();
