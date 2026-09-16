import { mkdir, rm } from "node:fs/promises"
import { createRequire } from "node:module"
import { dirname, join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const require = createRequire(import.meta.url)
const { chromium } = require("playwright")

const sourceDir = dirname(fileURLToPath(import.meta.url))
const framesDir = join(sourceDir, "frames")
const fps = 30
const duration = 24.5
const totalFrames = fps * duration
const startFrame = Math.max(0, Number(process.env.START_FRAME || 0))
const endFrame = Math.min(totalFrames, Number(process.env.END_FRAME || totalFrames))

if (startFrame === 0) await rm(framesDir, { recursive: true, force: true })
await mkdir(framesDir, { recursive: true })

const browser = await chromium.launch({
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  headless: true,
  args: ["--allow-file-access-from-files", "--disable-gpu-vsync"],
})

const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 })
await page.goto(pathToFileURL(join(sourceDir, "render.html")).href, { waitUntil: "load" })
await page.evaluate(() => document.fonts.ready)

for (let frame = startFrame; frame < endFrame; frame += 1) {
  const t = frame / fps
  await page.evaluate((time) => window.renderAt(time), t)
  await page.screenshot({
    path: join(framesDir, `frame-${String(frame).padStart(5, "0")}.png`),
    type: "png",
  })
  if (frame % 90 === 0) process.stdout.write(`Rendered ${frame}/${totalFrames} frames\n`)
}

await browser.close()
process.stdout.write(`Rendered ${totalFrames} frames to ${framesDir}\n`)
