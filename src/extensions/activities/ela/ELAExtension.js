/*
 * Copyright ©️ 2024 Sebastian Delmont <sd@ham2k.com>
 *
 * This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.
 * If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { loadDataFile, removeDataFile } from '../../../store/dataFiles/actions/dataFileFS'
import { filterRefs, findRef, refsToString } from '../../../tools/refTools'

import { Info } from './ELAInfo'
import { elaFindOneByReference, registerELADataFile } from './ELADataFile'
import { ELAActivityOptions } from './ELAActivityOptions'
import { ELAPostSpot } from './ELAPostSpot'
import { LOCATION_ACCURACY } from '../../constants'

const Extension = {
  ...Info,
  category: 'locationBased',
  onActivationDispatch: ({ registerHook }) => async (dispatch) => {
    registerHook('activity', { hook: ActivityHook })
    registerHook(`ref:${Info.activationType}`, { hook: ReferenceHandler })

    registerELADataFile()
    await dispatch(loadDataFile('ela-all-lighthouses', { noticesInsteadOfFetch: true }))
  },
  onDeactivationDispatch: () => async (dispatch) => {
    await dispatch(removeDataFile('ela-all-lighthouses'))
  }
}
export default Extension

const ActivityHook = {
  ...Info,
  MainExchangePanel: null,
  Options: ELAActivityOptions,
  postSpot: ELAPostSpot
}

const ReferenceHandler = {
  ...Info,

  shortDescription: (operation) => refsToString(operation, Info.activationType),

  description: (operation) => {
    const refs = filterRefs(operation, Info.activationType)
    return [
      refs.map(r => r.ref).filter(x => x).join(', '),
      refs.map(r => r.name).filter(x => x).join(', ')
    ].filter(x => x).join(' • ')
  },

  decorateRefWithDispatch: (ref) => async () => {
    if (ref.ref) {
      const reference = await elaFindOneByReference(ref.ref)
      if (reference) {
        return {
          ...ref,
          name: reference.name,
          location: reference.region,
          grid: reference.grid,
          accuracy: LOCATION_ACCURACY.REASONABLE,
          label: `${Info.shortName} ${ref.ref}: ${reference.name}`
        }
      } else {
        return { ...ref, name: Info.unknownReferenceName ?? 'Unknown reference' }
      }
    }
  },

  suggestOperationTitle: (ref) => {
    if (ref.type === Info.activationType && ref.ref) {
      return { at: ref.ref, subtitle: ref.name }
    } else {
      return null
    }
  },

  suggestExportOptions: ({ operation, ref, settings }) => {
    if (ref?.type === Info.activationType && ref?.ref) {
      return [{
        format: 'adif',
        exportData: { refs: [ref] },
        nameTemplate: settings.useCompactFileNames ? '{call} @ {ref} {compactDate}' : '{date} {call} at {ref}',
        titleTemplate: `{call}: ${Info.shortName} at ${[ref.ref, ref.name].filter(x => x).join(' - ')} on {date}`
      }]
    }
  },

  adifFieldsForOneQSO: ({ qso, operation }) => {
    const activationRef = findRef(operation, Info.activationType)
    const fields = []
    if (activationRef) fields.push({ MY_SIG_INFO: activationRef.ref })

    return fields
  },

  scoringForQSO: ({ qso, qsos, operation, ref }) => {
    const { band, mode, key, startAtMillis } = qso

    const nearDupes = (qsos || []).filter(q => !q.deleted && (startAtMillis ? q.startAtMillis < startAtMillis : true) && q.their.call === qso.their.call && q.key !== key)

    if (nearDupes.length === 0) {
      return { value: 1, type: Info.activationType }
    } else {
      const sameBand = nearDupes.filter(q => q.band === band).length !== 0
      const sameMode = nearDupes.filter(q => q.mode === mode).length !== 0
      if (sameBand && sameMode) {
        return { value: 0, alerts: ['duplicate'], type: Info.activationType }
      } else {
        const notices = []
        if (!sameMode) notices.push('newMode')
        if (!sameBand) notices.push('newBand')

        return { value: 1, notices, type: Info.activationType }
      }
    }
  },

  accumulateScoreForOperation: ({ qsoScore, score, operation, ref }) => {
    if (!ref?.ref) return score // No scoring if not activating
    if (!score?.key) score = undefined // Reset if score doesn't have the right shape
    score = score ?? {
      key: ref?.type,
      icon: Info.icon,
      label: Info.shortName,
      value: 0,
      summary: '',
      refs: {},
      primaryRef: undefined
    }

    if (!score.refs[ref.ref]) {
      score.refs[ref.ref] = true
      score.primaryRef = score.primaryRef || ref.ref
    }

    if (score.primaryRef !== ref.ref) return score // Only do scoring for one ref

    score.value = score.value + qsoScore.value
    return score
  },

  summarizeScore: ({ score, operation, ref, section }) => {
    score.activated = score.value >= 25
    if (score.activated) {
      score.summary = '✓'
    } else {
      score.summary = `${score.value}/25`
    }

    return score
  }
}
