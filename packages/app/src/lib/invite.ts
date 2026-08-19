import AsyncStorage from '@react-native-async-storage/async-storage'

const KEY = 'rootline_pending_invite'

export interface PendingInvite {
  treeId:     string
  personId:   string | null   // null for tree-only (QR) invites — invitee picks their profile
  personName: string | null
}

// Hosted invite page (site/invite.html on GitHub Pages). A plain rootline://
// link is not tappable in WhatsApp/SMS/email; this https page opens the app
// via an Android intent:// redirect and falls back to Google Play.
const INVITE_PAGE = 'https://gabbibada.github.io/rootline/invite.html'

export function buildInviteUrl(treeId: string, personId?: string | null, personName?: string | null): string {
  let url = `${INVITE_PAGE}?treeId=${encodeURIComponent(treeId)}`
  if (personId)   url += `&personId=${encodeURIComponent(personId)}`
  if (personName) url += `&name=${encodeURIComponent(personName)}`
  return url
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
