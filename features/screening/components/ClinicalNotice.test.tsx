import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import {
  ClinicalNotice,
  DEFAULT_SCREENING_DISCLAIMER,
  WARNING_NOTICE_SESSION_KEY,
} from "./ClinicalNotice";

describe("ClinicalNotice", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("collapses the detailed review notice into a persistent reminder", async () => {
    const user = userEvent.setup();
    render(<ClinicalNotice />);

    await user.click(
      screen.getByRole("button", { name: "Dismiss clinical review notice" }),
    );

    expect(screen.getByText("Clinical review required")).toBeTruthy();
    expect(screen.queryByText(DEFAULT_SCREENING_DISCLAIMER)).toBeNull();

    await user.click(
      screen.getByRole("button", { name: "Show clinical review notice" }),
    );
    expect(screen.getByText(DEFAULT_SCREENING_DISCLAIMER)).toBeTruthy();
  });

  it("dismisses measurement warnings", async () => {
    const user = userEvent.setup();
    render(<ClinicalNotice warnings={["Check image positioning."]} />);

    await user.click(
      await screen.findByRole("button", {
        name: "Dismiss image quality and measurement warnings",
      }),
    );

    expect(screen.queryByText("Check image positioning.")).toBeNull();
    expect(sessionStorage.getItem(WARNING_NOTICE_SESSION_KEY)).toBe("true");
  });

  it("keeps warnings dismissed for later predictions in the same session", async () => {
    const user = userEvent.setup();
    const { rerender, unmount } = render(
      <ClinicalNotice warnings={["First warning."]} />,
    );

    await user.click(
      await screen.findByRole("button", {
        name: "Dismiss image quality and measurement warnings",
      }),
    );
    rerender(<ClinicalNotice warnings={["New warning."]} />);

    expect(screen.queryByText("New warning.")).toBeNull();

    unmount();
    render(<ClinicalNotice warnings={["Warning after remount."]} />);
    expect(screen.queryByText("Warning after remount.")).toBeNull();
  });
});
