const DAY_MS = 1000 * 60 * 60 * 24;
function toDay(d) {
    return d.toISOString().slice(0, 10);
}
function clampRange(input) {
    const r = String(input || 'week');
    if (r === 'month' || r === 'all')
        return r;
    return 'week';
}
export function getRangeWindow(rangeInput) {
    const range = clampRange(rangeInput);
    const today = new Date();
    // normalize to local day bounds is hard without tz libs; use UTC day strings consistently.
    const until = new Date(today);
    const days = range === 'month' ? 30 : range === 'all' ? 3650 : 7;
    const since = new Date(until.getTime() - (days - 1) * DAY_MS);
    const sinceDay = toDay(since);
    const untilDay = toDay(until);
    let priorSince = null;
    let priorUntil = null;
    let priorSinceDay = null;
    let priorUntilDay = null;
    if (range !== 'all') {
        priorUntil = new Date(since.getTime() - DAY_MS);
        priorSince = new Date(priorUntil.getTime() - (days - 1) * DAY_MS);
        priorSinceDay = toDay(priorSince);
        priorUntilDay = toDay(priorUntil);
    }
    return {
        range,
        days,
        since,
        until,
        sinceDay,
        untilDay,
        priorSince,
        priorUntil,
        priorSinceDay,
        priorUntilDay
    };
}
export function enumerateDaysISO(startDayISO, endDayISO) {
    const out = [];
    const start = new Date(startDayISO + 'T00:00:00.000Z');
    const end = new Date(endDayISO + 'T00:00:00.000Z');
    for (let t = start.getTime(); t <= end.getTime(); t += DAY_MS) {
        out.push(new Date(t).toISOString().slice(0, 10));
    }
    return out;
}
//# sourceMappingURL=_range.js.map