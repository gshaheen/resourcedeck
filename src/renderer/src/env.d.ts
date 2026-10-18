import type { RDeckBridgeApi } from '../../preload/index'

declare global {
  interface Window {
    rdeck: RDeckBridgeApi
  }
}

export {}
