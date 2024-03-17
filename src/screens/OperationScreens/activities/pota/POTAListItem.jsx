/* eslint-disable react/no-unstable-nested-components */
import React, { useMemo } from 'react'
import { useLookupParkQuery } from '../../../../store/apiPOTA'
import { IconButton, List, Text } from 'react-native-paper'
import { View } from 'react-native'

import { INFO } from './POTAInfo'

export function POTAListItem ({ activityRef, refData, allRefs, style, styles, onPress, onAddReference, onRemoveReference, online }) {
  const pota = useLookupParkQuery({ ref: activityRef }, { skip: !activityRef, online })

  const description = useMemo(() => {
    let desc
    if (online && pota?.error) {
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
  }, [pota, refData, online])

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
      left={() => <List.Icon style={{ marginLeft: styles.oneSpace * 2 }} icon={INFO.icon} />}
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
