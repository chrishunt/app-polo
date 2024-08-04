/*
 * Copyright ©️ 2024 Sebastian Delmont <sd@ham2k.com>
 *
 * This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.
 * If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React from 'react'
import { View } from 'react-native'
import { Switch, Text } from 'react-native-paper'

import { useUIState } from '../../../../store/ui'
import ThemedDropDown from '../../../components/ThemedDropDown'
import SpotFilterIndicators from './SpotFilterIndicators'
import { LONG_LABEL_FOR_MODE, simplifiedMode } from '../OpSpotsTab'
import ThemedButton from '../../../components/ThemedButton'

export default function SpotFilterControls ({ filteredSpots, rawSpots, spotsSources, vfo, options, counts, operation, onDone, refreshSpots, styles, themeColor, settings, online }) {
  const [filterState, , updateFilterState] = useUIState('OpSpotsTab', 'filterState', {})
  console.log('SpotFilterControls', { filterState })
  return (
    <View style={{ flex: 1, flexDirection: 'column', paddingHorizontal: 0, gap: styles.oneSpace, alignItems: 'stretch' }}>
      <SpotFilterIndicators
        options={options}
        counts={counts}
        operation={operation}
        vfo={vfo}
        styles={styles}
        themeColor={themeColor}
        settings={settings}
        online={online}
        onPress={() => onDone()}
      />
      <View style={{ flex: 0, marginHorizontal: styles.oneSpace * 4 }}>
        <ThemedButton style={{}} onPress={() => onDone()} mode="contained" themeColor={themeColor}>
          {filteredSpots.length === rawSpots?.length ? `Show ${rawSpots?.length} spots` : `Show ${filteredSpots.length} out of ${rawSpots?.length} Spots`}
        </ThemedButton>
      </View>
      <View style={{ flex: 0, flexDirection: 'column', marginTop: styles.oneSpace * 2, marginHorizontal: styles.oneSpace * 4, gap: styles.oneSpace, alignItems: 'stretch' }}>
        <Text style={{ fontWeight: 'bold', marginTop: styles.halfSpace, textAlign: 'center' }}>
          Filters
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'stretch' }}>
          <ThemedDropDown
            label="Band"
            themeColor={themeColor}
            value={filterState.band || 'any'}
            onChange={(event) => updateFilterState({ band: event.nativeEvent.text })}
            fieldId={'band'}
            style={{ width: '100%' }}
            list={[
              { value: 'any', label: 'All Bands' },
              { value: 'auto', label: `Automatic (Currently ${vfo.band})` },
              ...options.band
            ]}
            dropDownContainerMaxHeight={styles.oneSpace * 40}
          />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'stretch' }}>
          <ThemedDropDown
            label="Mode"
            value={filterState.mode || 'any'}
            onChange={(event) => updateFilterState({ mode: event.nativeEvent.text })}
            fieldId={'mode'}
            style={{ width: '100%' }}
            list={[
              { value: 'any', label: 'All Modes' },
              { value: 'auto', label: `Automatic (Currently ${LONG_LABEL_FOR_MODE[simplifiedMode(vfo.mode)]})` },
              ...options.mode
            ]}
            dropDownContainerMaxHeight={styles.oneSpace * 40}
          />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'stretch' }}>
          <ThemedDropDown
            label="Maximum Age"
            value={filterState.ageInMinutes || 0}
            onChange={(event) => updateFilterState({ ageInMinutes: Number.parseInt(event.nativeEvent.text, 10) })}
            fieldId={'age'}
            style={{ width: '100%' }}
            list={[
              { value: 0, label: 'Any age' },
              { value: 10, label: '10 minutes' },
              { value: 30, label: '30 minutes' }
            ]}
          />
        </View>
      </View>
      <View style={{ minHeight: 200, flexDirection: 'column', marginTop: styles.oneSpace * 2, marginHorizontal: styles.oneSpace * 4, gap: styles.oneSpace, alignItems: 'stretch' }}>
        <Text style={{ fontWeight: 'bold', marginTop: styles.halfSpace, textAlign: 'center' }}>
          Spot Sources
        </Text>
        {spotsSources.map(source => (
          <View key={source.key} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'stretch', gap: styles.oneSpace }}>
            <Switch
              value={filterState.sources?.[source.key] !== false}
              onValueChange={(value) => {
                updateFilterState({ sources: { [source.key]: value } })
                if (value) refreshSpots()
              }}
            />
            <Text
              style={{ fontSize: styles.normalFontSize }}
              onPress={() => {
                updateFilterState({ sources: { [source.key]: !filterState.sources?.[source.key] } })
                if (!filterState.sources?.[source.key]) refreshSpots()
              }}
            >
              <Text style={{ fontWeight: 'bold' }}>{source.sourceName ?? source.name}: </Text>{counts.source?.[source.key] || '0'} spots
            </Text>
          </View>
        ))}
      </View>
    </View>
  )
}