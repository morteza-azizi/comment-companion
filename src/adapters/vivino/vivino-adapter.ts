import type { SiteAdapter } from "../site-adapter";
import { VivinoInjector } from "./injector";

export class VivinoAdapter implements SiteAdapter {
  public isSupported(): boolean {
    return window.location.hostname.includes("vivino");
  }

  public inject(): void {
    VivinoInjector.inject();
  }
}