import { expect, test, type Page } from "@playwright/test";
import { cleanup, dayPanel, openCalendarOn, runTag, signIn, userA } from "./support";

const DATE = "2026-10-03"; // a Saturday
const NEXT_DATE = "2026-10-04";

async function fillActivity(page: Page, fields: { title: string; category?: string; start: string; end: string }) {
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("textbox", { name: "Title" }).fill(fields.title);
  if (fields.category) await dialog.getByRole("combobox", { name: "Category" }).selectOption({ label: fields.category });
  await dialog.getByLabel("Start time").fill(fields.start);
  await dialog.getByLabel("End time").fill(fields.end);
}

test.describe("activities", () => {
  let tag: string;

  test.beforeEach(async ({ page }) => {
    tag = runTag();
    await signIn(page, userA);
  });

  test.afterEach(async () => {
    await cleanup(userA, tag);
  });

  test("creates and edits an activity on the correct date, and it persists after reload", async ({ page }) => {
    await openCalendarOn(page, DATE);
    await dayPanel(page).getByRole("button", { name: "Activity", exact: true }).click();

    await fillActivity(page, { title: `${tag} Morning run`, category: "Running", start: "07:00", end: "08:15" });
    await expect(page.getByRole("dialog").getByText("Duration 1h 15m")).toBeVisible();
    await page.getByRole("dialog").getByRole("button", { name: "Save activity" }).click();

    // Only reported as saved after the database confirmed the write.
    await expect(page.getByRole("status").filter({ hasText: "Activity saved" })).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    const panel = dayPanel(page);
    const row = panel.getByRole("button", { name: new RegExp(`Edit ${tag} Morning run`) });
    await expect(row).toBeVisible();
    await expect(row).toContainText("07:00");
    await expect(row).toContainText("08:15");
    await expect(row).toContainText("Running");

    // The month grid shows it on that date - and not on the next day.
    await expect(page.getByRole("gridcell").getByRole("button", { name: /Saturday, 3 October 2026, 1 activity, 1 hour 15 minutes tracked/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Sunday, 4 October 2026, no activities/ })).toBeVisible();

    // Persistence: a full reload reads it back from the database.
    await page.reload();
    await expect(dayPanel(page).getByRole("button", { name: new RegExp(`Edit ${tag} Morning run`) })).toBeVisible();

    // Edit title and end time.
    await dayPanel(page).getByRole("button", { name: new RegExp(`Edit ${tag} Morning run`) }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Edit activity" })).toBeVisible();
    await dialog.getByRole("textbox", { name: "Title" }).fill(`${tag} Long run`);
    await dialog.getByLabel("End time").fill("08:45");
    await dialog.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Activity updated" })).toBeVisible();

    const edited = dayPanel(page).getByRole("button", { name: new RegExp(`Edit ${tag} Long run`) });
    await expect(edited).toContainText("1h 45m");
    await page.reload();
    await expect(dayPanel(page).getByRole("button", { name: new RegExp(`Edit ${tag} Long run`) })).toContainText("08:45");
    await expect(dayPanel(page).getByRole("button", { name: new RegExp(`Edit ${tag} Morning run`) })).toHaveCount(0);

    // Not shown on the following day.
    await page.getByRole("button", { name: /Sunday, 4 October 2026/ }).click();
    await expect(page).toHaveURL(new RegExp(`date=${NEXT_DATE}`));
    await expect(dayPanel(page).getByText("No activities logged")).toBeVisible();
  });

  test("warns about overlapping activities and saves only after confirmation", async ({ page }) => {
    await openCalendarOn(page, DATE);
    const panel = dayPanel(page);

    await panel.getByRole("button", { name: "Activity", exact: true }).click();
    await fillActivity(page, { title: `${tag} Deep work`, category: "Work", start: "09:00", end: "11:00" });
    await page.getByRole("dialog").getByRole("button", { name: "Save activity" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await panel.getByRole("button", { name: "Activity", exact: true }).click();
    await fillActivity(page, { title: `${tag} Call`, category: "Personal", start: "10:30", end: "11:30" });
    await page.getByRole("dialog").getByRole("button", { name: "Save activity" }).click();

    const warning = page.getByRole("dialog").getByRole("alert").filter({ hasText: "Overlaps with 1 activity" });
    await expect(warning).toBeVisible();
    await expect(warning).toContainText(`${tag} Deep work`);
    // Nothing was written yet.
    await expect(panel.getByRole("button", { name: new RegExp(`Edit ${tag} Call`) })).toHaveCount(0);

    await warning.getByRole("button", { name: "Save anyway" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(panel.getByRole("button", { name: new RegExp(`Edit ${tag} Call`) })).toBeVisible();
  });

  test("rejects an end time before the start time", async ({ page }) => {
    await openCalendarOn(page, DATE);
    await dayPanel(page).getByRole("button", { name: "Activity", exact: true }).click();
    await fillActivity(page, { title: `${tag} Backwards`, start: "10:00", end: "09:00" });
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("End must be after the start").first()).toBeVisible();
    await dialog.getByRole("button", { name: "Save activity" }).click();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("textbox", { name: "Title" })).toHaveValue(`${tag} Backwards`);
  });
});
