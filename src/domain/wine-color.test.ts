import { describe, expect, it } from "vitest";
import { detectWineColor, roseCharacterFor } from "./wine-color";

describe("detectWineColor", () => {
  it("reads rosé from the label even when the grape is a red variety", () => {
    expect(detectWineColor({ wineName: "Whispering Angel Rosé" })).toBe("rose");
    expect(detectWineColor({ wineName: "Pinot Noir Rosato" })).toBe("rose");
    expect(detectWineColor({ wineName: "Garnacha Rosado 2024" })).toBe("rose");
  });

  it("does not treat a rose-petal tasting note as wine color", () => {
    expect(
      detectWineColor({
        wineName: "Barolo",
        reviewText: "Classic rose and tar on the nose.",
      })
    ).toBeUndefined();
  });

  it("treats Tavel and Provence as rosé unless the label says red", () => {
    expect(detectWineColor({ wineName: "Château d'Aqueria", region: "Tavel" })).toBe("rose");
    expect(detectWineColor({ wineName: "Domaine Tempier Rouge", region: "Provence" })).toBeUndefined();
  });

  it("detects sparkling before guessing color from the grape name", () => {
    expect(detectWineColor({ wineName: "Pinot Noir Brut" })).toBe("sparkling");
  });
});

describe("roseCharacterFor", () => {
  it("does not describe Pinot rosé as a steak or tannin wine", () => {
    const rose = roseCharacterFor("Pinot Noir");
    expect(rose.character).toMatch(/chillable|pink|fruit/i);
    expect(rose.pairing).toMatch(/salmon|salad/i);
    expect(rose.pairing).not.toMatch(/steak|duck/i);
  });
});
