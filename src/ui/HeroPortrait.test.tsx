// @vitest-environment jsdom
import { afterEach, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { HeroPortrait } from "./HeroPortrait";
afterEach(cleanup);
it("displays a mapped portrait with an accessible name and lazy loading", () => {
  render(<HeroPortrait hero={{ id: "Ada", name: "Ada" }} />);
  const img = screen.getByRole("img", { name: "Ada portrait" });
  expect(img.getAttribute("src")).toBe("/portraits/ada.png");
  expect(img.getAttribute("loading")).toBe("lazy");
  expect(img.getAttribute("title")).toContain("your entered stars and levels are shown separately");
});
it("renders a neutral fallback for missing mappings without attempting a guessed URL", () => {
  render(<HeroPortrait hero={{ id: "Iwakado", name: "Iwakado" }} />);
  const fallback = screen.getByRole("img", { name: "Iwakado portrait unavailable" });
  expect(fallback.tagName).toBe("SPAN");
  expect(fallback.querySelector("svg")).toBeTruthy();
  expect(fallback.querySelector("img")).toBeNull();
});
it("falls back on load errors and allows a different hero's portrait on rerender", () => {
  const { rerender } = render(<HeroPortrait hero={{ id: "Ada", name: "Ada" }} size="formation" />);
  fireEvent.error(screen.getByRole("img", { name: "Ada portrait" }));
  expect(screen.getByRole("img", { name: "Ada portrait unavailable" }).tagName).toBe("SPAN");
  rerender(<HeroPortrait hero={{ id: "Mia", name: "Mia" }} size="formation" />);
  expect(screen.getByRole("img", { name: "Mia portrait" }).getAttribute("src")).toBe("/portraits/mia-scarlet-pyros.png");
});
