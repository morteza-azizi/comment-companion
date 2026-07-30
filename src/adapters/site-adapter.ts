export interface SiteAdapter {
    isSupported(): boolean;
    inject(): void;
  }