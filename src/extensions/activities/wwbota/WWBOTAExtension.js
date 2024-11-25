/*
 * Copyright ©️ 2024 Sebastian Delmont <sd@ham2k.com>
 *
 * This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.
 * If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { loadDataFile, removeDataFile } from '../../../store/dataFiles/actions/dataFileFS'
import { filterRefs, findRef, refsToString } from '../../../tools/refTools'

import { Info } from './WWBOTAInfo'
import { WWBOTAActivityOptions } from './WWBOTAActivityOptions'
import { wwbotaFindOneByReference, registerWWBOTADataFile } from './WWBOTADataFile'
import { WWBOTALoggingControl } from './WWBOTALoggingControl'
import { LOCATION_ACCURACY } from '../../constants'

const Extension = {
  ...Info,
  category: 'locationBased',
  onActivationDispatch: ({ registerHook }) => async (dispatch) => {
    registerHook('activity', { hook: ActivityHook })
    registerHook(`ref:${Info.huntingType}`, { hook: ReferenceHandler })
    registerHook(`ref:${Info.activationType}`, { hook: ReferenceHandler })
    registerHook('ref:ukbota', { hook: ReferenceHandler }) // Legacy
    registerHook('ref:ukbotaActivation', { hook: ReferenceHandler }) // Legacy

    registerWWBOTADataFile()
    await dispatch(loadDataFile('wwbota-all-bunkers', { noticesInsteadOfFetch: true }))
  },
  onDeactivationDispatch: () => async (dispatch) => {
    await dispatch(removeDataFile('wwbota-all-bunkers'))
  }
}
export default Extension

const ActivityHook = {
  ...Info,
  MainExchangePanel: null,
  loggingControls: ({ operation, settings }) => {
    if (findRef(operation, Info.activationType)) {
      return [ActivatorLoggingControl]
    } else {
      return [HunterLoggingControl]
    }
  },
  Options: WWBOTAActivityOptions,

  generalHuntingType: ({ operation, settings }) => Info.huntingType
}

const HunterLoggingControl = {
  key: `${Info.key}/hunter`,
  order: 10,
  icon: Info.icon,
  label: ({ operation, qso }) => {
    const parts = [Info.shortName]
    if (findRef(qso, Info.huntingType)) parts.unshift('✓')
    return parts.join(' ')
  },
  InputComponent: WWBOTALoggingControl,
  inputWidthMultiplier: 30,
  optionType: 'optional'
}

const ActivatorLoggingControl = {
  key: `${Info.key}/activator`,
  order: 10,
  icon: Info.icon,
  label: ({ operation, qso }) => {
    const parts = [Info.shortNameDoubleContact]
    if (findRef(qso, Info.huntingType)) parts.unshift('✓')
    return parts.join(' ')
  },
  InputComponent: WWBOTALoggingControl,
  inputWidthMultiplier: 30,
  optionType: 'mandatory'
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

  iconForQSO: Info.icon,

  decorateRefWithDispatch: (ref) => async () => {
    if (!ref?.ref || !ref.ref.match(Info.referenceRegex)) return { ...ref, ref: '', name: '', location: '' }

    const data = await wwbotaFindOneByReference(ref.ref)
    let result
    if (data?.name) {
      result = {
        ...ref,
        name: data.name,
        location: data.area,
        grid: data.grid,
        accuracy: LOCATION_ACCURACY.ACCURATE,
        label: `${Info.shortName} ${ref.ref}: ${data.name}`
      }
    } else {
      return { ...ref, name: Info.unknownReferenceName ?? 'Unknown reference' }
    }
    return result
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
        nameTemplate: settings.useCompactFileNames ? '{call}@{ref}-{compactDate}' : '{date} {call} at {ref}',
        titleTemplate: `{call}: ${Info.shortName} at ${[ref.ref, ref.name].filter(x => x).join(' - ')} on {date}`
      }]
    }
  },

  adifFieldsForOneQSO: ({ qso, operation }) => {
    const huntingRefs = filterRefs(qso, Info.huntingType)

    if (huntingRefs) return ([{ SIG: 'WWBOTA' }, { SIG_INFO: huntingRefs.map(ref => ref.ref).filter(x => x).join(',') }])
    else return []
  },

  adifFieldCombinationsForOneQSO: ({ qso, operation }) => {
    const huntingRefs = filterRefs(qso, Info.huntingType)
    const activationRef = findRef(operation, Info.activationType)
    let activationADIF = []
    if (activationRef) {
      activationADIF = [
        { MY_SIG: 'WWBOTA' }, { MY_SIG_INFO: activationRef.ref }
      ]
    }

    if (huntingRefs.length > 0) {
      return [[
        ...activationADIF,
        { SIG: 'WWBOTA' }, { SIG_INFO: huntingRefs.map(ref => ref.ref).filter(x => x).join(',') }
      ]]
    } else {
      return [activationADIF]
    }
  },

  adifHeaderComment: ({ qsos, operation }) => {
    const b2bCount = qsos.filter(qso => !qso.deleted).reduce((count, qso) => count + filterRefs(qso, Info.huntingType).length, 0)
    const stationsWorked = new Set(qsos.filter(qso => !qso.deleted).map(qso => qso.their?.call + qso.band)).size

    return `Stations Worked: ${stationsWorked}\nB2B QSOs: ${b2bCount}\n`
  },

  scoringForQSO: ({ qso, qsos, operation, ref }) => {
    const TWENTY_FOUR_HOURS_IN_MILLIS = 1000 * 60 * 60 * 24

    const { band, uuid, startAtMillis } = qso
    const refs = filterRefs(qso, Info.huntingType).filter(x => x.ref)
    const refCount = refs.length

    if (refs.length === 0 && !ref?.ref) return { value: 0 } // If not activating, only counts if other QSO has a WWBOTA ref

    const nearDupes = (qsos || []).filter(q => !q.deleted && (startAtMillis ? q.startAtMillis < startAtMillis : true) && q.their.call === qso.their.call && q.uuid !== uuid)

    if (nearDupes.length === 0) {
      return { value: 1, refCount, type: Info.activationType }
    } else {
      const thisQSOTime = qso.startAtMillis ?? Date.now()
      const day = thisQSOTime - (thisQSOTime % TWENTY_FOUR_HOURS_IN_MILLIS)
      const sameBand = nearDupes.filter(q => q.band === band).length !== 0
      const sameDay = nearDupes.filter(q => (q.startAtMillis - (q.startAtMillis % TWENTY_FOUR_HOURS_IN_MILLIS)) === day).length !== 0
      const sameRefs = nearDupes.filter(q => filterRefs(q, Info.huntingType).filter(r => refs.find(qr => qr.ref === r.ref)).length > 0).length !== 0
      if (sameBand && sameDay) {
        if (refCount > 0 && !sameRefs) { // Doesn't count towards activation, but towards B2B award.
          return { value: 0, refCount, notices: ['newRef'], type: Info.activationType }
        }
        return { value: 0, refCount: 0, alerts: ['duplicate'], type: Info.activationType }
      } else {
        const notices = []
        if (refs.length > 0 && !sameRefs) notices.push('newRef')
        if (!sameDay) notices.push('newDay')
        if (!sameBand) notices.push('newBand')

        return { value: 1, refCount, notices, type: Info.activationType }
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
      refCount: 0,
      summary: '',
      refs: {},
      primaryRef: undefined
    }

    if (!score.refs[ref.ref]) { // Track how many bunker we're activating
      score.refs[ref.ref] = true
      score.primaryRef = score.primaryRef || ref.ref
    }

    if (score.primaryRef !== ref.ref) return score // Only do scoring for one ref

    score.value = score.value + qsoScore.value
    score.refCount = score.refCount + qsoScore.refCount

    return score
  },

  summarizeScore: ({ score, operation, ref, section }) => {
    const activationScore = Math.max(...Object.keys(score?.refs ?? {})
      .map((x) => (['S5', 'Z3'].includes(x.split(/[/-]/)?.[1]) ? 10 : 25)))

    score.activated = score.value >= activationScore

    if (score.activated) {
      score.summary = '✓'
    } else {
      score.summary = `${score.value}/${activationScore}`
    }

    if (score.refCount > 0) {
      const label = score.primaryRef ? 'B2B' : 'B'
      score.summary = [score.summary, `${score.refCount} ${label}`].filter(x => x).join(' • ')
    }

    return score
  }
}
