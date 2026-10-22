import type { Command, Hello, Show } from "./protocol";

export type LinkStatus = "idle" | "connecting" | "online";

interface Options {
  url: string;
  hello: Hello;
  onShow(show: Show): void;
  onStatus(status: LinkStatus): void;
  onOffset(offset: number): void;
}

const PING_MS = 2000;
const SAMPLES = 8;

export class HubClient {
  private socket: WebSocket | null = null;
  private retry = 0;
  private ping = 0;
  private delay = 1000;
  private stopped = true;
  private samples: { rtt: number; offset: number }[] = [];

  constructor(private options: Options) {}

  start() {
    this.stopped = false;
    this.connect();
  }

  stop() {
    this.stopped = true;
    clearTimeout(this.retry);
    clearInterval(this.ping);
    const socket = this.socket;
    this.socket = null;
    socket?.close();
    this.options.onStatus("idle");
  }

  setHello(hello: Hello) {
    this.options.hello = hello;
    this.send({ t: "hello", ...hello });
  }

  command(command: Command) {
    if (this.socket?.readyState !== WebSocket.OPEN) return false;
    this.socket.send(JSON.stringify({ t: "cmd", cmd: command }));
    return true;
  }

  private send(message: unknown) {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(message));
  }

  private connect() {
    if (this.stopped) return;
    this.options.onStatus("connecting");
    const socket = new WebSocket(this.options.url);
    this.socket = socket;

    socket.addEventListener("open", () => {
      this.delay = 1000;
      this.samples = [];
      this.send({ t: "hello", ...this.options.hello });
      const ping = () => this.send({ t: "ping", c0: Date.now() });
      ping();
      this.ping = window.setInterval(ping, PING_MS);
    });
    socket.addEventListener("message", (event) => {
      let message: { t: string; state?: Show["state"]; roster?: Show["roster"]; c0?: number; s?: number };
      try {
        message = JSON.parse(String(event.data));
      } catch {
        return;
      }
      if (message.t === "show" && message.state && message.roster) {
        this.options.onStatus("online");
        this.options.onShow({ state: message.state, roster: message.roster });
      } else if (message.t === "pong" && typeof message.c0 === "number" && typeof message.s === "number") {
        const now = Date.now();
        const rtt = now - message.c0;
        this.samples.push({ rtt, offset: message.s + rtt / 2 - now });
        if (this.samples.length > SAMPLES) this.samples.shift();
        this.options.onOffset(this.samples.reduce((best, sample) => (sample.rtt < best.rtt ? sample : best)).offset);
      }
    });
    socket.addEventListener("close", () => {
      if (this.socket !== socket) return;
      this.socket = null;
      clearInterval(this.ping);
      if (this.stopped) return;
      this.options.onStatus("connecting");
      this.retry = window.setTimeout(() => this.connect(), this.delay);
      this.delay = Math.min(this.delay * 1.5, 5000);
    });
  }
}
