import { LinkedInAdapter } from "../adapters/linkedin/linkedin-adapter";
import { VivinoAdapter } from "../adapters/vivino/vivino-adapter";

const adapters = [new VivinoAdapter(), new LinkedInAdapter()];
const adapter = adapters.find((item) => item.isSupported());

if (adapter) {
  adapter.inject();
}
