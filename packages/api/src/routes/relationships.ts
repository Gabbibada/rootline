import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { createEngine, FamilyGraph } from '../../engine/src/index'

export const relationshipsRouter = Router()
const trees = new Map<string, FamilyGraph>()

const RelSchema  = z.object({ sourceId: z.string().min(1), targetId: z.string().min(1) })
const BdaySchema = z.object({ sourceId: z.string().min(1), targetId: z.string().min(1), daysUntil: z.coerce.number().int().min(0) })

relationshipsRouter.post('/trees/:treeId/graph', (req: Request, res: Response) => {
  const { treeId } = req.params
  const graph = req.body as FamilyGraph
  if (!graph.people || !graph.relationships) return res.status(400).json({ error: 'Invalid graph' })
  trees.set(treeId, graph)
  return res.json({ ok: true, treeId, memberCount: Object.keys(graph.people).length })
})

relationshipsRouter.get('/trees/:treeId/relationship', (req: Request, res: Response) => {
  const p = RelSchema.safeParse(req.query)
  if (!p.success) return res.status(400).json({ error: p.error.flatten() })
  const graph = trees.get(req.params.treeId)
  if (!graph) return res.status(404).json({ error: 'Tree not found' })
  return res.json(createEngine(graph).getRelationship(p.data.sourceId, p.data.targetId))
})

relationshipsRouter.get('/trees/:treeId/people/:personId/relationships', (req: Request, res: Response) => {
  const graph = trees.get(req.params.treeId)
  if (!graph) return res.status(404).json({ error: 'Tree not found' })
  const { personId } = req.params
  if (!graph.people[personId]) return res.status(404).json({ error: 'Person not found' })
  const all = createEngine(graph).getAllRelationships(personId)
  return res.json({ personId, relationships: all.map(r => ({
    personId: r.personId,
    name: graph.people[r.personId]?.nickname ?? graph.people[r.personId]?.name,
    label: r.result.found ? r.result.path.label : null,
    distance: r.result.found ? r.result.path.distance : null,
  }))})
})

relationshipsRouter.get('/trees/:treeId/birthday-notification', (req: Request, res: Response) => {
  const p = BdaySchema.safeParse(req.query)
  if (!p.success) return res.status(400).json({ error: p.error.flatten() })
  const graph = trees.get(req.params.treeId)
  if (!graph) return res.status(404).json({ error: 'Tree not found' })
  const msg = createEngine(graph).getBirthdayNotification(p.data.sourceId, p.data.targetId, p.data.daysUntil)
  if (!msg) return res.status(404).json({ error: 'Could not generate notification' })
  return res.json({ message: msg })
})
