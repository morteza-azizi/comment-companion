import type { SiteAdapter } from "../site-adapter";
import { VivinoInjector } from "./injector";

export class VivinoAdapter implements SiteAdapter {
  public isSupported(): boolean {
    return window.location.hostname === "vivino.com" || window.location.hostname.endsWith(".vivino.com");
  }

  public inject(): void {
    VivinoInjector.inject();
  }
}
