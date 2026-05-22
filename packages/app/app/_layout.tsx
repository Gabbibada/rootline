import { useEffect, useRef, useState } from 'react'
import { Stack, useRouter } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import * as SplashScreen from 'expo-splash-screen'
import { useFonts } from 'expo-font'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { CormorantGaramond_500Medium } from '@expo-google-fonts/cormorant-garamond'
import { DMSans_400Regular, DMSans_500Medium } from '@expo-google-fonts/dm-sans'
import { IBMPlexMono_400Regular } from '@expo-google-fonts/ibm-plex-mono'
import { supabase, getSession } from '../src/lib/supabase'
import { useFamilyStore } from '../src/store/familyStore'
import { setupNotificationChannel, scheduleAllBirthdayNotifications } from '../src/lib/notifications'
import { loadPendingInvite } from '../src/lib/invite'
import { subscribeToTree } from '../src/lib/db'

SplashScreen.preventAutoHideAsync()

export default function RootLayout() {
  const router = useRouter()
  const graph         = useFamilyStore(s => s.graph)
  const currentUserId = useFamilyStore(s => s.currentUserId)
  const setGraph      = useFamilyStore(s => s.setGraph)
  // Derive treeId from the current user's person record (used for realtime subscription)
  const treeId        = graph && currentUserId ? (graph.people[currentUserId]?.treeId ?? null) : null

  const [authed, setAuthed] = useState(false)
  const [authReady, setAuthReady] = useState(false)
  const didRedirect = useRef(false)

  const [fontsLoaded] = useFonts({
    'CormorantGaramond-Medium': CormorantGaramond_500Medium,
    'DMSans-Regular':           DMSans_400Regular,
    'DMSans-Medium':            DMSans_500Medium,
    'IBMPlexMono-Regular':      IBMPlexMono_400Regular,
  })

  useEffect(() => { setupNotificationChannel() }, [])

  // Realtime: subscribe to the current tree, re-subscribe when treeId changes
  useEffect(() => {
    if (!treeId) return
    const channel = subscribeToTree(treeId, setGraph)
    return () => { channel.unsubscribe() }
  }, [treeId])

  useEffect(() => {
    if (!graph || !currentUserId) return
    scheduleAllBirthdayNotifications(graph, currentUserId).catch(() => undefined)
  }, [graph, currentUserId])

  useEffect(() => {
    getSession().then(({ data }) => {
      setAuthed(!!data.session)
      setAuthReady(true)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setAuthed(!!session)
      if (event === 'SIGNED_OUT') {
        didRedirect.current = false
        router.replace('/onboarding')
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!authReady || !fontsLoaded || didRedirect.current) return
    didRedirect.current = true

    ;(async () => {
      if (authed) {
        const pending = await loadPendingInvite()
        if (pending) {
          router.replace({ pathname: '/invite', params: { treeId: pending.treeId, personId: pending.personId, name: pending.personName } } as any)
          SplashScreen.hideAsync()
          return
        }
      }

      if (!authed) {
        router.replace('/onboarding')
      } else if (!graph) {
        router.replace('/onboarding/profile')
      } else {
        router.replace('/(tabs)/')
      }
      SplashScreen.hideAsync()
    })()
  }, [authReady, fontsLoaded])

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false }} />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
