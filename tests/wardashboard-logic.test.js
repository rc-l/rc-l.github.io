const test = require('node:test');
const assert = require('node:assert/strict');

const {
    ChainTracker,
    aggregateWarMemberHits
} = require('../pages/torn/wardashboard-logic.js');

function attack({
    timestamp,
    attackerId = 101,
    attackerFactionId = 1,
    defenderId = 201,
    defenderFactionId = 999,
    result = 'Attacked',
    respectGain = 1.5
}) {
    return {
        started: timestamp,
        attacker: {
            id: attackerId,
            faction_id: attackerFactionId
        },
        defender: {
            id: defenderId,
            faction_id: defenderFactionId
        },
        result,
        respect_gain: respectGain
    };
}

test('ChainTracker does not mark the 50th hit as a chain save when the threshold is strictly greater than 50', () => {
    const tracker = new ChainTracker({
        length: 49,
        lastSuccessfulAttackTimestamp: 1_000
    });

    tracker.processAttack(attack({
        timestamp: 1_241,
        defenderFactionId: 50
    }));

    assert.equal(tracker.is_victory(), true);
    assert.equal(tracker.was_on_time(), true);
    assert.equal(tracker.is_chain_save(), false);
    assert.deepEqual(tracker.getState(), {
        lastSuccessfulAttackTimestamp: 1_241,
        length: 50
    });
});

test('ChainTracker marks the 51st hit as a chain save when it lands inside the 4-5 minute window', () => {
    const tracker = new ChainTracker({
        length: 50,
        lastSuccessfulAttackTimestamp: 1_000
    });

    tracker.processAttack(attack({
        timestamp: 1_241,
        defenderFactionId: 50
    }));

    assert.equal(tracker.is_victory(), true);
    assert.equal(tracker.was_on_time(), true);
    assert.equal(tracker.is_chain_save(), true);
    assert.deepEqual(tracker.getState(), {
        lastSuccessfulAttackTimestamp: 1_241,
        length: 51
    });
});

test('aggregateWarMemberHits counts enemy-faction wins and out-of-faction chain saves in the same scenario', () => {
    const memberHits = {
        101: { id: 101, name: 'Alpha', hits: 0, score: 0 }
    };

    const aggregation = aggregateWarMemberHits({
        attacks: [
            attack({
                timestamp: 1_241,
                attackerId: 101,
                attackerFactionId: 1,
                defenderId: 301,
                defenderFactionId: 123,
                result: 'Attacked',
                respectGain: 2.5
            }),
            attack({
                timestamp: 1_320,
                attackerId: 101,
                attackerFactionId: 1,
                defenderId: 302,
                defenderFactionId: 999,
                result: 'Attacked',
                respectGain: 3.25
            })
        ],
        memberHits,
        warStart: 1_100,
        warEnd: 2_000,
        enemyFactionId: 999,
        chainState: {
            length: 50,
            lastSuccessfulAttackTimestamp: 1_000
        }
    });

    assert.deepEqual(aggregation.memberHits[101], {
        id: 101,
        name: 'Alpha',
        hits: 2,
        score: 5.75
    });
    assert.equal(aggregation.lastAttackTimestamp, 1_320);
    assert.deepEqual(aggregation.chainState, {
        lastSuccessfulAttackTimestamp: 1_320,
        length: 52
    });
});

test('aggregateWarMemberHits keeps the latest timestamp while filtering attacks outside the war window', () => {
    const aggregation = aggregateWarMemberHits({
        attacks: [
            attack({ timestamp: 900, attackerId: 101, defenderFactionId: 999, respectGain: 10 }),
            attack({ timestamp: 1_500, attackerId: 101, defenderFactionId: 999, respectGain: 4 })
        ],
        memberHits: {},
        warStart: 1_000,
        warEnd: 1_400,
        enemyFactionId: 999,
        chainState: null,
        lastAttackTimestamp: 950
    });

    assert.equal(aggregation.lastAttackTimestamp, 1_500);
    assert.deepEqual(aggregation.memberHits, {});
});