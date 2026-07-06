import { Alert } from 'react-native'
import { File } from 'expo-file-system'
import { supabase } from './supabase'
import { FamilyGraph, Person, Relationship } from '@rootline/engine'

/**
 * Fire-and-forget cloud persist with retry. The store is already updated
 * optimistically; this makes sure the write actually reaches Supabase and
 * tells the user when it doesn't, instead of silently losing the data.
 */
export function persist(op: () => Promise<unknown>, what: string): void {
  const attempt = (retriesLeft: number) => {
    op().catch(() => {
      if (retriesLeft > 0) {
        setTimeout(() => attempt(retriesLeft - 1), 3000)
      } else {
        Alert.alert(
          'Not saved to the cloud',
          `${what} couldn't be saved to the cloud. Check your connection, then edit and save again.`,
        )
      }
    })
  }
  attempt(2)
}

export async function createTree(name: string, ownerId: string): Promise<string> {
  const { data, error } = await supabase
    .from('trees')
    .insert({ name, owner_id: ownerId })
    .select('id')
    .single()
  if (error) throw error
  return data.id as string
}

export async function saveMember(person: Person): Promise<void> {
  const { error } = await supabase.from('members').upsert({
    id:         person.id,
    tree_id:    person.treeId,
    name:       person.name,
    nickname:   person.nickname,
    gender:     person.gender,
    birthday:   person.birthday,
    birthplace: person.birthplace,
    death_date: person.deathDate,
    photo:      person.photo,
    location:   person.location,
    occupation: (person as any).occupation ?? null,
    story:      person.story,
    deceased:   person.deceased,
  })
  if (error) throw error
}

export async function loadTree(treeId: string): Promise<FamilyGraph | null> {
  const { data, error } = await supabase.rpc('get_tree_graph', { tree_id: treeId })
  if (error) return null
  return data as FamilyGraph
}

export async function saveRelationship(rel: Relationship): Promise<void> {
  const { error } = await supabase.from('relationships').upsert({
    id: rel.id,
    tree_id: rel.treeId,
    from_id: rel.from,
    to_id: rel.to,
    type: rel.type,
    subtype: rel.subtype,
  })
  if (error) throw error
}

export async function loadUserTree(
  userId: string,
): Promise<{ treeId: string; treeName: string; graph: FamilyGraph; currentPersonId: string | null } | null> {

  // ── 1. Tree owned by this user ────────────────────────────────────────────
  const { data: owned } = await supabase
    .from('trees')
    .select('id, name')
    .eq('owner_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (owned) {
    const graph = await loadTree(owned.id as string)
    if (!graph) return null
    // Find which member in this tree the user owns (user_id set during onboarding)
    const { data: mine } = await supabase
      .from('members')
      .select('id')
      .eq('tree_id', owned.id)
      .eq('user_id', userId)
      .single()
    return {
      treeId:          owned.id   as string,
      treeName:        owned.name as string,
      graph,
      currentPersonId: mine ? (mine.id as string) : null,
    }
  }

  // ── 2. User has a claimed member in someone else's tree ───────────────────
  const { data: claimed } = await supabase
    .from('members')
    .select('id, tree_id, trees(name)')
    .eq('user_id', userId)
    .limit(1)
    .single()

  if (claimed) {
    const treeId   = claimed.tree_id as string
    const treeName = ((claimed as any).trees?.name as string | undefined) ?? 'Family Tree'
    const graph    = await loadTree(treeId)
    if (!graph) return null
    return { treeId, treeName, graph, currentPersonId: claimed.id as string }
  }

  return null
}

export async function deleteMember(personId: string): Promise<void> {
  await supabase.from('members').delete().eq('id', personId)
}

export async function loadTreeById(
  treeId: string,
): Promise<{ treeName: string; graph: FamilyGraph } | null> {
  const { data, error } = await supabase.from('trees').select('name').eq('id', treeId).single()
  if (error || !data) return null
  const graph = await loadTree(treeId)
  if (!graph) return null
  return { treeName: data.name as string, graph }
}

/**
 * Upload a photo from a local URI to Supabase Storage (bucket: "photos").
 * Returns the public URL (with cache-buster), or null if the upload fails.
 *
 * Uses the SDK 54 expo-file-system File API — the legacy readAsStringAsync
 * export throws a deprecation error, and fetch().blob() is unreliable with
 * local file URIs in React Native.
 */
export async function uploadPhoto(
  treeId:   string,
  personId: string,
  uri:      string,
): Promise<string | null> {
  try {
    const rawExt  = (uri.split('.').pop()?.split('?')[0] ?? 'jpg').toLowerCase()
    const ext     = rawExt === 'jpg' ? 'jpeg' : rawExt
    const mime    = `image/${ext}`
    const path    = `${treeId}/${personId}.${ext}`

    const buffer = await new File(uri).arrayBuffer()

    const { error } = await supabase.storage
      .from('photos')
      .upload(path, buffer, { upsert: true, contentType: mime })

    if (error) return null

    const publicUrl = supabase.storage.from('photos').getPublicUrl(path).data.publicUrl
    // Cache-buster forces expo-image to re-fetch when the same path is replaced
    return `${publicUrl}?v=${Date.now()}`
  } catch {
    return null
  }
}

/**
 * Link the signed-in auth user to a member row via the claim_member RPC.
 * A direct UPDATE would be blocked by RLS for fresh invitees (they aren't a
 * claimed member of the tree yet); the security-definer RPC validates and
 * performs the claim server-side. Throws on failure (e.g. already claimed).
 */
export async function claimMember(personId: string): Promise<{ treeId: string; treeName: string }> {
  const { data, error } = await supabase.rpc('claim_member', { member_id: personId })
  if (error) throw error
  return data as { treeId: string; treeName: string }
}

export function subscribeToTree(treeId: string, onUpdate: (graph: FamilyGraph) => void) {
  return supabase
    .channel(`tree:${treeId}`)
    .on('postgres_changes', { event: '*', schema: 'public', filter: `tree_id=eq.${treeId}` }, async () => {
      const graph = await loadTree(treeId)
      if (graph) onUpdate(graph)
    })
    .subscribe()
}
