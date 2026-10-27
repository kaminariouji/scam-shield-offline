import { loadModel, completion, unloadModel, LLAMA_3_2_1B_INST_Q4_0 } from '@qvac/sdk'

let modelId = null
let loading = null

export async function warm () {
  if (modelId) return modelId
  if (loading) return loading
  loading = (async () => {
    const id = await loadModel({
      modelSrc: LLAMA_3_2_1B_INST_Q4_0,
      modelType: 'llm',
      modelConfig: { ctx_size: 2048, gpu_layers: 0, device: 'cpu' }
    })
    modelId = id
    return id
  })()
  return loading
}

// The model never reads the suspect message. It only explains red flags the
// deterministic engine already found, which keeps a small local model on-task
// and stops safety refusals from swallowing the answer.
const SYSTEM = [
  'You are a fraud-prevention trainer explaining red flags to a non-technical person.',
  'You will receive a list of red flags found in a message they received. Do not repeat the message, do not analyse it, only explain the flags.',
  'A legitimate bank, telecom, courier or government office never asks for a PIN, OTP, password or seed phrase. Anyone who does is committing fraud.',
  'Write exactly two short lines and nothing else:',
  'WHY: <one sentence on why the most serious flag is dangerous>',
  'DO: <one sentence with the safest next action>',
  'If the flag list is empty, do not invent a crime: say the message matches no known pattern and tell the person to verify through a channel they already trust.',
  'The verdict is one of low, caution or high. On a low verdict the flags are weak on their own: say plainly that this is not proof of fraud and that the message looks ordinary, then still give one safe check. Never call a low-verdict message a scam.'
].join(' ')

const FEWSHOT = [
  { role: 'user', content: 'VERDICT: high\nRED FLAGS:\n- asks for a payment to release a parcel\n- link uses a look-alike courier domain' },
  { role: 'assistant', content: 'WHY: Couriers deliver first and bill later, so a release fee on a look-alike site is a classic way to take your card details.\nDO: Close the link and track the parcel inside the official courier app.' },
  { role: 'user', content: 'VERDICT: low\nRED FLAGS:\n- impersonates a bank, telco, courier or government office' },
  { role: 'assistant', content: 'WHY: One flag is not proof. Real banks do send messages, and this one shows no request for money or codes.\nDO: Keep the message, but check it inside the official app or on the number printed on your card.' },
  { role: 'user', content: 'VERDICT: low\nRED FLAGS:\n(none)' },
  { role: 'assistant', content: 'WHY: Nothing here matches a known fraud pattern, though silence is not proof of safety.\nDO: If money or a code is involved, confirm it through a number you already trust.' }
]

export function parseAnswer (raw) {
  const text = String(raw || '').replace(/\r/g, '')
  const grab = (key, next) => {
    const tail = next.length ? '(?=' + next.map((k) => k + '\\s*:').join('|') + '|$)' : '$'
    const re = new RegExp(key + '\\s*:\\s*([\\s\\S]*?)' + tail, 'i')
    const m = text.match(re)
    return m ? m[1].trim().replace(/\s+/g, ' ') : ''
  }
  return { why: grab('WHY', ['DO']), action: grab('DO', []) }
}

// The advice line is written in code, not by the model. A 1B model asked to help
// with a phishing message once answered "verify your account through the
// official website", which is exactly what the scam wants. Safety advice must
// never depend on a model getting it right, so the DO line is fixed per verdict.
const SAFE_DO = {
  high: 'Do not reply, do not open the link, and never send money, a PIN or a one-time code. Report the message and delete it.',
  caution: 'Do not send money or codes until you confirm the request through an app or a number you already trust.',
  low: 'Nothing to fix here. If money or a code is ever involved, confirm it through a channel you already trust.'
}

const QUIET_WHY = 'No strong fraud pattern in this message. One weak signal is not proof of fraud, and nothing here asks for money or a code.'

export async function explain (ruleResult) {
  const verdict = ruleResult.verdict || 'caution'
  const action = SAFE_DO[verdict] || SAFE_DO.caution

  // A low verdict does not deserve a model sentence: it tends to invent a crime
  // out of one weak flag, which reads as an accusation of a normal message.
  if (verdict === 'low') return { why: QUIET_WHY, action, raw: '' }

  const id = await warm()
  const flags = ruleResult.hits.length
    ? ruleResult.hits.map((h) => '- ' + h.label).join('\n')
    : '(none)'

  const history = [
    { role: 'system', content: SYSTEM },
    ...FEWSHOT,
    { role: 'user', content: 'VERDICT: ' + verdict + '\nRED FLAGS:\n' + flags }
  ]

  const res = completion({ modelId: id, history, stream: true, generationParams: { temp: 0.2, top_p: 0.9, predict: 220 } })
  let out = ''
  for await (const tok of res.tokenStream) out += tok
  const why = parseAnswer(out).why
  return { why: why || QUIET_WHY, action, raw: out }
}

export async function shutdown () {
  if (modelId) await unloadModel({ modelId })
  modelId = null
}
