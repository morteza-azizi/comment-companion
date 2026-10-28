import { VivinoAdapter } from "../adapters/vivino/vivino-adapter";

const adapter = new VivinoAdapter();

if (adapter.isSupported()) {
  adapter.inject();
}
