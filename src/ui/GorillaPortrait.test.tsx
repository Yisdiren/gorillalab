// @vitest-environment jsdom
import { afterEach, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { GorillaPortrait, gorillaPortraits } from "./GorillaPortrait";
import { eventData, eventDisplayName } from "../data/events";
import { existsSync } from "node:fs";
afterEach(cleanup);
it("maps all seven configured events to distinct existing source crops", () => {
  expect(Object.keys(gorillaPortraits)).toHaveLength(7);
  expect(new Set(Object.values(gorillaPortraits)).size).toBe(7);
  for (const event of eventData.events) {
    const { unmount } = render(<GorillaPortrait eventId={event.id} />);
    const img = screen.getByRole("img", { name: `${eventDisplayName(event.id)} portrait` });
    expect(img.getAttribute("src")).toBe(`/gorillas/${event.id}.png`);
    expect(existsSync(`public${gorillaPortraits[event.id]}`)).toBe(true);
    unmount();
  }
});
it("uses a labeled fallback for absent and failed artwork without guessing", () => {
  const { rerender } = render(<GorillaPortrait eventId="space" />);
  fireEvent.error(screen.getByRole("img", { name: "Space Gorilla portrait" }));
  expect(screen.getByRole("img", { name: "Space Gorilla portrait unavailable" }).tagName).toBe("SPAN");
  rerender(<GorillaPortrait eventId="wise" />);
  expect(screen.getByRole("img", { name: "Wise Gorilla portrait" }).tagName).toBe("IMG");
  rerender(<GorillaPortrait eventId="unknown" />);
  expect(screen.getByRole("img").tagName).toBe("SPAN");
});
