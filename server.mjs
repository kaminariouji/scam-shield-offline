import http from 'node:http'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { analyzeRules } from './src/rules.mjs'
import { explain, warm, shutdown } from './src/model.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.PORT || 7777)

const json = (res, code, body) => {
  const s = JSON.stringify(body)
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(s) })
  res.end(s)
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
      const html = await readFile(path.join(__dirname, 'public', 'index.html'))
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
      return res.end(html)
    }

    if (req.method === 'GET' && req.url === '/api/health') {
      return json(res, 200, { ok: true, engine: 'qvac', device: 'cpu' })
    }

    if (req.method === 'POST' && req.url === '/api/scan') {
      let body = ''
      for await (const chunk of req) {
        body += chunk
        if (body.length > 200_000) { req.destroy(); return }
      }
      let text = ''
      try { text = (JSON.parse(body).text || '').toString() } catch { return json(res, 400, { error: 'invalid json' }) }
      if (!text.trim()) return json(res, 400, { error: 'empty message' })

      const rules = analyzeRules(text)
      let llm = null
      try {
        llm = await explain(rules)
      } catch (err) {
        llm = { why: 'The local model could not finish: ' + (err && err.message ? err.message : 'unknown'), action: 'Trust the red flag list above. Do not send money or codes.', risk: null }
      }
      return json(res, 200, { rules, llm })
    }

    res.writeHead(404, { 'content-type': 'text/plain' })
    res.end('not found')
  } catch (err) {
    json(res, 500, { error: String(err && err.message ? err.message : err) })
  }
})

server.listen(PORT, '127.0.0.1', async () => {
  console.log('Scam Shield Offline on http://127.0.0.1:' + PORT)
  console.log('warming local model (first run downloads once)...')
  const t = Date.now()
  try {
    await warm()
    console.log('model ready in ' + ((Date.now() - t) / 1000).toFixed(1) + 's')
  } catch (e) {
    console.error('model failed to warm:', e && e.message ? e.message : e)
  }
})

const bye = async () => { try { await shutdown() } catch {} process.exit(0) }
process.on('SIGINT', bye)
process.on('SIGTERM', bye)
