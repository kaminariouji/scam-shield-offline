# Scam Shield Offline

Paste a suspicious SMS, WhatsApp message or email and get a second opinion **without the message ever leaving the machine**. A deterministic red-flag engine runs first, then a local language model explains the strongest finding and the safest next step.

Built for the [AI Yako: Own Your AI hackathon](https://dorahacks.io/hackathon/2452) (Track 1, offline AI apps), hosted with Node NBO in Nairobi, 24–31 October 2026.

## Why

Mobile-money fraud is cheap to run and hard to spot under pressure. The usual defence is to paste the message into a cloud assistant, which means handing the exact text, phone number and links to somebody else's server. People on metered or unreliable connections often cannot do that at all.

Scam Shield runs the whole check on the device: no API key, no account, no upload. Disconnect the network cable and it still answers.

## What it does

1. **Rule engine** (`src/rules.mjs`) — nine weighted patterns plus link forensics. It looks for requests for PINs/OTPs/seed phrases, artificial urgency, prizes you never entered, advance-fee demands, brand impersonation, guaranteed-profit pitches, generic greetings, secrecy requests and account-suspension threats. Links are inspected for shorteners, punycode, raw IPs, low-reputation TLDs, look-alike brand domains and hyphen stuffing. Combinations that are fraud on their own (a prize plus a fee) are scored as one pattern. The result is a 0–100 score and a verdict band.
2. **Local explanation** (`src/model.mjs`) — Llama 3.2 1B Instruct (Q4_0) runs through the [QVAC SDK](https://docs.qvac.tether.io/) on the CPU and writes two lines: *why the worst flag matters* and *what to do next*.

The model never reads the suspect message. It only receives the red flags the rule engine already found. That keeps a 1B model on-task, and it stops safety refusals from swallowing the answer — a 1B model asked to analyse a real extortion message tends to reply "I can't help with this request".

## Requirements

- Node.js 22.17 or newer
- About 1 GB of disk for the model (downloaded once, then cached)
- No GPU needed. QVAC's Vulkan path is supported but the app pins `device: 'cpu'` and `gpu_layers: 0` so it behaves the same on every machine. On the test machine (Ryzen 5 3600X, 32 GB RAM) the model loads in about 9 seconds and a scan takes well under a second after that.

## Run it

```bash
npm install
npm start
```

Open http://127.0.0.1:7777 and paste a message. The first start downloads the model once.

```bash
npm test        # 8 rule-engine tests, no model needed
```

To prove it is offline, disable networking before you press **Check offline**. The page is served from localhost and the model is already on disk, so the scan still works.

## API

`POST /api/scan` with `{"text": "..."}` returns:

```json
{
  "rules": { "score": 100, "verdict": "high", "hits": [{ "id": "credentials", "label": "...", "weight": 40 }] },
  "llm": { "why": "...", "action": "..." }
}
```

`GET /api/health` returns `{"ok":true,"engine":"qvac","device":"cpu"}`.

## How QVAC is used

- Package: `@qvac/sdk` 0.22.0, driving its Bare worker over `bare-rpc` from Node.
- Model: `LLAMA_3_2_1B_INST_Q4_0` from the QVAC registry, loaded with `modelConfig: { ctx_size: 2048, gpu_layers: 0, device: 'cpu' }`.
- Call sites: `src/model.mjs` (`loadModel`, `completion` with `stream: true`, `unloadModel`).
- Inference is streamed token by token, so the UI could show it as it arrives.

Everything else — scoring, link forensics, the verdict — is plain JavaScript with no network calls.

## Limits, stated plainly

- This is a second opinion, not a guarantee. A message can be fraudulent and score low; the app says so rather than pretending otherwise.
- The rule engine is tuned on English, Swahili and Indonesian vocabulary. Other languages will mostly fall through to the link and format checks.
- A 1B model explains flags well and reasons poorly. That is why the verdict comes from deterministic rules and the model is limited to explanation.
- No message history is stored. Nothing is written to disk except the cached model.

## Layout

```
server.mjs          HTTP server, two endpoints, no framework
src/rules.mjs       deterministic scoring and link forensics
src/model.mjs       QVAC model lifecycle, prompt, output parser
public/index.html   single-page UI, no external assets
test/               node:test suite for the rule engine
```
