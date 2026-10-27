import test from 'node:test'
import assert from 'node:assert/strict'
import { analyzeRules } from '../src/rules.mjs'

const CASES = [
  {
    name: 'M-PESA suspension with a PIN request',
    text: 'Dear Customer, Your M-PESA account will be suspended today. Verify immediately at http://mpesa-secure-verify.top/login and enter your PIN. Do not tell anyone. Customer Care.',
    verdict: 'high',
    mustInclude: ['credentials', 'account_threat', 'secrecy']
  },
  {
    name: 'advance-fee job offer',
    text: 'Congratulations! You have been selected for a work from home job paying 3000 USD monthly. Send your ID and pay 500 KSH registration fee to activate your account.',
    verdict: 'high',
    mustInclude: ['prize', 'money_request', 'advance_fee']
  },
  {
    name: 'guaranteed-profit investment pitch',
    text: 'Guaranteed profit! Double your money in 7 days with our forex bot. Deposit 50 USDT now.',
    verdict: 'high',
    mustInclude: ['crypto_promise', 'money_request']
  },
  {
    name: 'ordinary invoice email',
    text: 'Hi Eran, the invoice for September is attached. Let me know if you need anything else before Friday. Thanks, Wanjiru',
    verdict: 'low',
    mustInclude: []
  },
  {
    name: 'ordinary delivery notification',
    text: 'Your order #4471 has shipped and will arrive on Thursday. Track it in the app if you need to change the delivery slot.',
    verdict: 'low',
    mustInclude: []
  },
  {
    name: 'ordinary clinic reminder',
    text: 'Hi, this is Dr. Otieno from the clinic. Your appointment on Tuesday is confirmed for 10am.',
    verdict: 'low',
    mustInclude: []
  }
]

for (const c of CASES) {
  test(c.name, () => {
    const r = analyzeRules(c.text)
    const ids = r.hits.map((h) => h.id)
    assert.equal(r.verdict, c.verdict, 'verdict mismatch, hits: ' + ids.join(','))
    for (const id of c.mustInclude) assert.ok(ids.includes(id), 'missing rule ' + id)
    assert.ok(r.score >= 0 && r.score <= 100)
  })
}

test('lookalike domain is caught even without brand keywords in the text', () => {
  const r = analyzeRules('Pay here: http://safaricom-billing-refund.xyz/pay')
  const ids = r.hits.map((h) => h.id)
  assert.ok(ids.some((i) => i.startsWith('link:')), 'expected a link finding, got ' + ids.join(','))
})

test('official domain does not raise a link finding', () => {
  const r = analyzeRules('Your receipt is at https://www.safaricom.co.ke/receipt/9912')
  assert.ok(!r.hits.some((h) => h.id.startsWith('link:')), 'official domain was flagged')
})
