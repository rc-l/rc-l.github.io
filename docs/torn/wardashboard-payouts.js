(function (root, factory) {
    const api = factory();

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }

    root.WarDashboardPayouts = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    function sanitizeIntegerInput(value) {
        return String(value || '').replace(/[^0-9]/g, '');
    }

    function formatWholeDollarValue(value) {
        if (value === '' || value === null || value === undefined) {
            return '';
        }
        return Number(value || 0).toLocaleString('en-US');
    }

    function calculateFinishedWarPayouts({
        targetInput,
        totalEarningsInput,
        cutPercentInput,
        memberHits
    }) {
        const target = parseInt(targetInput || '', 10);
        const totalEarnings = parseInt(sanitizeIntegerInput(totalEarningsInput || '0'), 10) || 0;
        const cutPercent = parseInt(cutPercentInput || '0', 10) || 0;
        const factionCutValue = Math.round(totalEarnings * (cutPercent / 100));
        const totalPay = totalEarnings - factionCutValue;
        const totalHits = memberHits.reduce((sum, hits) => sum + (parseInt(hits || '0', 10) || 0), 0);
        const hasTarget = Number.isFinite(target);

        const payouts = memberHits.map(hits => {
            const userHits = parseInt(hits || '0', 10) || 0;

            if (!hasTarget) {
                return null;
            }

            if (totalHits <= 0) {
                return 0;
            }

            return Math.round((totalPay / totalHits) * Math.min(userHits, target));
        });

        return {
            factionCutValue,
            hasTarget,
            payouts,
            target,
            totalEarnings,
            totalHits,
            totalPay
        };
    }

    return {
        calculateFinishedWarPayouts,
        formatWholeDollarValue,
        sanitizeIntegerInput
    };
});