(function (root, factory) {
    const api = factory();

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }

    root.WarDashboardLogic = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    const WAR_ENEMY_FACTION_RESULTS = new Set(['Attacked', 'Hospitalized', 'Bounty', 'Assist']);
    const CHAIN_VICTORY_RESULTS = new Set(['Attacked', 'Mugged', 'Hospitalized', 'Arrested', 'Bounty']);
    const CHAIN_SAVER_MIN_SECONDS = 4 * 60;
    const CHAIN_TIMER_SECONDS = 5 * 60;
    const CHAIN_SAVER_MIN_LENGTH = 50;

    function getWarStatus(war, factionId, currentTime) {
        if (war.start > currentTime) {
            return { label: 'Future', cssClass: 'status-future' };
        }
        if (war.end === 0 || war.end === null) {
            return { label: 'Ongoing', cssClass: 'status-ongoing' };
        }
        if (war.winner === factionId) {
            return { label: 'Won', cssClass: 'status-won' };
        }
        return { label: 'Lost', cssClass: 'status-lost' };
    }

    function getOpponentName(war, factionId) {
        if (!Array.isArray(war.factions)) return 'Unknown';
        const opponent = war.factions.find(faction => faction.id !== factionId);
        return opponent ? opponent.name : 'Unknown';
    }

    function getEnemyFactionId(war, factionId) {
        if (!Array.isArray(war.factions)) return null;
        const enemy = war.factions.find(faction => faction.id !== factionId);
        return enemy ? enemy.id : null;
    }

    function getAttackFactionId(person) {
        return person?.faction?.id ?? person?.faction_id ?? null;
    }

    function getAttackTimestamp(attack) {
        return Number.isFinite(attack?.started) ? attack.started : (attack?.ended || 0);
    }

    function getAttackChainValue(attack) {
        const rawChainValue = attack?.chain;
        const chainValue = typeof rawChainValue === 'number'
            ? rawChainValue
            : Number.NaN;
        return Number.isFinite(chainValue) ? chainValue : null;
    }

    function getAttackParticipantName(person) {
        return typeof person?.name === 'string' && person.name.trim() !== ''
            ? person.name
            : null;
    }

    function isChainVictory(attack) {
        return CHAIN_VICTORY_RESULTS.has(attack?.result);
    }

    function isEnemyFactionRankedWarHit(attack, enemyFactionId) {
        return attack?.is_ranked_war === true
            && getAttackFactionId(attack?.defender) === enemyFactionId
            && WAR_ENEMY_FACTION_RESULTS.has(attack?.result);
    }

    function areAttackParticipantsInSameFaction(attack) {
        const attackerFactionId = getAttackFactionId(attack?.attacker);
        const defenderFactionId = getAttackFactionId(attack?.defender);
        return attackerFactionId !== null && attackerFactionId === defenderFactionId;
    }

    function normalizeChainContext(chainContext) {
        return {
            lastChainValue: Number.isFinite(chainContext?.lastChainValue) ? chainContext.lastChainValue : null,
            lastChainTimestamp: Number.isFinite(chainContext?.lastChainTimestamp) ? chainContext.lastChainTimestamp : null
        };
    }

    function didAdvanceChain(attack, chainContext) {
        if (!isChainVictory(attack)) {
            return false;
        }

        const attackChainValue = getAttackChainValue(attack);
        if (!Number.isFinite(attackChainValue)) {
            return false;
        }

        if (!Number.isFinite(chainContext.lastChainValue)) {
            return attackChainValue >= 1;
        }

        return attackChainValue > chainContext.lastChainValue;
    }

    function updateChainContext(attack, attackTimestamp, chainContext) {
        if (!isChainVictory(attack)) {
            return chainContext;
        }

        const attackChainValue = getAttackChainValue(attack);
        if (!Number.isFinite(attackChainValue)) {
            return chainContext;
        }

        return {
            lastChainValue: attackChainValue,
            lastChainTimestamp: attackTimestamp
        };
    }

    function shouldCountChainSaveWarHit(attack, enemyFactionId, chainContext) {
        if (getAttackFactionId(attack?.defender) === enemyFactionId) return false;
        if (areAttackParticipantsInSameFaction(attack)) return false;
        if (!didAdvanceChain(attack, chainContext)) return false;

        const attackTimestamp = getAttackTimestamp(attack);
        const secondsSincePreviousChainHit = attackTimestamp - chainContext.lastChainTimestamp;
        const attackChainValue = getAttackChainValue(attack);

        return Number.isFinite(chainContext.lastChainTimestamp)
            && secondsSincePreviousChainHit >= CHAIN_SAVER_MIN_SECONDS
            && secondsSincePreviousChainHit <= CHAIN_TIMER_SECONDS
            && Number.isFinite(attackChainValue)
            && attackChainValue > CHAIN_SAVER_MIN_LENGTH;
    }

    function aggregateWarMemberHits({
        attacks,
        memberHits,
        warStart,
        warEnd = null,
        enemyFactionId,
        chainContext = null,
        lastAttackTimestamp = null
    }) {
        let latestTimestamp = Number.isFinite(lastAttackTimestamp) ? lastAttackTimestamp : Math.max(warStart - 1, 0);
        let currentChainContext = normalizeChainContext(chainContext);

        for (const attack of attacks) {
            const attackTimestamp = getAttackTimestamp(attack);
            if (attackTimestamp > latestTimestamp) latestTimestamp = attackTimestamp;
            if (attackTimestamp < warStart) continue;
            if (Number.isFinite(warEnd) && attackTimestamp > warEnd) continue;

            const attackerId = attack.attacker?.id;
            const attackerName = getAttackParticipantName(attack?.attacker);
            const shouldCountHit = isEnemyFactionRankedWarHit(attack, enemyFactionId)
                || shouldCountChainSaveWarHit(attack, enemyFactionId, currentChainContext);

            if (attackerId && shouldCountHit) {
                if (!memberHits[attackerId]) {
                    memberHits[attackerId] = { id: attackerId, name: attackerName, hits: 0, score: 0 };
                } else if (!memberHits[attackerId].name && attackerName) {
                    memberHits[attackerId].name = attackerName;
                }
                memberHits[attackerId].hits += 1;
                memberHits[attackerId].score += Number(attack.respect_gain || 0);
            } else if (attackerId && memberHits[attackerId] && !memberHits[attackerId].name && attackerName) {
                memberHits[attackerId].name = attackerName;
            }

            currentChainContext = updateChainContext(attack, attackTimestamp, currentChainContext);
        }

        return {
            memberHits,
            lastAttackTimestamp: latestTimestamp,
            chainContext: currentChainContext
        };
    }

    function sortMemberHitsForDisplay(memberHits) {
        return Object.values(memberHits).sort((left, right) => right.hits - left.hits || left.name.localeCompare(right.name));
    }

    return {
        aggregateWarMemberHits,
        getEnemyFactionId,
        getOpponentName,
        getWarStatus,
        sortMemberHitsForDisplay
    };
});