/* eslint-disable react/no-unstable-nested-components */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { View } from 'react-native'
import { useDispatch, useSelector } from 'react-redux'
import { IconButton, List, Searchbar, Text } from 'react-native-paper'
import Geolocation from '@react-native-community/geolocation'

import { POTAAllParks, preparePOTAAllParksData } from '../../../data/POTA-AllParks'
import { apiPOTA, useLookupParkQuery } from '../../../store/apiPOTA'
import { selectOperationCallInfo, setOperationData } from '../../../store/operations'
import { filterRefs, findRef, refsToString, replaceRefs, stringToRefs } from '../../../tools/refTools'

import POTAInput from '../../components/POTAInput'
import { ListRow } from '../../components/ListComponents'

preparePOTAAllParksData()

const ACTIVITY = {
  key: 'pota',
  icon: 'pine-tree',
  name: 'Parks on the Air',
  shortName: 'POTA',
  infoURL: 'https://parksontheair.com/',
  includeControlForQSO: ({ qso, operation }) => {
    if (findRef(operation, 'potaActivation')) return true
    if (findRef(qso, 'pota')) return true
    else return false
  },
  labelControlForQSO: ({ operation, qso }) => {
    const opRef = findRef(operation, 'potaActivation')
    let label = opRef ? 'P2P' : 'POTA'
    if (findRef(qso, 'pota')) label = `✓ ${label}`
    return label
  },
  huntingType: 'pota',
  activationType: 'potaActivation',
  description: (operation) => refsToString(operation, ACTIVITY.activationType),
  descriptionPlaceholder: 'Enter POTA references',
  referenceRegex: /^[A-Z0-9]+-[0-9]{4,5}$/,
  decorateRef: (ref) => async (dispatch, getState) => {
    if (!ref?.ref || !ref.ref.match(/^[A-Z0-9]+-[0-9]{4,5}$/)) return { ...ref, ref: '', name: '', location: '' }

    const promise = dispatch(apiPOTA.endpoints.lookupPark.initiate(ref))
    const { data } = await promise
    let result
    if (data?.name) {
      result = {
        ...ref,
        name: [data.name, data.parktypeDesc].filter(x => x).join(' '),
        location: data?.locationName,
        grid: data?.grid6
      }
    } else {
      result = { ...ref, name: `${ref.ref} not found!` }
    }

    promise.unsubscribe()
    return result
  }
}

function ThisActivityLoggingControl (props) {
  const { qso, setQSO, style, styles } = props

  const ref = useRef()
  useEffect(() => {
    ref?.current?.focus()
  }, [])

  const [localValue, setLocalValue] = useState('')

  // Only initialize localValue once
  useEffect(() => {
    const refs = filterRefs(qso, ACTIVITY.huntingType)
    if (!localValue) {
      setLocalValue(refsToString(refs, ACTIVITY.huntingType))
    }
  }, [qso, localValue])

  const localHandleChangeText = useCallback((value) => {
    setLocalValue(value)
    const refs = stringToRefs(ACTIVITY.huntingType, value, { regex: ACTIVITY.referenceRegex })

    setQSO({ ...qso, refs: replaceRefs(qso?.refs, ACTIVITY.huntingType, refs) })
  }, [qso, setQSO])

  const defaultPrefix = useMemo(() => {
    if (qso?.their?.guess?.dxccCode) {
      return POTAAllParks.prefixByDXCCCode[qso?.their.guess.dxccCode] ?? 'K'
    } else {
      return 'K'
    }
  }, [qso?.their?.guess?.dxccCode])

  return (
    <POTAInput
      {...props}
      innerRef={ref}
      style={[style, { minWidth: 16 * styles.oneSpace }]}
      value={localValue}
      label="Their POTA"
      defaultPrefix={defaultPrefix}
      onChangeText={localHandleChangeText}
    />
  )
}

export function ThisActivityListItem ({ activityRef, refData, allRefs, style, styles, onPress, onAddReference, onRemoveReference }) {
  const pota = useLookupParkQuery({ ref: activityRef }, { skip: !activityRef, online: true })

  const description = useMemo(() => {
    let desc
    if (pota?.isLoading) {
      desc = '...'
    } else if (pota?.error) {
      desc = pota.error
    } else if (!pota?.data?.name && !refData?.name) {
      desc = 'Park Not Found'
    } else {
      desc = [
        pota?.data?.active === 0 && 'INACTIVE PARK!!!',
        [pota?.data?.name ?? refData?.name, pota?.data?.parktypeDesc ?? refData?.parktypeDesc].filter(x => x).join(' '),
        pota?.data?.locationName ?? refData?.locationName
      ].filter(x => x).join(' • ')
    }
    return desc
  }, [pota, refData])

  const isInRefs = useMemo(() => {
    return allRefs.find(ref => ref.ref === activityRef)
  }, [allRefs, activityRef])

  return (
    <List.Item style={{ paddingRight: styles.oneSpace * 1 }}
      title={
        <View style={{ flexDirection: 'row' }}>
          <Text style={{ fontWeight: 'bold' }}>
            {pota?.data?.ref ?? activityRef}
          </Text>
          <Text>
            {(pota?.data?.locationDesc ?? refData?.locationDesc) && ` (${pota?.data?.locationDesc ?? refData?.locationDesc})`}
          </Text>
        </View>
      }
      description={description}
      onPress={onPress}
      left={() => <List.Icon style={{ marginLeft: styles.oneSpace * 2 }} icon={ACTIVITY.icon} />}
      right={() => (
        isInRefs ? (
          onRemoveReference && <IconButton icon="minus-circle-outline" onPress={() => onRemoveReference(activityRef)} />
        ) : (
          onAddReference && <IconButton icon="plus-circle" onPress={() => onAddReference(activityRef)} />

        )
      )}
    />
  )
}

export function ThisActivityOptions (props) {
  const NEARBY_DEGREES = 0.25

  const { styles, operation } = props

  const dispatch = useDispatch()

  const ourInfo = useSelector(state => selectOperationCallInfo(state, operation?.uuid))

  const refs = useMemo(() => filterRefs(operation, ACTIVITY.activationType), [operation]).filter(ref => ref.ref)

  const title = useMemo(() => {
    if (refs?.length === 0) return 'No parks selected for activation'
    else if (refs?.length === 1) return 'Activating 1 park'
    else return `Activating ${refs.length} parks`
  }, [refs])

  const [search, setSearch] = useState('')

  const [parks, setParks] = useState([])
  const [parksMessage, setParksmessage] = useState([])

  const [location, setLocation] = useState()
  useEffect(() => {
    Geolocation.getCurrentPosition(info => {
      console.log('geo', info)
      const { latitude, longitude } = info.coords
      setLocation({ lat: latitude, lon: longitude })
    }, error => {
      console.log('Geolocation error', error)
      setLocation(undefined)
    })
  }, [])

  const [nearbyParks, setNearbyParks] = useState([])
  useEffect(() => {
    if (location?.lat && location?.lon) {
      const newParks = POTAAllParks.activeParks.filter(park => {
        return ((!ourInfo?.dxccCode || park.dxccCode === ourInfo.dxccCode) && Math.abs(park.lat - location.lat) < NEARBY_DEGREES && Math.abs(park.lon - location.lon) < NEARBY_DEGREES)
      }).sort((a, b) => {
        const distA = Math.sqrt((a.lat - location.lat) ** 2 + (a.lon - location.lon) ** 2)
        const distB = Math.sqrt((b.lat - location.lat) ** 2 + (b.lon - location.lon) ** 2)
        return distA - distB
      })
      setNearbyParks(newParks)
    }
  }, [ourInfo, location])

  useEffect(() => {
    if (search?.length > 2) {
      let newParks = POTAAllParks.activeParks.filter(park => {
        return (!ourInfo?.dxccCode || park.dxccCode === ourInfo.dxccCode) &&
            (park.ref.toLowerCase().includes(search.toLowerCase()) || park.name.toLowerCase().includes(search.toLowerCase())
            )
      })

      if (location?.lat && location?.lon) {
        newParks = newParks.sort((a, b) => {
          const distA = Math.sqrt((a.lat - location.lat) ** 2 + (a.lon - location.lon) ** 2)
          const distB = Math.sqrt((b.lat - location.lat) ** 2 + (b.lon - location.lon) ** 2)
          return distA - distB
        })
      }

      // Is the search term a plain reference, either with prefix or just digits?
      let nakedReference
      const parts = search.match(/^\s*([A-Za-z]*)(\d+)\s*$/)
      if (parts && parts[2].length >= 4) {
        nakedReference = (parts[1]?.toUpperCase() || POTAAllParks.prefixByDXCCCode[ourInfo?.dxccCode] || 'K') + '-' + parts[2]
      } else if (search.match(ACTIVITY.referenceRegex)) {
        nakedReference = search
      }

      // If it's a naked reference, let's ensure the results include it, or else add a placeholder
      // just to cover any cases where the user knows about a new park not included in our data
      if (nakedReference && !newParks.find(park => park.ref === nakedReference)) {
        newParks.unshift({ ref: nakedReference })
      }

      setParks(newParks.slice(0, 10))
      if (newParks.length === 0) {
        setParksmessage('No parks found')
      } else if (newParks.length > 10) {
        setParksmessage(`… and ${newParks.length - 10} more`)
      } else {
        setParksmessage('')
      }
    } else {
      setParks(nearbyParks)
      if (nearbyParks === undefined) setParksmessage('Search for some parks to activate!')
      else if (nearbyParks.length === 0) setParksmessage('No parks nearby')
      else setParksmessage('')
    }
  }, [search, ourInfo, nearbyParks, location])

  const handleAddReference = useCallback((ref) => {
    dispatch(setOperationData({ uuid: operation.uuid, refs: replaceRefs(operation?.refs, ACTIVITY.activationType, [...refs.filter(r => r.ref !== ref), { type: ACTIVITY.activationType, ref }]) }))
  }, [dispatch, operation, refs])

  const handleRemoveReference = useCallback((ref) => {
    dispatch(setOperationData({ uuid: operation.uuid, refs: replaceRefs(operation?.refs, ACTIVITY.activationType, refs.filter(r => r.ref !== ref)) }))
  }, [dispatch, operation, refs])

  return (
    <>
      <List.Section title={title}>
        {refs.map((ref, index) => (
          <ThisActivityListItem
            key={ref.ref}
            activityRef={ref.ref}
            allRefs={refs}
            styles={styles}
            onAddReference={handleAddReference}
            onRemoveReference={handleRemoveReference}
          />
        ))}
      </List.Section>
      <List.Section title={refs.length > 0 ? 'Add more parks' : 'Add a park'}>
        <ListRow>

          <Searchbar
            placeholder={'Parks by name or reference…'}
            value={search}
            onChangeText={setSearch}
          />
        </ListRow>
        {parks.map((park) => (
          <ThisActivityListItem
            key={park.ref}
            activityRef={park.ref}
            allRefs={refs}
            refData={park}
            styles={styles}
            onPress={() => handleAddReference(park.ref) }
            onAddReference={handleAddReference}
            onRemoveReference={handleRemoveReference}
          />
        ))}
        {parksMessage && <List.Item title={<Text style={{ textAlign: 'center' }}>{parksMessage}</Text>} />}
      </List.Section>
    </>
  )
}

const HunterLoggingControl = {
  key: 'pota/hunter',
  order: 10,
  icon: ACTIVITY.icon,
  label: ({ operation, qso }) => {
    const parts = ['POTA']
    if (findRef(qso, ACTIVITY.key)) parts.unshift('✓')
    return parts.join(' ')
  },
  InputComponent: ThisActivityLoggingControl,
  optionType: 'optional'
}

const ActivatorLoggingControl = {
  key: 'pota/activator',
  order: 10,
  icon: ACTIVITY.icon,
  label: ({ operation, qso }) => {
    const parts = ['P2P']
    if (findRef(qso, ACTIVITY.key)) parts.unshift('✓')
    return parts.join(' ')
  },
  InputComponent: ThisActivityLoggingControl,
  optionType: 'mandatory'
}

const ThisActivity = {
  ...ACTIVITY,
  MainExchangePanel: null,
  loggingControls: ({ operation, settings }) => {
    if (findRef(operation, 'potaActivation')) {
      return [ActivatorLoggingControl]
    } else {
      return [HunterLoggingControl]
    }
  },
  Options: ThisActivityOptions
}

export default ThisActivity
