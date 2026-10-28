import { pathToFileURL } from "node:url";
import path from "node:path";
import { chromium } from "@playwright/test";

const root = path.resolve(import.meta.dirname, "..");
const html = path.join(root, "docs/voluntime-feedback-resolved.html");
const out = path.join(root, "docs/base/VolunTime Feedback for Jason — resolved.pdf");

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(pathToFileURL(html).href, { waitUntil: "load" });
await page.pdf({
  path: out,
  format: "Letter",
  printBackground: true,
  margin: { top: "0.65in", bottom: "0.7in", left: "0.7in", right: "0.7in" },
  displayHeaderFooter: true,
  headerTemplate: "<div></div>",
  footerTemplate: `
    <div style="font-size:9px;color:#666;width:100%;padding:0 28px;display:flex;justify-content:space-between;">
      <span>VolunTime Feedback for Jason — annotated 28 Oct 2026</span>
      <span class="pageNumber"></span>
    </div>
  `,
});
await browser.close();
console.log(out);
