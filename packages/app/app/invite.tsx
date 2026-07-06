import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, Pressable, ActivityIndicator, FlatList } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Person } from '@rootline/engine'
import { getSession } from '../src/lib/supabase'
import { loadTree, claimMember } from '../src/lib/db'
import { savePendingInvite, clearPendingInvite } from '../src/lib/invite'
import { useFamilyStore } from '../src/store/familyStore'
import { Avatar } from '../src/components/Avatar'
import { Colors, Typography, Spacing, Radius } from '../src/theme'

export default function InviteScreen() {
  const router     = useRouter()
  const loadGraph  = useFamilyStore(s => s.loadGraph)
  const { treeId, personId, name } = useLocalSearchParams<{
    treeId: string; personId?: string; name?: string
  }>()

  // QR invites carry only a treeId; the invitee picks their own profile below.
  const [pickedId,   setPickedId]   = useState<string | null>(null)
  const [pickedName, setPickedName] = useState<string | null>(null)
  const [people,     setPeople]     = useState<Person[] | null>(null)

  const effectivePersonId = personId ?? pickedId
  const personName        = name ?? pickedName ?? 'Your profile'
  const initial           = personName.charAt(0).toUpperCase()

  const [authed,   setAuthed]   = useState<boolean | null>(null)
  const [claiming, setClaiming] = useState(false)
  const [error,    setError]    = useState('')

  useEffect(() => {
    if (!treeId) return
    savePendingInvite({ treeId, personId: personId ?? null, personName: name ?? null })
    getSession().then(({ data }) => setAuthed(!!data.session))
  // params are stable after mount — intentional single-run
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [treeId])

  // Tree-only invite: once signed in, load the tree so the invitee can pick
  // who they are. get_tree_graph is security definer, so this works pre-claim.
  useEffect(() => {
    if (!authed || personId || people) return
    loadTree(treeId!).then(graph => {
      setPeople(graph ? Object.values(graph.people) : [])
    })
  }, [authed, personId, people, treeId])

  const claim = async () => {
    if (!effectivePersonId) return
    setError('')
    setClaiming(true)
    try {
      const { data } = await getSession()
      if (!data.session) { setError('Please sign in first.'); setClaiming(false); return }

      // Claim first — after this, normal RLS lets us read the tree.
      const claimed = await claimMember(effectivePersonId)

      const graph = await loadTree(claimed.treeId)
      if (!graph) { setError('Could not load this family tree.'); setClaiming(false); return }

      loadGraph(graph, claimed.treeName ?? 'Family Tree', effectivePersonId)
      await clearPendingInvite()
      router.replace('/(tabs)/')
    } catch (e: any) {
      const msg = String(e?.message ?? '')
      if (msg.includes('already_claimed')) {
        setError('This profile has already been claimed by someone else.')
      } else if (msg.includes('member_not_found')) {
        setError('This profile no longer exists in the tree.')
      } else {
        setError('Something went wrong. Please try again.')
      }
      setClaiming(false)
    }
  }

  if (!treeId) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.content}>
          <Text style={s.heading}>Invite link is invalid</Text>
          <Text style={s.body}>Ask your family member to send a new invite.</Text>
        </View>
      </SafeAreaView>
    )
  }

  if (authed === null) {
    return (
      <SafeAreaView style={s.safe}>
        <ActivityIndicator color={Colors.amber} style={s.loader} />
      </SafeAreaView>
    )
  }

  // ── Not signed in — landing page ──────────────────────────────────────────
  if (!authed) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.content}>
          <View style={s.avatarLg}>
            <Text style={s.avatarLgText}>{initial}</Text>
          </View>
          <Text style={s.heading}>You've been invited</Text>
          {personId ? (
            <>
              <Text style={s.claimAs}>Claim your profile as</Text>
              <Text style={s.personName}>{personName}</Text>
            </>
          ) : (
            <Text style={s.claimAs}>Join your family tree on Rootline</Text>
          )}
          <Text style={s.body}>
            Create an account to join your family tree and see how everyone is connected.
          </Text>
        </View>

        <View style={s.footer}>
          {!!error && <Text style={s.error}>{error}</Text>}
          <Pressable
            style={({ pressed }) => [s.btn, pressed && s.pressed]}
            onPress={() => router.push('/onboarding/sign-up')}
          >
            <Text style={s.btnText}>Create account</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [s.outlineBtn, pressed && s.pressed]}
            onPress={() => router.push('/onboarding/sign-in')}
          >
            <Text style={s.outlineBtnText}>Sign in</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    )
  }

  // ── Signed in, tree-only invite, nothing picked yet — person picker ────────
  if (!effectivePersonId) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.pickerWrap}>
          <Text style={s.heading}>Which one is you?</Text>
          <Text style={s.body}>Pick your profile to claim it and join the tree.</Text>
          {people === null ? (
            <ActivityIndicator color={Colors.amber} style={s.loader} />
          ) : people.length === 0 ? (
            <Text style={s.body}>Could not load this family tree. Ask for a new invite.</Text>
          ) : (
            <FlatList
              data={people}
              keyExtractor={p => p.id}
              style={s.pickerList}
              renderItem={({ item }) => (
                <Pressable
                  style={({ pressed }) => [s.pickerRow, pressed && s.pressed]}
                  onPress={() => { setPickedId(item.id); setPickedName(item.name) }}
                >
                  <Avatar name={item.name} photo={item.photo} size={40} />
                  <Text style={s.pickerName}>{item.name}</Text>
                  <Text style={s.pickerChevron}>›</Text>
                </Pressable>
              )}
              ItemSeparatorComponent={() => <View style={s.sep} />}
            />
          )}
        </View>
      </SafeAreaView>
    )
  }

  // ── Signed in — claim page ────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.safe}>
      <View style={s.content}>
        <View style={s.avatarLg}>
          <Text style={s.avatarLgText}>{initial}</Text>
        </View>
        <Text style={s.heading}>Is this you?</Text>
        <Text style={s.personName}>{personName}</Text>
        <Text style={s.body}>
          Claim this profile to link your account and explore your full family tree.
        </Text>
      </View>

      <View style={s.footer}>
        {!!error && <Text style={s.error}>{error}</Text>}
        <Pressable
          style={({ pressed }) => [s.btn, claiming && s.btnDisabled, pressed && s.pressed]}
          onPress={claim}
          disabled={claiming}
        >
          {claiming
            ? <ActivityIndicator color={Colors.cream} />
            : <Text style={s.btnText}>Claim profile</Text>}
        </Pressable>
        <Pressable
          style={({ pressed }) => [s.outlineBtn, pressed && s.pressed]}
          onPress={() => {
            // Tree-only invites go back to the picker; direct invites leave.
            if (pickedId) { setPickedId(null); setPickedName(null); setError('') }
            else router.back()
          }}
        >
          <Text style={s.outlineBtnText}>Not me — go back</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:           { flex: 1, backgroundColor: Colors.bark },
  loader:         { flex: 1 },
  content:        { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xl },
  avatarLg:       { width: 96, height: 96, borderRadius: 48, backgroundColor: Colors.bark2, borderWidth: 2, borderColor: Colors.amber, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.xxl },
  avatarLgText:   { ...Typography.display, color: Colors.sand },
  heading:        { ...Typography.heading1, color: Colors.cream, textAlign: 'center', marginBottom: Spacing.sm },
  claimAs:        { ...Typography.body, color: Colors.sand, textAlign: 'center' },
  personName:     { ...Typography.heading2, color: Colors.amber, textAlign: 'center', marginBottom: Spacing.lg },
  body:           { ...Typography.body, color: Colors.sand, textAlign: 'center', lineHeight: 24, opacity: 0.8 },
  footer:         { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xxxl, gap: Spacing.md },
  error:          { ...Typography.bodySmall, color: Colors.error, textAlign: 'center' },
  btn:            { height: 52, backgroundColor: Colors.amber, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  btnDisabled:    { opacity: 0.6 },
  pressed:        { opacity: 0.85 },
  btnText:        { ...Typography.label, fontSize: 15, color: Colors.cream },
  outlineBtn:     { height: 52, borderWidth: 1, borderColor: Colors.bark3, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  outlineBtnText: { ...Typography.label, fontSize: 15, color: Colors.sand },

  // Person picker (tree-only invites)
  pickerWrap:     { flex: 1, paddingHorizontal: Spacing.xl, paddingTop: Spacing.xxxl },
  pickerList:     { marginTop: Spacing.xl },
  pickerRow:      { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md },
  pickerName:     { ...Typography.nameTag, color: Colors.cream, flex: 1 },
  pickerChevron:  { fontSize: 18, color: Colors.sand, opacity: 0.5 },
  sep:            { height: StyleSheet.hairlineWidth, backgroundColor: Colors.bark3 },
})
