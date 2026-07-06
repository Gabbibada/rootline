import AsyncStorage from '@react-native-async-storage/async-storage'

const KEY = 'rootline_pending_invite'

export interface PendingInvite {
  treeId:     string
  personId:   string | null   // null for tree-only (QR) invites — invitee picks their profile
  personName: string | null
}

export function buildInviteUrl(treeId: string, personId: string, personName: string): string {
  return `rootline://invite?treeId=${treeId}&personId=${personId}&name=${encodeURIComponent(personName)}`
}

export async function savePendingInvite(invite: PendingInvite): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(invite))
}

export async function loadPendingInvite(): Promise<PendingInvite | null> {
  const raw = await AsyncStorage.getItem(KEY)
  return raw ? (JSON.parse(raw) as PendingInvite) : null
}

export async function clearPendingInvite(): Promise<void> {
  await AsyncStorage.removeItem(KEY)
}
