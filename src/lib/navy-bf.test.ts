import { describe, expect, it } from "vitest";
import { navyBodyFat, type Sex } from "./navy-bf";

const CM_PER_IN = 2.54;
/** The inch value of a centimetre measurement. */
const toIn = (cm: number) => cm / CM_PER_IN;

/**
 * Published US Navy *imperial* linear equations, kept here as an independent
 * cross-check for the cm-vs-inch equivalence example:
 *   male:   86.010 × log10(waist − neck) − 70.041 × log10(height) + 36.76
 *   female: 163.205 × log10(waist + hip − neck) − 97.684 × log10(height) − 78.387
 */
function navyImperial(
  sex: Sex,
  heightIn: number,
  neckIn: number,
  waistIn: number,
  hipsIn: number,
): number {
  const log10 = Math.log10;
  return sex === "male"
    ? 86.01 * log10(waistIn - neckIn) - 70.041 * log10(heightIn) + 36.76
    : 163.205 * log10(waistIn + hipsIn - neckIn) -
        97.684 * log10(heightIn) -
        78.387;
}

describe("navyBodyFat known-value sanity", () => {
  it("male 180cm / neck 38 / waist 85 lands in ~15–16%", () => {
    const r = navyBodyFat({
      sex: "male",
      heightCm: 180,
      neckCm: 38,
      waistCm: 85,
    });
    expect(r).not.toBeNull();
    expect(r?.bfPercent).toBeGreaterThanOrEqual(15);
    expect(r?.bfPercent).toBeLessThanOrEqual(16.5);
    expect(r?.bfPercent).toBeCloseTo(16.1, 1); // 16.1068… rounds to 16.1
  });

  it("female 165cm / neck 33 / waist 78 / hips 98 lands in ~26–30%", () => {
    const r = navyBodyFat({
      sex: "female",
      heightCm: 165,
      neckCm: 33,
      waistCm: 78,
      hipsCm: 98,
    });
    expect(r).not.toBeNull();
    expect(r?.bfPercent).toBeGreaterThanOrEqual(26);
    expect(r?.bfPercent).toBeLessThanOrEqual(30);
    expect(r?.bfPercent).toBeCloseTo(29.9, 1); // 29.9301… rounds to 29.9
  });

  it("rounds to one decimal (raw male value is 16.1068…)", () => {
    const r = navyBodyFat({
      sex: "male",
      heightCm: 180,
      neckCm: 38,
      waistCm: 85,
    });
    expect(r?.bfPercent).toBe(16.1);
  });
});

describe("navyBodyFat cm-vs-inch documented example equivalence", () => {
  it("same body entered in cm matches the published imperial-inch equation (male)", () => {
    // Example body: 180 cm / 70.866 in tall, neck 38 cm / 14.961 in, waist 85 cm / 33.465 in.
    // cm path through navyBodyFat: 16.1. Published imperial equation on the
    // inch values: 86.010×log10(18.504) − 70.041×log10(70.866) + 36.76 ≈ 16.1.
    const cmResult = navyBodyFat({
      sex: "male",
      heightCm: 180,
      neckCm: 38,
      waistCm: 85,
    })?.bfPercent;
    const inchResult = navyImperial("male", toIn(180), toIn(38), toIn(85), 0);
    expect(cmResult).toBeDefined();
    expect(Math.abs((cmResult as number) - inchResult)).toBeLessThanOrEqual(
      0.5,
    );
  });

  it("same body entered in cm matches the published imperial-inch equation (female)", () => {
    // Example body: 165 cm / 64.961 in, neck 33 cm / 12.992 in, waist 78 cm /
    // 30.709 in, hips 98 cm / 38.583 in.
    const cmResult = navyBodyFat({
      sex: "female",
      heightCm: 165,
      neckCm: 33,
      waistCm: 78,
      hipsCm: 98,
    })?.bfPercent;
    const inchResult = navyImperial(
      "female",
      toIn(165),
      toIn(33),
      toIn(78),
      toIn(98),
    );
    expect(cmResult).toBeDefined();
    expect(Math.abs((cmResult as number) - inchResult)).toBeLessThanOrEqual(
      0.5,
    );
  });

  it("feeding the inch numbers converted back to cm gives the identical result", () => {
    // The coefficients were fitted on cm, so calculators that accept inches
    // convert first. Passing cm-converted inch values must be a no-op.
    const direct = navyBodyFat({
      sex: "male",
      heightCm: 180,
      neckCm: 38,
      waistCm: 85,
    });
    const viaInches = navyBodyFat({
      sex: "male",
      heightCm: 70.8661417 * CM_PER_IN,
      neckCm: 14.9606299 * CM_PER_IN,
      waistCm: 33.4645669 * CM_PER_IN,
    });
    expect(viaInches?.bfPercent).toBe(direct?.bfPercent);
  });
});

describe("navyBodyFat null cases", () => {
  it("female with missing hips returns null", () => {
    expect(
      navyBodyFat({ sex: "female", heightCm: 165, neckCm: 33, waistCm: 78 }),
    ).toBeNull();
    expect(
      navyBodyFat({
        sex: "female",
        heightCm: 165,
        neckCm: 33,
        waistCm: 78,
        hipsCm: null,
      }),
    ).toBeNull();
  });

  it("male with waist <= neck returns null", () => {
    expect(
      navyBodyFat({ sex: "male", heightCm: 180, neckCm: 40, waistCm: 40 }),
    ).toBeNull();
    expect(
      navyBodyFat({ sex: "male", heightCm: 180, neckCm: 40, waistCm: 39 }),
    ).toBeNull();
  });

  it("female with waist + hips <= neck returns null", () => {
    expect(
      navyBodyFat({
        sex: "female",
        heightCm: 165,
        neckCm: 100,
        waistCm: 60,
        hipsCm: 40,
      }),
    ).toBeNull();
  });

  it("zero or negative height returns null", () => {
    expect(
      navyBodyFat({ sex: "male", heightCm: 0, neckCm: 38, waistCm: 85 }),
    ).toBeNull();
    expect(
      navyBodyFat({
        sex: "female",
        heightCm: -170,
        neckCm: 33,
        waistCm: 78,
        hipsCm: 98,
      }),
    ).toBeNull();
  });

  it("missing / null / non-finite inputs return null", () => {
    expect(
      navyBodyFat({ sex: null, heightCm: 180, neckCm: 38, waistCm: 85 }),
    ).toBeNull();
    expect(
      navyBodyFat({ sex: "male", heightCm: null, neckCm: 38, waistCm: 85 }),
    ).toBeNull();
    expect(
      navyBodyFat({
        sex: "male",
        heightCm: 180,
        neckCm: undefined,
        waistCm: 85,
      }),
    ).toBeNull();
    expect(
      navyBodyFat({ sex: "male", heightCm: 180, neckCm: 38, waistCm: NaN }),
    ).toBeNull();
    expect(
      navyBodyFat({
        sex: "female",
        heightCm: 165,
        neckCm: 33,
        waistCm: 78,
        hipsCm: Number.NaN,
      }),
    ).toBeNull();
  });
});

describe("navyBodyFat plausibility bounds (2–80)", () => {
  it("implausibly low estimate (waist barely above neck) returns null", () => {
    // raw estimate is deeply negative → below the 2% floor
    expect(
      navyBodyFat({ sex: "male", heightCm: 180, neckCm: 40, waistCm: 40.1 }),
    ).toBeNull();
  });

  it("implausibly high estimate returns null", () => {
    // male waist−neck > ~221cm pushes the raw estimate past 80%
    expect(
      navyBodyFat({ sex: "male", heightCm: 180, neckCm: 38, waistCm: 260 }),
    ).toBeNull();
    // female waist+hips−neck > ~271cm likewise
    expect(
      navyBodyFat({
        sex: "female",
        heightCm: 165,
        neckCm: 28,
        waistCm: 150,
        hipsCm: 150,
      }),
    ).toBeNull();
  });

  it("hips are ignored for male estimates", () => {
    const without = navyBodyFat({
      sex: "male",
      heightCm: 180,
      neckCm: 38,
      waistCm: 85,
    });
    const withHips = navyBodyFat({
      sex: "male",
      heightCm: 180,
      neckCm: 38,
      waistCm: 85,
      hipsCm: 98,
    });
    expect(withHips?.bfPercent).toBe(without?.bfPercent);
  });
});
