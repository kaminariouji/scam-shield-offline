# Judge's guide — Scam Shield Offline

Entry for **AI Yako: Own Your AI (QVAC Hackathon), Track 1 — Offline AI apps**.
This page exists so a judge can verify the entry in about a minute without reading the whole README.

## 1. The offline claim, in one file

`media/demo.mp4` (38.5 s) was recorded with the browser started as
`--host-resolver-rules="MAP * 0.0.0.0, EXCLUDE 127.0.0.1"`, so every host except loopback resolves to a black hole.
The app is served from `127.0.0.1` and the model is already on disk, so both the rule engine and the model answer with no outbound traffic.

The same thing can be reproduced by unplugging the network instead — steps are in the README section
**"Reproduce the offline demo"**.

## 2. Verify without a GPU and without spending anything

```bash
npm install
npm test        # 15 tests, no model, no network
```

`npm test` prints `# pass 15` / `# fail 0`. The suite covers:

- three scams that must score `high` (M-PESA PIN request, advance-fee job offer, guaranteed-profit pitch)
- three ordinary messages that must score `low` (invoice, delivery notice, clinic reminder)
- link forensics: shortener, punycode, raw IP, look-alike brand domain, official domain must not fire
- combination rules (a prize plus a fee is one pattern, not two)

## 3. Where QVAC is actually used

| Item | Value |
|---|---|
| Package | `@qvac/sdk` 0.22.0 (Bare worker over `bare-rpc`) |
| Model | `LLAMA_3_2_1B_INST_Q4_0` from the QVAC registry |
| Config | `{ ctx_size: 2048, gpu_layers: 0, device: 'cpu' }` |
| Call sites | `src/model.mjs` — `loadModel`, `completion` (streamed), `unloadModel` |
| Files with no QVAC | `src/rules.mjs`, `server.mjs`, `public/index.html` — plain JavaScript, no network |

The model never reads the suspect message. It receives only the red flags the rule engine already found, which is what keeps a 1B model on-task and stops safety refusals from replacing the answer.

## 4. Numbers in this repo

- **10 weighted rules** in `src/rules.mjs` plus **4 combination rules** (`advance_fee`, `investment_fee`, `prize_deadline`, `job_fee`).
- **15 tests**, all passing.
- Test device: AMD Ryzen 5 3600X, 32 GB RAM, Windows 11 Pro x64, Node.js 24.21. Model load ≈9 s warm / ≈27 s cold; a scan takes well under a second. Roughly 1 GB of free RAM on top of the ~90 MB Node process.

The DoraHacks submission text has been corrected to match this repository: ten rules and fifteen tests. `npm test` remains the authority.

## 5. What still needs a network

Only two steps, both one-time setup: `npm install` and the first model download. After that the machine can be disconnected. There is no analytics, telemetry or update check.

## 6. Limits, stated plainly

- It is a second opinion, not a guarantee.
- The rule vocabulary is tuned on English, Swahili and Indonesian; other languages mostly fall through to the link and format checks.
- The verdict comes from deterministic rules, not from the model. The model only explains.
