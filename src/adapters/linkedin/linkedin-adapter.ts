import type { SiteAdapter } from "../site-adapter";
import { LinkedInInjector } from "./injector";

export class LinkedInAdapter implements SiteAdapter {
  public isSupported(): boolean {
    return window.location.hostname.includes("linkedin.com");
  }

  public inject(): void {
    LinkedInInjector.inject();
  }
}
