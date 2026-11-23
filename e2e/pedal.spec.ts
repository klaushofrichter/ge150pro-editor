// The editor against the simulated pedal (fake-pedal.ts): the real WebHID code path, from the connect sequence to
// store, footswitch reports, disconnects and writing an arrangement with its read-back.
import { expect, test, type Page } from "@playwright/test";
import { fakePedal, received } from "./fake-pedal";
import { preset, returning, watchErrors, slot, writeButton } from "./helpers";

test.beforeEach(({ page }) => returning(page));

const pedal = <T>(page: Page, fn: string) =>
  page.evaluate(`window.__pedal.${fn}`) as Promise<T>;
const cmds = async (page: Page) => (await received(page)).map((m) => m.cmd);

test("connects by itself, sends the connect sequence in order, loads 200 presets and shows the current one", async ({
  page,
}) => {
  const errors = watchErrors(page);
  await fakePedal(page, { current: 5 });
  await page.goto("./");
  await expect(page.locator(".presets li")).toHaveCount(200);
  await expect(page.locator(".pname")).toHaveText("Clean 2"); // 02A
  expect((await cmds(page)).slice(0, 5)).toEqual([
    0x31, 0xa0, 0xc1, 0x8c, 0xb0,
  ]);
  await expect(page.getByText("The pedal is not connected.")).toBeHidden();
  await expect(page.locator(".error")).toBeHidden();
  expect(errors).toEqual([]);
});

test("a footswitch on the pedal selects the preset here; a click here selects it on the pedal", async ({
  page,
}) => {
  await fakePedal(page, { current: 1 });
  await page.goto("./");
  await expect(page.locator(".pname")).toHaveText("Clean 1");
  await pedal(page, "press(9)");
  await expect(page.locator(".pname")).toHaveText("Clean 3"); // 03A
  await preset(page, "04B").click();
  await expect(page.locator(".pname")).toHaveText("Crunch 4");
  await expect
    .poll(async () => (await received(page, 0x96)).at(-1)?.payload[0])
    .toBe(14);
  await expect.poll(() => pedal<number>(page, "state.current")).toBe(14);
});

test("an edit is sent live; Store writes the preset to its slot and the pedal acknowledges it", async ({
  page,
}) => {
  const errors = watchErrors(page);
  page.on("dialog", (d) => d.accept()); // the name prompt: keep the name
  await fakePedal(page, { current: 5 });
  await page.goto("./");
  await expect(page.locator(".pname")).toHaveText("Clean 2");
  await page.getByRole("button", { name: /^AMP/ }).click();
  const gain = page.locator(".params input[type=range]").first();
  const before = Number(await gain.inputValue());
  await page
    .getByRole("button", { name: /^Increase / })
    .first()
    .click();
  await expect(page.locator(".pname")).toHaveText("Clean 2 *");
  // AMP is slot 2: 84 with on, type and the values (u16 LE); GAIN first
  await expect
    .poll(async () => (await received(page, 0x84)).length)
    .toBeGreaterThan(0);
  const sent = (await received(page, 0x84)).at(-1)!.payload;
  expect(sent[4] | (sent[5] << 8)).toBe(before + 1);
  expect(await pedal<number[][]>(page, "state.live[2]")).toEqual(
    sent.slice(0, 24),
  );

  await page.getByRole("button", { name: "Store preset" }).click();
  await expect(page.locator(".pname")).toHaveText("Clean 2");
  const store = (await received(page, 0xc3)).at(-1)!.payload;
  expect(store[0]).toBe(5);
  const stored = await pedal<number[]>(page, "state.presets[4]");
  expect(stored[17 + 2 * 24 + 4] | (stored[17 + 2 * 24 + 5] << 8)).toBe(
    before + 1,
  );
  expect(errors).toEqual([]);
});

test("pulling the cable shows the not-connected warning", async ({ page }) => {
  await fakePedal(page);
  await page.goto("./");
  await expect(page.locator(".presets li")).toHaveCount(200);
  await pedal(page, "unplug()");
  await expect(page.getByText("The pedal is not connected.")).toBeVisible();
});

test("a pedal that cannot be opened is reported with what to do", async ({
  page,
}) => {
  await fakePedal(page, { busy: true });
  await page.goto("./");
  await expect(page.locator(".error")).toContainText(
    "Could not open the GE150 Pro",
  );
});

test("writing an arrangement stores each changed slot, then reads every preset back and finds them equal", async ({
  page,
}) => {
  const errors = watchErrors(page);
  page.on("dialog", (d) => d.accept());
  await fakePedal(page, { current: 1 });
  await page.goto("./");
  await expect(page.locator(".presets li")).toHaveCount(200);
  await page
    .getByRole("button", { name: "Arrange and back up presets" })
    .click();
  await expect(slot(page, 0)).toContainText("Clean 1");
  await page
    .locator(".bank-title")
    .nth(0)
    .dragTo(page.locator(".bank-title").nth(1));
  await expect(writeButton(page)).toHaveText(/Write 8 changes/);
  await writeButton(page).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Write 8 presets" })
    .click();
  await expect(page.locator(".progress")).toContainText(
    "8 presets written and read back",
    { timeout: 20000 },
  );
  const stores = (await received(page, 0xc3))
    .map((m) => m.payload[0])
    .sort((a, b) => a - b);
  expect(stores).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  const name = (b: number[]) =>
    String.fromCharCode(...b.slice(1, 17)).replace(/\0+$/, "");
  expect(name(await pedal<number[]>(page, "state.presets[0]"))).toBe("Clean 2");
  expect(name(await pedal<number[]>(page, "state.presets[4]"))).toBe("Clean 1");
  expect(errors).toEqual([]);
});
