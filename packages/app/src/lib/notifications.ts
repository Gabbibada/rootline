import { Platform } from 'react-native'
import * as Notifications from 'expo-notifications'
import { FamilyGraph, createEngine } from '@rootline/engine'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
})

const BDAY_PREFIX = 'bday_'

// Days-before-birthday to fire: day-of, 3 days prior, 7 days prior
const ADVANCE_DAYS = [0, 3, 7] as const

export async function setupNotificationChannel(): Promise<void> {
  if (Platform.OS !== 'android') return
  await Notifications.setNotificationChannelAsync('birthdays', {
    name: 'Birthday reminders',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#B07D4A',
  })
}

export async function getNotificationPermissionStatus(): Promise<Notifications.PermissionStatus> {
  const { status } = await Notifications.getPermissionsAsync()
  return status
}

export async function requestNotificationPermissions(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync()
  if (existing === 'granted') return true
  const { status } = await Notifications.requestPermissionsAsync()
  return status === 'granted'
}

export async function scheduleAllBirthdayNotifications(
  graph: FamilyGraph,
  currentUserId: string,
): Promise<void> {
  const granted = await requestNotificationPermissions()
  if (!granted) return

  // Cancel stale birthday notifications before rescheduling
  const existing = await Notifications.getAllScheduledNotificationsAsync()
  await Promise.all(
    existing
      .filter(n => n.identifier.startsWith(BDAY_PREFIX))
      .map(n => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  )

  const engine = createEngine(graph)
  const now = new Date()

  for (const person of Object.values(graph.people)) {
    if (!person.birthday || person.id === currentUserId) continue

    const parts = person.birthday.split('-')
    const birthdayMonth = parseInt(parts[1], 10)
    const birthdayDay   = parseInt(parts[2], 10)

    for (const daysUntil of ADVANCE_DAYS) {
      const body = engine.getBirthdayNotification(currentUserId, person.id, daysUntil)
      if (!body) continue

      // Compute next occurrence of (birthdayMonth/birthdayDay − daysUntil days)
      // Using Date arithmetic handles month-boundary offsets automatically
      let triggerDate = new Date(now.getFullYear(), birthdayMonth - 1, birthdayDay - daysUntil)
      triggerDate.setHours(9, 0, 0, 0)
      if (triggerDate <= now) {
        triggerDate = new Date(now.getFullYear() + 1, birthdayMonth - 1, birthdayDay - daysUntil)
        triggerDate.setHours(9, 0, 0, 0)
      }

      const title = daysUntil === 0 ? 'Birthday today' : 'Upcoming birthday'
      const identifier = `${BDAY_PREFIX}${person.id}_${daysUntil}`

      try {
        await Notifications.scheduleNotificationAsync({
          identifier,
          content: { title, body, sound: true },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
            year:   triggerDate.getFullYear(),
            month:  triggerDate.getMonth() + 1,
            day:    triggerDate.getDate(),
            hour:   9,
            minute: 0,
            repeats: false,
          },
        })
      } catch {
        // Skip silently — can happen if offset produces an invalid date
      }
    }
  }
}

export async function cancelAllBirthdayNotifications(): Promise<void> {
  const existing = await Notifications.getAllScheduledNotificationsAsync()
  await Promise.all(
    existing
      .filter(n => n.identifier.startsWith(BDAY_PREFIX))
      .map(n => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  )
}

export async function getScheduledBirthdayCount(): Promise<number> {
  const existing = await Notifications.getAllScheduledNotificationsAsync()
  return existing.filter(n => n.identifier.startsWith(BDAY_PREFIX)).length
}
