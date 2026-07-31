export class VivinoSelector {
    public static isVivino(): boolean {
      return window.location.hostname.includes("vivino");
    }
  }