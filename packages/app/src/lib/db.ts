import { supabase } from './supabase'
import { FamilyGraph, Person, Relationship } from '@rootline/engine'

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
 * Returns the public URL, or null if the upload fails.
 *
 * Prerequisite: create a public bucket named "photos" in Supabase Storage
 * and set a policy: allow authenticated users to insert/update/select.
 */
export async function uploadPhoto(
  treeId:   string,
  personId: string,
  uri:      string,
): Promise<string | null> {
  try {
    const ext  = (uri.split('.').pop()?.split('?')[0] ?? 'jpg').toLowerCase()
    const path = `${treeId}/${personId}.${ext}`

    const resp = await fetch(uri)
    const blob = await resp.blob()

    const { error } = await supabase.storage
      .from('photos')
      .upload(path, blob, { upsert: true, contentType: `image/${ext}` })

    if (error) return null

    return supabase.storage.from('photos').getPublicUrl(path).data.publicUrl
  } catch {
    return null
  }
}

export async function claimMember(personId: string, userId: string): Promise<void> {
  await supabase.from('members').update({ user_id: userId }).eq('id', personId)
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
