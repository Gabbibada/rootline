import express from 'express'
import cors    from 'cors'
import helmet  from 'helmet'
import { relationshipsRouter } from './routes/relationships'

const app  = express()
const PORT = process.env.PORT ?? 3001

app.use(helmet())
app.use(cors())
app.use(express.json({ limit: '2mb' }))
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'rootline-api', version: '0.1.0' }))
app.use('/api/v1', relationshipsRouter)
app.use((_req, res) => res.status(404).json({ error: 'Not found' }))
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[error]', err.message)
  res.status(500).json({ error: 'Internal server error' })
})
app.listen(PORT, () => console.log(`Rootline API running on http://localhost:${PORT}`))
export default app
