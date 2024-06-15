/*
 * Copyright ©️ 2024 Sebastian Delmont <sd@ham2k.com>
 *
 * This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.
 * If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { fmtFreqInMHz } from '../../../../../../tools/frequencyFormats'
import { fmtDateTimeRelative } from '../../../../../../tools/timeFormats'
import { useDispatch, useSelector } from 'react-redux'
import { selectSecondsTick } from '../../../../../../store/time'
import { View } from 'react-native'
import { Icon } from 'react-native-paper'
import ThemedButton from '../../../../../components/ThemedButton'

import ThemedTextInput from '../../../../../components/ThemedTextInput'
import { selectRuntimeOnline } from '../../../../../../store/runtime'
import { findHooks } from '../../../../../../extensions/registry'
import { findRef } from '../../../../../../tools/refTools'
import { setOperationData } from '../../../../../../store/operations'

const SECONDS_UNTIL_RESPOT = 30

export function SpotterControlInputs (props) {
  const { operation, vfo, styles, style } = props

  const online = useSelector(selectRuntimeOnline)

  const dispatch = useDispatch()

  const ref = useRef()
  useEffect(() => { setTimeout(() => ref?.current?.focus(), 0) }, [])

  const [spotterUI, setSpotterUI] = useState({})
  const [comments, setComments] = useState()

  const now = useSelector(selectSecondsTick)

  useEffect(() => {
    if (vfo?.freq) {
      if (vfo.freq !== operation?.spottedFreq) {
        setSpotterUI({
          message: `Spot at ${fmtFreqInMHz(vfo.freq)}`,
          disabled: false
        })
        if (comments === undefined) setComments(operation?.spottedFreq ? 'QSY' : 'QRV with Ham2K PoLo')
      } else if (now - (operation?.spottedAt || 0) > (1000 * SECONDS_UNTIL_RESPOT)) {
        setSpotterUI({
          message: `Re-spot at ${fmtFreqInMHz(vfo.freq)}`,
          disabled: false
        })
        if (comments === undefined) setComments('QRT')
      } else if (comments?.length > 0 && (now - (operation?.spottedAt || 0) < (1000 * 1))) {
        setSpotterUI({
          message: `Spotted ${fmtDateTimeRelative(operation?.spottedAt)}`,
          disabled: false
        })
        setComments(undefined)
      } else if (comments?.length > 0) {
        setSpotterUI({
          message: `Re-spot at ${fmtFreqInMHz(vfo.freq)}`,
          disabled: false
        })
      } else {
        setSpotterUI({
          message: `Spotted ${fmtDateTimeRelative(operation?.spottedAt)}`,
          disabled: false
        })
      }
    } else {
      setSpotterUI({
        message: 'First set a frequency to spot.',
        disabled: true
      })
    }
  }, [vfo?.freq, operation?.spottedFreq, operation?.spottedAt, operation, now, comments])

  const activityHooksWithSpot = useMemo(() =>
    findHooks('activity').filter((x) => (findRef(operation.refs, x.activationType) && x.postSpot))
  , [operation.refs])

  const handleSpotting = useCallback(() => {
    activityHooksWithSpot.forEach(hook => dispatch(hook.postSpot(operation, vfo, comments)))
    dispatch(setOperationData({ uuid: operation.uuid, spottedAt: new Date().getTime(), spottedFreq: vfo.freq }))
    setComments(undefined)
  }, [dispatch, operation, vfo, comments, activityHooksWithSpot])

  return (
    <View style={[style, { flexDirection: 'row', flexWrap: 'wrap', gap: styles.oneSpace, alignItems: 'flex-end', width: '100%', maxWidth: styles.oneSpace * 120 }]}>
      {!spotterUI.disabled && (
        <ThemedTextInput
          innerRef={ref}
          style={{ marginLeft: styles.oneSpace, marginRight: styles.oneSpace, flex: 1 }}
          label={'Comments'}
          value={comments ?? ''}
          onChangeText={setComments}
        />
      )}
      <ThemedButton
        themeColor="tertiaryLighter"
        mode="contained"
        icon={online ? 'hand-wave' : 'cloud-off-outline'}
        onPress={handleSpotting}
        disabled={!online || spotterUI.disabled}
        // minWidth={styles.oneSpace * 18}
      >
        {spotterUI.message}
      </ThemedButton>
      <View style={{ flex: 0, flexDirection: 'row', position: 'absolute', top: styles.oneSpace * -1, right: 0 }}>
        {activityHooksWithSpot.map((x, n) => (
          <Icon
            key={x.key}
            source={x.icon}
            size={styles.oneSpace * 2.3}
            color={styles.colors.onTertiaryLight}
          />
        ))}
      </View>
    </View>
  )
}

export const spotterControl = {
  key: 'spotter',
  order: 100,
  icon: 'hand-wave',
  label: ({ operation, qso }) => {
    return 'Self-Spotting'
  },
  InputComponent: SpotterControlInputs,
  inputWidthMultiplier: 40,
  optionType: 'mandatory',
  onlyNewQSOs: true
}
