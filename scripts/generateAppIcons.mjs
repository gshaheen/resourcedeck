import fs from 'fs'
import path from 'path'
import zlib from 'zlib'
import { execSync } from 'child_process'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')

// CRC32 table
const crcTable = new Uint32Array(256)
for (let n = 0; n < 256; n++) {
  let c = n
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  }
  crcTable[n] = c >>> 0
}

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  }
  return (c ^ 0xffffffff) >>> 0
}

function writeChunk(type, data) {
  const len = data.length
  const chunk = Buffer.alloc(12 + len)
  chunk.writeUInt32BE(len, 0)
  chunk.write(type, 4, 4, 'ascii')
  data.copy(chunk, 8)
  const typeAndData = chunk.subarray(4, 8 + len)
  chunk.writeUInt32BE(crc32(typeAndData), 8 + len)
  return chunk
}

function encodePNG(width, height, rgbaBuffer) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdrData = Buffer.alloc(13)
  ihdrData.writeUInt32BE(width, 0)
  ihdrData.writeUInt32BE(height, 4)
  ihdrData[8] = 8 // bit depth
  ihdrData[9] = 6 // RGBA
  ihdrData[10] = 0 // deflate
  ihdrData[11] = 0 // adaptive filter
  ihdrData[12] = 0 // no interlace
  const ihdr = writeChunk('IHDR', ihdrData)

  const scanlineLength = 1 + width * 4
  const rawData = Buffer.alloc(height * scanlineLength)
  for (let y = 0; y < height; y++) {
    const rowOffset = y * scanlineLength
    rawData[rowOffset] = 0
    rgbaBuffer.copy(rawData, rowOffset + 1, y * width * 4, (y + 1) * width * 4)
  }

  const compressed = zlib.deflateSync(rawData, { level: 9 })
  const idat = writeChunk('IDAT', compressed)
  const iend = writeChunk('IEND', Buffer.alloc(0))

  return Buffer.concat([signature, ihdr, idat, iend])
}

// Signed distance to a rounded box
function sdRoundedBox(px, py, bx, by, r) {
  const qx = Math.abs(px) - bx + r
  const qy = Math.abs(py) - by + r
  return Math.min(Math.max(qx, qy), 0) + Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) - r
}

// Generate the master 1024x1024 RGBA icon buffer (solid square dark block)
function generateMasterIcon(size = 1024) {
  const buffer = Buffer.alloc(size * size * 4)

  // Standard macOS icon grid for square shapes: 824x824 centered in 1024x1024
  const blockSize = 824
  const blockHalf = blockSize / 2
  const blockCenter = size / 2

  // Strict brand color palette: Super Dark Grey #121214
  const rBlock = 18
  const gBlock = 18
  const bBlock = 20

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4

      // Distance to square block with sharp 90-degree corners
      const dx = Math.abs(x - blockCenter) - blockHalf
      const dy = Math.abs(y - blockCenter) - blockHalf
      const dBox = Math.max(dx, dy)

      if (dBox > 1.0) {
        buffer[idx] = 0
        buffer[idx + 1] = 0
        buffer[idx + 2] = 0
        buffer[idx + 3] = 0
        continue
      }

      // Anti-aliasing alpha along the sharp edges
      const alpha = Math.max(0, Math.min(1, 0.5 - dBox))

      // Architectural subtle edge highlight (1.5px) so the block remains distinctly visible on pure black screens
      let r = rBlock
      let g = gBlock
      let b = bBlock

      if (dBox >= -2.0) {
        const rimStrength = (1 - Math.abs(dBox + 0.5) / 2.0) * 0.12
        r = Math.min(255, Math.round(r + 255 * rimStrength))
        g = Math.min(255, Math.round(g + 255 * rimStrength))
        b = Math.min(255, Math.round(b + 255 * rimStrength))
      }

      buffer[idx] = r
      buffer[idx + 1] = g
      buffer[idx + 2] = b
      buffer[idx + 3] = Math.round(alpha * 255)
    }
  }

  return buffer
}

// Create a Windows .ico binary buffer from multiple PNG buffers
function createIco(pngBuffersWithSize) {
  // pngBuffersWithSize: array of { size: number, buffer: Buffer }
  const count = pngBuffersWithSize.length
  const headerLen = 6
  const dirEntryLen = 16
  let offset = headerLen + dirEntryLen * count

  const header = Buffer.alloc(headerLen)
  header.writeUInt16LE(0, 0) // reserved
  header.writeUInt16LE(1, 2) // type 1 = icon
  header.writeUInt16LE(count, 4)

  const entries = []
  for (const item of pngBuffersWithSize) {
    const entry = Buffer.alloc(dirEntryLen)
    const dim = item.size >= 256 ? 0 : item.size
    entry.writeUInt8(dim, 0) // width
    entry.writeUInt8(dim, 1) // height
    entry.writeUInt8(0, 2) // color count
    entry.writeUInt8(0, 3) // reserved
    entry.writeUInt16LE(1, 4) // color planes
    entry.writeUInt16LE(32, 6) // bits per pixel
    entry.writeUInt32LE(item.buffer.length, 8) // size of image
    entry.writeUInt32LE(offset, 12) // offset
    entries.push(entry)
    offset += item.buffer.length
  }

  return Buffer.concat([header, ...entries, ...pngBuffersWithSize.map((i) => i.buffer)])
}

async function main() {
  if (process.platform !== 'darwin') {
    console.log(
      `Skipping macOS icon generation on ${process.platform}. Pre-generated icons in build/ and resources/ are preserved.`
    )
    return
  }

  console.log('Generating resourcedeck 1024x1024 master icon...')

  const buildDir = path.join(rootDir, 'build')
  const resourcesDir = path.join(rootDir, 'resources')
  const iconsetDir = path.join(buildDir, 'icon.iconset')

  if (!fs.existsSync(buildDir)) fs.mkdirSync(buildDir, { recursive: true })
  if (!fs.existsSync(resourcesDir)) fs.mkdirSync(resourcesDir, { recursive: true })
  if (fs.existsSync(iconsetDir)) fs.rmSync(iconsetDir, { recursive: true, force: true })
  fs.mkdirSync(iconsetDir, { recursive: true })

  // 1. Encode Master 1024x1024 PNG
  const rgba = generateMasterIcon(1024)
  const masterPngBuffer = encodePNG(1024, 1024, rgba)
  const masterPngPath = path.join(buildDir, 'icon.png')
  fs.writeFileSync(masterPngPath, masterPngBuffer)
  fs.writeFileSync(path.join(resourcesDir, 'icon.png'), masterPngBuffer)
  console.log(`Saved master icon to ${masterPngPath}`)

  // 2. Generate macOS .iconset sizes using sips
  const iconsetSpecs = [
    { name: 'icon_16x16.png', size: 16 },
    { name: 'icon_16x16@2x.png', size: 32 },
    { name: 'icon_32x32.png', size: 32 },
    { name: 'icon_32x32@2x.png', size: 64 },
    { name: 'icon_128x128.png', size: 128 },
    { name: 'icon_128x128@2x.png', size: 256 },
    { name: 'icon_256x256.png', size: 256 },
    { name: 'icon_256x256@2x.png', size: 512 },
    { name: 'icon_512x512.png', size: 512 },
    { name: 'icon_512x512@2x.png', size: 1024 }
  ]

  for (const spec of iconsetSpecs) {
    const dest = path.join(iconsetDir, spec.name)
    execSync(`sips -z ${spec.size} ${spec.size} "${masterPngPath}" --out "${dest}"`, {
      stdio: 'pipe'
    })
  }

  // 3. Compile Apple .icns using iconutil
  const icnsPath = path.join(buildDir, 'icon.icns')
  execSync(`iconutil -c icns "${iconsetDir}" -o "${icnsPath}"`, { stdio: 'pipe' })
  fs.copyFileSync(icnsPath, path.join(resourcesDir, 'icon.icns'))
  console.log(`Compiled Apple ICNS to ${icnsPath}`)

  // Clean up iconset folder
  fs.rmSync(iconsetDir, { recursive: true, force: true })

  // 4. Generate Windows .ico with all required sizes
  const icoSizes = [256, 128, 64, 48, 32, 24, 16]
  const icoBuffers = []
  for (const s of icoSizes) {
    const tmpPng = path.join(buildDir, `temp_${s}.png`)
    execSync(`sips -z ${s} ${s} "${masterPngPath}" --out "${tmpPng}"`, { stdio: 'pipe' })
    const buf = fs.readFileSync(tmpPng)
    fs.unlinkSync(tmpPng)
    icoBuffers.push({ size: s, buffer: buf })
  }

  const icoBuffer = createIco(icoBuffers)
  const icoPath = path.join(buildDir, 'icon.ico')
  fs.writeFileSync(icoPath, icoBuffer)
  fs.writeFileSync(path.join(resourcesDir, 'icon.ico'), icoBuffer)
  console.log(`Generated Windows ICO to ${icoPath}`)

  // 5. Update local development Electron app bundle if present
  // On macOS, rename Electron.app to resourcedeck.app so the Cmd+Tab switcher says "resourcedeck"
  const electronDistDir = path.join(rootDir, 'node_modules/electron/dist')
  if (fs.existsSync(electronDistDir)) {
    const oldAppPath = path.join(electronDistDir, 'Electron.app')
    const newAppPath = path.join(electronDistDir, 'resourcedeck.app')

    if (fs.existsSync(oldAppPath) && !fs.existsSync(newAppPath)) {
      fs.renameSync(oldAppPath, newAppPath)
      // Create symlink for any tools looking for Electron.app
      try {
        fs.symlinkSync('resourcedeck.app', oldAppPath)
      } catch {}
    }

    const targetApp = fs.existsSync(newAppPath) ? newAppPath : oldAppPath

    // Update path.txt so require('electron') resolves to resourcedeck.app
    const pathTxtFile = path.join(rootDir, 'node_modules/electron/path.txt')
    if (fs.existsSync(targetApp) && fs.existsSync(pathTxtFile)) {
      const appBase = path.basename(targetApp)
      fs.writeFileSync(pathTxtFile, `${appBase}/Contents/MacOS/Electron`)
    }

    // Replace electron.icns with our resourcedeck icon
    const destIcns1 = path.join(targetApp, 'Contents/Resources/electron.icns')
    const destIcns2 = path.join(targetApp, 'Contents/Resources/icon.icns')
    if (fs.existsSync(path.dirname(destIcns1))) {
      fs.copyFileSync(icnsPath, destIcns1)
      fs.copyFileSync(icnsPath, destIcns2)
    }

    // Update Info.plist to guarantee display name is resourcedeck
    const infoPlistPath = path.join(targetApp, 'Contents/Info.plist')
    if (fs.existsSync(infoPlistPath)) {
      let plist = fs.readFileSync(infoPlistPath, 'utf8')
      plist = plist.replace(
        /<key>CFBundleDisplayName<\/key>\s*<string>[^<]*<\/string>/,
        '<key>CFBundleDisplayName</key>\n\t<string>resourcedeck</string>'
      )
      plist = plist.replace(
        /<key>CFBundleName<\/key>\s*<string>[^<]*<\/string>/,
        '<key>CFBundleName</key>\n\t<string>resourcedeck</string>'
      )
      fs.writeFileSync(infoPlistPath, plist, 'utf8')

      // Refresh macOS LaunchServices cache for the bundle
      try {
        execSync(
          `/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -f "${targetApp}"`,
          { stdio: 'ignore' }
        )
      } catch {}
    }
    console.log('Updated node_modules Electron.app icons and bundle display name to resourcedeck')
  }

  console.log('All icons generated and dev environment updated successfully!')
}

main().catch((err) => {
  console.error('Error generating icons:', err)
  process.exit(1)
})
