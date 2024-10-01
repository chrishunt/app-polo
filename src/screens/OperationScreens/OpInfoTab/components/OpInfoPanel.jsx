/*
 * Copyright ©️ 2024 Sebastian Delmont <sd@ham2k.com>
 *
 * This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.
 * If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React, { useMemo } from 'react'
import { useSelector } from 'react-redux'
import { View } from 'react-native'
import { Icon, Text } from 'react-native-paper'

import { useThemedStyles } from '../../../../styles/tools/useThemedStyles'
import { fmtDateZuluDynamic, fmtTimeBetween } from '../../../../tools/timeFormats'
import { selectSecondsTick } from '../../../../store/time'
import { GestureHandlerRootView, ScrollView } from 'react-native-gesture-handler'
import { fmtNumber } from '@ham2k/lib-format-tools'
import { Ham2kMarkdown } from '../../../components/Ham2kMarkdown'

function prepareStyles (baseStyles, themeColor) {
  return {
    ...baseStyles,
    root: {
      padding: baseStyles.oneSpace * 2,
      flexDirection: 'column'
    },
    section: {
      flexDirection: 'column',
      marginVertical: baseStyles.oneSpace
    },
    icon: {
      // maxWidth: baseStyles.oneSpace * 8
    }
  }
}

export function OpInfoPanel ({ operation, qso, activeQSOs, sections, style, themeColor }) {
  const styles = useThemedStyles(prepareStyles, themeColor)

  const now = useSelector(selectSecondsTick)

  const line1 = useMemo(() => {
    if (activeQSOs.length === 0) {
      return "No QSOs... Let's get on the air!"
    } else {
      const parts = []

      parts.push(`${activeQSOs.length} ${activeQSOs.length === 1 ? 'QSO' : 'QSOs'} in ${fmtTimeBetween(operation.startOnMillisMin, operation.startOnMillisMax)}`)

      if (now - operation.startOnMillisMax < 1000 * 60 * 60 * 4) {
        if (activeQSOs.length > 0) {
          parts.push(`${fmtTimeBetween(operation.startOnMillisMax, now)} since last QSO`)
        }
      }
      return parts.filter(x => x).join(' • ')
    }
  }, [activeQSOs, operation, now])

  const line2 = useMemo(() => {
    const parts = []

    const last = activeQSOs?.length - 1
    if (last > 9) {
      const rate = (10 / ((activeQSOs[last].startOnMillis - activeQSOs[last - 9].startOnMillis) / 1000 / 60)) * 60
      if (rate) parts.push(`${rate.toFixed(0)} Q/h for last 10`)
    }
    if (last > 99) {
      const rate = (100 / ((activeQSOs[last].startOnMillis - activeQSOs[last - 99].startOnMillis) / 1000 / 60)) * 60
      if (rate) parts.push(`${rate.toFixed(0)} Q/h for last 100`)
    }

    return parts.filter(x => x).join(' • ')
  }, [activeQSOs])

  return (
    <GestureHandlerRootView style={[style, styles.root]}>
      <View style={styles.section}>
        <Text style={[styles.markdown.heading2, { fontWeight: 'bold' }]}>
          Operation Stats
        </Text>
        {line1 && <Text style={styles.markdown.body} numberOfLines={2} ellipsizeMode={'tail'}>{line1}</Text>}
        {line2 && <Text style={styles.markdown.body} numberOfLines={2} ellipsizeMode={'tail'}>{line2}</Text>}
      </View>
      <ScrollView style={styles.section}>
        {sections.map(section => (
          <View key={section.day} style={{ flexDirection: 'column', marginVertical: styles.oneSpace }}>
            <Text style={[styles.markdown.body, { marginBottom: styles.halfSpace }]}>
              <Text style={{ fontWeight: 'bold' }}>{fmtDateZuluDynamic(section.day)}: </Text>
              <Text>
                {section.count === 0 ? 'No QSOs' : section.count === 1 ? '1 QSO' : `${fmtNumber(section.count ?? 0)} QSOs`}
              </Text>
            </Text>
            {Object.keys(section.scores ?? {}).sort((a, b) => (section.scores[a].weight ?? 0) - (section.scores[b].weight ?? 0)).map(key => {
              const score = section.scores[key]

              const refKeys = Object.keys(score.refs ?? { one: true })

              if ((score.summary || score.longSummary) && (score.icon || score.label)) {
                return (
                  <View key={key} style={{ maxWidth: '100%', flexDirection: 'row', alignItems: 'flex-start', marginBottom: styles.oneSpace }}>
                    <View style={{ width: styles.oneSpace * 3, marginTop: styles.oneSpace * 0.2 }}>
                      {score.icon && (
                        <Icon
                          source={score.icon}
                          size={styles.normalFontSize}
                          color={score.activated === true ? styles.colors.important : undefined}
                          style={styles.icon}
                        />
                      )}
                    </View>
                    <Ham2kMarkdown style={{ width: '93%' }}>
                      {score.label && (
                        ` ${score.label}${refKeys.length > 1 ? `×${refKeys.length}:` : ':'}`
                      )}
                      {' '}{score.longSummary ?? score.summary}
                    </Ham2kMarkdown>
                  </View>
                )
              } else {
                return null
              }
            })}
          </View>
        ))}
      </ScrollView>
    </GestureHandlerRootView>
  )
}
