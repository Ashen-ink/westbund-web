export interface ElectronInfo {
  displayKey: string;
  name: string;
  label: string;
  hint: number;
  role: "host" | "client";
  hubUrl: string | null;
  hosting: { port: number; addresses: string[]; serving: boolean } | null;
  hubError: string | null;
  discovered: { name: string; address: string }[];
}

type RoleChoice = { role: "host" } | { role: "client"; address?: string };

declare global {
  interface Window {
    westbund?: {
      getInfo(): Promise<ElectronInfo | null>;
      onInfo(callback: (info: ElectronInfo) => void): () => void;
      setRole(choice: RoleChoice): Promise<void>;
      setName(name: string): Promise<void>;
    };
  }
}
