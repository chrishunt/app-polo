/*
 * Copyright ©️ 2024 Sebastian Delmont <sd@ham2k.com>
 *
 * This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.
 * If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { startupStepsForDistribution } from '../../../distro'
import loadExtensions from '../../../extensions/loadExtensions'
import { getOperations } from '../../operations'
import { selectSettings } from '../../settings'
import { addRuntimeMessage, resetRuntimeMessages } from '../runtimeSlice'
import { setupOnlineStatusMonitoring } from './onlineStatus'

const MESSAGES = [
  'Reticulating splines',
  'Tuning the antenna',
  'Checking the tubes',
  'Warming up the tubes',
  'Unfolding the map',
  'Charging the flux capacitor',
  'Purging the dilithium chamber', // M1SDH
  'Activating the turbo encabulator', // M1SDH
  'Engaging the warp drive' // K4HNT
]

export const startupSequence = (onReady) => (dispatch, getState) => {
  const settings = selectSettings(getState()) || {}

  setTimeout(async () => {
    dispatch(resetRuntimeMessages())

    const minimumTimePromise = new Promise(resolve => {
      setTimeout(() => { resolve() }, 1000)
    })

    const steps = [
      async () => await dispatch(addRuntimeMessage(MESSAGES[Math.floor(Math.random() * MESSAGES.length)])),
      async () => await dispatch(setupOnlineStatusMonitoring()),
      async () => await dispatch(loadExtensions()),
      async () => await dispatch(getOperations()),
      async () => await minimumTimePromise,
      ...startupStepsForDistribution({ settings, dispatch })
    ]

    await Promise.all(steps.map(fn => fn()))

    onReady && onReady()
  }, 0)
}
