import { app } from 'electron'
import { is } from '@electron-toolkit/utils'

/** False for dev runs and for local `build:mac` builds (version `…-local.<ts>.<sha>`): those are
 *  ad-hoc signed, and Squirrel.Mac only swaps in a Developer-ID-signed release, so a check there
 *  can only offer an update that fails to install. */
export function isUpdatableBuild(): boolean {
  return app.isPackaged && !is.dev && !/[-.]local\.\d+\./.test(app.getVersion())
}
