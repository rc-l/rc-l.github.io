(function (root, factory) {
    const api = factory();

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }

    root.WarDashboardLogic = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    const WAR_ENEMY_FACTION_RESULTS = new Set(['Attacked', 'Hospitalized', 'Bounty', 'Assist']);
    const CHAIN_VICTORY_RESULTS = new Set(['Attacked', 'Mugged', 'Hospitalized', 'Arrested', 'Bounty']);
    const CHAIN_TIMER_SECONDS = 5 * 60;
    const CHAIN_SAVER_MIN_SECONDS = 4 * 60;
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

    function isEnemyFactionWarHit(attack, enemyFactionId) {
        return getAttackFactionId(attack.defender) === enemyFactionId
            && WAR_ENEMY_FACTION_RESULTS.has(attack?.result);
    }

    function areAttackParticipantsInSameFaction(attack) {
        const attackerFactionId = getAttackFactionId(attack?.attacker);
        const defenderFactionId = getAttackFactionId(attack?.defender);
        return attackerFactionId !== null && attackerFactionId === defenderFactionId;
    }

    class ChainTracker {
        constructor(state = {}) {
            this.length = Number.isFinite(state.length) ? state.length : 0;
            this.lastSuccessfulAttackTimestamp = Number.isFinite(state.lastSuccessfulAttackTimestamp)
                ? state.lastSuccessfulAttackTimestamp
                : null;
            this.lastHitWasVictory = false;
            this.lastHitWasOnTime = false;
            this.lastHitWasChainSave = false;
        }

        processAttack(attack) {
            this.lastHitWasVictory = CHAIN_VICTORY_RESULTS.has(attack?.result);
            this.lastHitWasOnTime = false;
            this.lastHitWasChainSave = false;

            if (!this.lastHitWasVictory) {
                return;
            }

            const attackTimestamp = getAttackTimestamp(attack);
            if (!Number.isFinite(attackTimestamp)) {
                return;
            }

            if (!Number.isFinite(this.lastSuccessfulAttackTimestamp)) {
                this.length = 1;
                this.lastSuccessfulAttackTimestamp = attackTimestamp;
                return;
            }

            const secondsSincePreviousSuccess = attackTimestamp - this.lastSuccessfulAttackTimestamp;
            this.lastHitWasOnTime = secondsSincePreviousSuccess <= CHAIN_TIMER_SECONDS;

            if (this.lastHitWasOnTime) {
                this.length += 1;
                this.lastHitWasChainSave = secondsSincePreviousSuccess >= CHAIN_SAVER_MIN_SECONDS
                    && this.length > CHAIN_SAVER_MIN_LENGTH;
            } else {
                this.length = 1;
            }

            this.lastSuccessfulAttackTimestamp = attackTimestamp;
        }

        is_victory() {
            return this.lastHitWasVictory;
        }

        was_on_time() {
            return this.lastHitWasOnTime;
        }

        is_chain_save() {
            return this.lastHitWasChainSave;
        }

        getState() {
            return {
                lastSuccessfulAttackTimestamp: this.lastSuccessfulAttackTimestamp,
                length: this.length
            };
        }
    }

    function shouldCountChainSaveWarHit(attack, enemyFactionId, chainTracker) {
        if (getAttackFactionId(attack.defender) === enemyFactionId) return false;
        if (areAttackParticipantsInSameFaction(attack)) return false;
        return chainTracker.is_chain_save();
    }

    function aggregateWarMemberHits({
        attacks,
        memberHits,
        warStart,
        warEnd = null,
        enemyFactionId,
        chainState = null,
        lastAttackTimestamp = null
    }) {
        let latestTimestamp = Number.isFinite(lastAttackTimestamp) ? lastAttackTimestamp : Math.max(warStart - 1, 0);
        const chainTracker = new ChainTracker(chainState || {});

        for (const attack of attacks) {
            const attackTimestamp = getAttackTimestamp(attack);
            if (attackTimestamp > latestTimestamp) latestTimestamp = attackTimestamp;
            if (attackTimestamp < warStart) continue;
            if (Number.isFinite(warEnd) && attackTimestamp > warEnd) continue;

            chainTracker.processAttack(attack);

            const attackerId = attack.attacker?.id;
            if (!attackerId) continue;

            if (isEnemyFactionWarHit(attack, enemyFactionId) || shouldCountChainSaveWarHit(attack, enemyFactionId, chainTracker)) {
                if (!memberHits[attackerId]) {
                    memberHits[attackerId] = { id: attackerId, name: null, hits: 0, score: 0 };
                }
                memberHits[attackerId].hits += 1;
                memberHits[attackerId].score += Number(attack.respect_gain || 0);
            }
        }

        return {
            memberHits,
            lastAttackTimestamp: latestTimestamp,
            chainState: chainTracker.getState()
        };
    }

    function sortMemberHitsForDisplay(memberHits) {
        return Object.values(memberHits).sort((left, right) => right.hits - left.hits || left.name.localeCompare(right.name));
    }

    return {
        ChainTracker,
        aggregateWarMemberHits,
        getEnemyFactionId,
        getOpponentName,
        getWarStatus,
        sortMemberHitsForDisplay
    };
});