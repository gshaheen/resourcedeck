import fs from 'fs'
import path from 'path'
import { app, BrowserWindow } from 'electron'
import { registerIpcHandlers } from '../src/main/ipc'

const OUTPUT_DIR = path.resolve(process.cwd(), 'docs/images')
const DEMO_FILE = path.resolve(process.cwd(), 'demo-portfolio.rdeck')

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })
}

app.whenReady().then(async () => {
  registerIpcHandlers()

  const win = new BrowserWindow({
    width: 1520,
    height: 960,
    show: false,
    frame: false,
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.resolve(__dirname, '../out/preload/index.js'),
      sandbox: false,
      contextIsolation: true
    }
  })

  await win.loadFile(path.resolve(__dirname, '../out/renderer/index.html'))

  // Helper to wait for ms
  const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

  // Helper to safely execute store actions in renderer
  const execStore = async (fnStr: string): Promise<void> => {
    await win.webContents.executeJavaScript(`
      (async () => {
        const store = window.useDeckStore;
        if (!store) throw new Error('useDeckStore not on window');
        ${fnStr}
      })()
    `)
  }

  // 1. Wait for store ready and open demo-portfolio.rdeck
  await wait(1200)
  await execStore(`store.getState().openFileByPath(${JSON.stringify(DEMO_FILE)});`)
  await wait(1500)

  console.log('Opened demo-portfolio.rdeck successfully')

  // Shot 1: Split Timeline + Overrun Red Dual Charts (Baseline)
  console.log('Capturing 01-split-timeline-charts.png...')
  await execStore(`
    const s = store.getState();
    s.setTheme('boardroom-daylight');
    s.setViewMode('split-timeline');
    s.switchScenario('scen-apex-baseline');
    s.setDiffDrawerOpen(false);
    if (s.isPresentationMode) s.togglePresentationMode();
    if (s.activeModal) s.setActiveModal(null);
    if (s.selectedProjectForPopover) s.setSelectedProjectForPopover(null);
  `)
  await wait(1000)
  const shot1 = await win.webContents.capturePage()
  fs.writeFileSync(path.join(OUTPUT_DIR, '01-split-timeline-charts.png'), shot1.toPNG())

  // Shot 2: What-If Ghost Bars + Scenario Diff Drawer
  console.log('Capturing 02-what-if-ghost-bars-diff.png...')
  await execStore(`
    const s = store.getState();
    s.switchScenario('scen-apex-whatif-balanced');
    s.setDiffDrawerOpen(true);
  `)
  await wait(1000)
  const shot2 = await win.webContents.capturePage()
  fs.writeFileSync(path.join(OUTPUT_DIR, '02-what-if-ghost-bars-diff.png'), shot2.toPNG())

  // Shot 3: Team & Role Utilization Heatmap
  console.log('Capturing 03-utilization-heatmap.png...')
  await execStore(`
    const s = store.getState();
    s.setDiffDrawerOpen(false);
    s.setViewMode('heatmap');
  `)
  await wait(1000)
  const shot3 = await win.webContents.capturePage()
  fs.writeFileSync(path.join(OUTPUT_DIR, '03-utilization-heatmap.png'), shot3.toPNG())

  // Shot 4: Smart Staffing & Project Details Popover
  console.log('Capturing 04-smart-staffing-modal.png...')
  await execStore(`
    const s = store.getState();
    s.setViewMode('split-timeline');
    await s.switchScenario('scen-apex-baseline');
  `)
  await wait(500)
  await execStore(`
    store.getState().setSelectedProjectForPopover('proj-ai-fraud');
  `)
  await wait(600)
  await win.webContents.executeJavaScript(`
    const btns = Array.from(document.querySelectorAll('button'));
    const staffBtn = btns.find(b => b.textContent && b.textContent.includes('Suggest Available Staff'));
    if (staffBtn) staffBtn.click();
  `)
  await wait(800)
  const shot4 = await win.webContents.capturePage()
  fs.writeFileSync(path.join(OUTPUT_DIR, '04-smart-staffing-modal.png'), shot4.toPNG())

  // Shot 5: Boardroom Presentation Mode (Executive Slate Theme)
  console.log('Capturing 05-presentation-mode-dark.png...')
  await execStore(`
    const s = store.getState();
    s.setSelectedProjectForPopover(null);
    s.setTheme('executive-slate');
    s.setViewMode('dashboard');
    if (!s.isPresentationMode) s.togglePresentationMode();
  `)
  await wait(1000)
  const shot5 = await win.webContents.capturePage()
  fs.writeFileSync(path.join(OUTPUT_DIR, '05-presentation-mode-dark.png'), shot5.toPNG())

  // Shot 6: 1-Click AI Data Bridge Modal
  console.log('Capturing 06-ai-data-bridge.png...')
  await execStore(`
    const s = store.getState();
    if (s.isPresentationMode) s.togglePresentationMode();
    s.setTheme('boardroom-daylight');
    s.setViewMode('split-timeline');
    s.setActiveModal('ai-bridge');
  `)
  await wait(1000)
  const shot6 = await win.webContents.capturePage()
  fs.writeFileSync(path.join(OUTPUT_DIR, '06-ai-data-bridge.png'), shot6.toPNG())

  // Shot 7: Realistic Availability & Holiday/PTO Deductions
  console.log('Capturing 07-realistic-availability.png...')
  await execStore(`
    const s = store.getState();
    s.setActiveModal('holidays');
  `)
  await wait(1000)
  const shot7 = await win.webContents.capturePage()
  fs.writeFileSync(path.join(OUTPUT_DIR, '07-realistic-availability.png'), shot7.toPNG())

  console.log('All 7 screenshots captured successfully into docs/images/')
  app.quit()
})
