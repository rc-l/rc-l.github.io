const test = require('node:test');
const assert = require('node:assert/strict');

const {
    calculateFinishedWarPayouts,
    formatWholeDollarValue,
    sanitizeIntegerInput
} = require('../docs/torn/wardashboard-payouts.js');

test('sanitizeIntegerInput strips non-digit characters without changing the number order', () => {
    assert.equal(sanitizeIntegerInput('$12,345abc'), '12345');
});

test('calculateFinishedWarPayouts returns n/a semantics when the target is missing', () => {
    const result = calculateFinishedWarPayouts({
        targetInput: '',
        totalEarningsInput: '1000000',
        cutPercentInput: '10',
        memberHits: [50, 25]
    });

    assert.equal(result.hasTarget, false);
    assert.deepEqual(result.payouts, [null, null]);
    assert.equal(result.factionCutValue, 100000);
    assert.equal(result.totalPay, 900000);
});

test('calculateFinishedWarPayouts caps each member payout at the target hit count', () => {
    const result = calculateFinishedWarPayouts({
        targetInput: '50',
        totalEarningsInput: '1,000,000',
        cutPercentInput: '10',
        memberHits: [80, 20]
    });

    assert.equal(result.totalHits, 100);
    assert.deepEqual(result.payouts, [450000, 180000]);
    assert.equal(formatWholeDollarValue(result.totalPay), '900,000');
});

test('calculateFinishedWarPayouts yields zero payouts when no counted hits exist', () => {
    const result = calculateFinishedWarPayouts({
        targetInput: '25',
        totalEarningsInput: '250000',
        cutPercentInput: '0',
        memberHits: [0, 0]
    });

    assert.deepEqual(result.payouts, [0, 0]);
    assert.equal(result.totalHits, 0);
});