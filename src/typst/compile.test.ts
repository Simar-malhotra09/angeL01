import { expect, test } from "bun:test";
import { compileTypst } from "./compile";

test("compiles display math to svg", async () => {
  const result = await compileTypst('t_"token" = m_"model" / b_"mem"', "display");
  expect(result.ok).toBe(true);
  if (!result.ok) {
    return;
  }
  expect(result.svg.startsWith("<svg")).toBe(true);
  expect(result.svg).toContain("viewBox");
});

test("compiles inline math and a raw doc excerpt", async () => {
  const inline = await compileTypst("sum_(i=1)^n i", "inline");
  expect(inline.ok).toBe(true);
  const doc = await compileTypst("#strong[Hello] world", "doc");
  expect(doc.ok).toBe(true);
  if (doc.ok) {
    expect(doc.svg).toContain("<svg");
  }
});

test("serves repeats from the cache", async () => {
  const first = await compileTypst("alpha + beta", "display");
  const second = await compileTypst("alpha + beta", "display");
  expect(first.ok && second.ok).toBe(true);
  if (first.ok && second.ok) {
    expect(second.svg).toBe(first.svg);
  }
});

test("reports typst errors instead of crashing", async () => {
  const result = await compileTypst("#doesnotexist()", "doc");
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.detail.length).toBeGreaterThan(0);
  }
});

test("rejects empty snippets", async () => {
  expect((await compileTypst("   ", "display")).ok).toBe(false);
});

test("svg background is transparent so it blends with the page", async () => {
  const result = await compileTypst("x + 1", "display");
  expect(result.ok).toBe(true);
  if (!result.ok) {
    return;
  }
  expect(result.svg).not.toContain('fill="#ffffff"');
  expect(result.svg).toContain('fill="#2b2822"');
});
