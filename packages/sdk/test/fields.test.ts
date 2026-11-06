import { describe, expect, it } from "vitest";
import { findTargets } from "../src/core.ts";
import { matchField } from "../src/fields.ts";

const input = (attrs: string) => {
  document.body.innerHTML = `<form><input ${attrs}></form>`;
  return document.querySelector("input")!;
};

describe("matchField", () => {
  it.each([
    ['name="church_city"', "city"],
    ['name="churchWebsite"', "website"],
    ['name="church-phone-number"', "phone"],
    ['name="churchname"', "name"],
    ['name="church_name"', "name"],
    ['name="church_city_name"', "city"],
    ['name="church_address_city"', "city"],
    ['name="church_street_address"', "street"],
    ['name="church_address"', "street"],
    ['name="church_zip_code"', "postalCode"],
    ['name="church[postal_code]"', "postalCode"],
    ['name="church_country_name"', "countryName"],
    ['name="church_country"', "country"],
    ['name="church_state"', "region"],
    ['name="church_pastor"', "pastorName"],
    ['id="churchEmail"', "email"],
    ['autocomplete="section-church address-level2"', "city"],
    ['autocomplete="section-church tel"', "phone"],
    ['autocomplete="section-church street-address"', "street"],
  ])("matches %s as %s", (attrs, field) => expect(matchField(input(attrs))).toBe(field));

  it.each([
    ['name="city"'],
    ['name="email"'],
    ['autocomplete="tel"'],
    ['name="church_address_line2"'],
    ['name="church_address2"'],
    ['name="church_address_line_2"'],
    ['name="church_city" type="hidden"'],
    ['name="church_name" type="checkbox"'],
    ['name="church_code"'],
  ])("leaves %s alone", (attrs) => expect(matchField(input(attrs))).toBeNull());

  it("matches plain fields only when generic, and never the person's name or id", () => {
    expect(matchField(input('name="city"'), true)).toBe("city");
    expect(matchField(input('autocomplete="postal-code"'), true)).toBe("postalCode");
    expect(matchField(input('name="zip"'), true)).toBe("postalCode");
    expect(matchField(input('name="name"'), true)).toBeNull();
    expect(matchField(input('name="id"'), true)).toBeNull();
    expect(matchField(input('name="church_name"'), true)).toBe("name");
  });

  it("skips anything inside the widget", () => {
    document.body.innerHTML = `<form><div data-slot="church-lookup"><input name="church_name"></div></form>`;
    expect(matchField(document.querySelector("input")!)).toBeNull();
  });
});

describe("findTargets with a matcher", () => {
  it("lets tags win, honors none, and keeps the first match", () => {
    document.body.innerHTML = `<form>
      <input id="a" name="church_city"><input id="b" name="church_town">
      <input id="c" name="church_phone" data-hmc-field="none">
      <input id="d" name="church_website"><input id="e" data-hmc-field="website">
    </form>`;
    const t = findTargets(document.querySelector("form")!, (el) => matchField(el));
    expect(Object.fromEntries([...t].map(([f, el]) => [f, el.id]))).toEqual({ city: "a", website: "e" });
  });
  it("only reads tags without a matcher", () => {
    document.body.innerHTML = `<form><input name="church_city"><input data-hmc-field="phone"></form>`;
    expect([...findTargets(document.querySelector("form")!).keys()]).toEqual(["phone"]);
  });
});
