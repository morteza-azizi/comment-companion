import { VivinoAdapter } from "../adapters/vivino/vivino-adapter";

const adapter = new VivinoAdapter();

console.log("🍷 Comment Companion loaded");

if (adapter.isSupported()) {
  adapter.inject();
}