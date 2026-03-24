const test = require('node:test');
const assert = require('node:assert/strict');

const { aggregateWarMemberHits } = require('../pages/torn/wardashboard-logic.js');

function attack({
    timestamp,
    attackerId = 101,
    attackerFactionId = 1,
    attackerName = null,
    defenderId = 201,
    defenderFactionId = 999,
    result = 'Attacked',
    respectGain = 1.5,
    isRankedWar = false,
    chain = null,
    useDetailedFactionShape = false
}) {
    const attacker = {
        id: attackerId
    };
    const defender = {
        id: defenderId
    };

    if (attackerName !== null) {
        attacker.name = attackerName;
    }

    if (useDetailedFactionShape) {
        attacker.faction = attackerFactionId === null ? null : { id: attackerFactionId, name: 'Attackers' };
        defender.faction = defenderFactionId === null ? null : { id: defenderFactionId, name: 'Defenders' };
    } else {
        attacker.faction_id = attackerFactionId;
        defender.faction_id = defenderFactionId;
    }

    return {
        started: timestamp,
        attacker,
        defender,
        result,
        respect_gain: respectGain,
        is_ranked_war: isRankedWar,
        chain
    };
}

test('aggregateWarMemberHits only counts direct enemy-faction hits when they are marked as ranked war attacks', () => {
    const aggregation = aggregateWarMemberHits({
        attacks: [
            attack({
                timestamp: 1_200,
                attackerId: 101,
                attackerFactionId: 1,
                defenderId: 301,
                defenderFactionId: 999,
                result: 'Attacked',
                respectGain: 2.5,
                isRankedWar: false,
                attackerName: 'Alpha'
            }),
            attack({
                timestamp: 1_260,
                attackerId: 101,
                attackerFactionId: 1,
                defenderId: 302,
                defenderFactionId: 999,
                result: 'Attacked',
                respectGain: 3.25,
                isRankedWar: true,
                attackerName: 'Alpha'
            })
        ],
        memberHits: {},
        warStart: 1_100,
        warEnd: 2_000,
        enemyFactionId: 999,
        chainContext: null
    });

    assert.deepEqual(aggregation.memberHits[101], {
        id: 101,
        name: 'Alpha',
        hits: 1,
        score: 3.25
    });
    assert.equal(aggregation.lastAttackTimestamp, 1_260);
    assert.deepEqual(aggregation.chainContext, {
        lastChainValue: null,
        lastChainTimestamp: null
    });
});

test('aggregateWarMemberHits counts out-of-faction chain saves using API chain metadata', () => {
    const aggregation = aggregateWarMemberHits({
        attacks: [
            attack({
                timestamp: 1_241,
                attackerId: 101,
                attackerFactionId: 1,
                attackerName: 'Alpha',
                defenderId: 301,
                defenderFactionId: 123,
                result: 'Attacked',
                respectGain: 2.5,
                chain: 51
            })
        ],
        memberHits: {},
        warStart: 1_100,
        warEnd: 2_000,
        enemyFactionId: 999,
        chainContext: {
            lastChainValue: 50,
            lastChainTimestamp: 1_000
        }
    });

    assert.deepEqual(aggregation.memberHits[101], {
        id: 101,
        name: 'Alpha',
        hits: 1,
        score: 2.5
    });
    assert.equal(aggregation.lastAttackTimestamp, 1_241);
    assert.deepEqual(aggregation.chainContext, {
        lastChainValue: 51,
        lastChainTimestamp: 1_241
    });
});

test('aggregateWarMemberHits does not count same-faction or non-chain-advancing attacks as chain saves', () => {
    const sameFactionAggregation = aggregateWarMemberHits({
        attacks: [
            attack({
                timestamp: 1_241,
                attackerId: 101,
                attackerFactionId: 1,
                defenderId: 301,
                defenderFactionId: 1,
                result: 'Attacked',
                respectGain: 2.5,
                chain: 51
            })
        ],
        memberHits: {},
        warStart: 1_100,
        warEnd: 2_000,
        enemyFactionId: 999,
        chainContext: {
            lastChainValue: 50,
            lastChainTimestamp: 1_000
        }
    });

    const nonAdvancingAggregation = aggregateWarMemberHits({
        attacks: [
            attack({
                timestamp: 1_241,
                attackerId: 101,
                attackerFactionId: 1,
                defenderId: 301,
                defenderFactionId: 123,
                result: 'Assist',
                respectGain: 0,
                chain: 51
            })
        ],
        memberHits: {},
        warStart: 1_100,
        warEnd: 2_000,
        enemyFactionId: 999,
        chainContext: {
            lastChainValue: 50,
            lastChainTimestamp: 1_000
        }
    });

    assert.deepEqual(sameFactionAggregation.memberHits, {});
    assert.deepEqual(nonAdvancingAggregation.memberHits, {});
    assert.deepEqual(sameFactionAggregation.chainContext, {
        lastChainValue: 51,
        lastChainTimestamp: 1_241
    });
    assert.deepEqual(nonAdvancingAggregation.chainContext, {
        lastChainValue: 50,
        lastChainTimestamp: 1_000
    });
});

test('aggregateWarMemberHits does not count an outside hit that lands too quickly to be a chain save', () => {
    const aggregation = aggregateWarMemberHits({
        attacks: [
            attack({
                timestamp: 1_180,
                attackerId: 101,
                attackerFactionId: 1,
                attackerName: 'Alpha',
                defenderId: 301,
                defenderFactionId: 123,
                result: 'Attacked',
                respectGain: 2.5,
                isRankedWar: false,
                chain: 51
            })
        ],
        memberHits: {},
        warStart: 1_100,
        warEnd: 2_000,
        enemyFactionId: 999,
        chainContext: {
            lastChainValue: 50,
            lastChainTimestamp: 1_000
        }
    });

    assert.deepEqual(aggregation.memberHits, {});
    assert.deepEqual(aggregation.chainContext, {
        lastChainValue: 51,
        lastChainTimestamp: 1_180
    });
});

test('aggregateWarMemberHits does not count an outside hit after the chain timer has expired', () => {
    const aggregation = aggregateWarMemberHits({
        attacks: [
            attack({
                timestamp: 1_301,
                attackerId: 101,
                attackerFactionId: 1,
                attackerName: 'Alpha',
                defenderId: 301,
                defenderFactionId: 123,
                result: 'Attacked',
                respectGain: 2.5,
                isRankedWar: false,
                chain: 1
            })
        ],
        memberHits: {},
        warStart: 1_100,
        warEnd: 2_000,
        enemyFactionId: 999,
        chainContext: {
            lastChainValue: 50,
            lastChainTimestamp: 1_000
        }
    });

    assert.deepEqual(aggregation.memberHits, {});
    assert.deepEqual(aggregation.chainContext, {
        lastChainValue: 1,
        lastChainTimestamp: 1_301
    });
});

test('aggregateWarMemberHits accepts detailed faction objects as well as simplified faction ids', () => {
    const aggregation = aggregateWarMemberHits({
        attacks: [
            attack({
                timestamp: 1_250,
                attackerId: 101,
                attackerFactionId: 1,
                attackerName: 'Alpha',
                defenderId: 301,
                defenderFactionId: 999,
                result: 'Hospitalized',
                respectGain: 4,
                isRankedWar: true,
                useDetailedFactionShape: true
            })
        ],
        memberHits: {},
        warStart: 1_100,
        warEnd: 2_000,
        enemyFactionId: 999,
        chainContext: null
    });

    assert.deepEqual(aggregation.memberHits[101], {
        id: 101,
        name: 'Alpha',
        hits: 1,
        score: 4
    });
});

test('aggregateWarMemberHits keeps the latest timestamp while filtering attacks outside the war window', () => {
    const aggregation = aggregateWarMemberHits({
        attacks: [
            attack({ timestamp: 900, attackerId: 101, defenderFactionId: 999, respectGain: 10, isRankedWar: true }),
            attack({ timestamp: 1_500, attackerId: 101, defenderFactionId: 999, respectGain: 4, isRankedWar: true })
        ],
        memberHits: {},
        warStart: 1_000,
        warEnd: 1_400,
        enemyFactionId: 999,
        chainContext: null,
        lastAttackTimestamp: 950
    });

    assert.equal(aggregation.lastAttackTimestamp, 1_500);
    assert.deepEqual(aggregation.memberHits, {});
});