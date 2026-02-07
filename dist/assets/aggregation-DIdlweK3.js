function t(t) {
    const e = new Map();
    t.forEach(t => {
        const n = t.entity.id;
        (e.has(n) || e.set(n, []), e.get(n).push(t));
    });
    const n = [];
    return (
        e.forEach((t, e) => {
            const o = t.reduce((t, e) => t + (e.count || 1), 0),
                i = Math.max(...t.map(t => t.confidence)),
                c = t[0];
            c &&
                n.push({
                    type: c.type,
                    entity: c.entity,
                    confidence: i,
                    position: c.position,
                    method: c.method,
                    count: o,
                });
        }),
        n.sort((t, e) => t.entity.name.localeCompare(e.entity.name))
    );
}
function e(t, e) {
    const n = [],
        o = new Set();
    return (
        [...t, ...e].forEach(t => {
            const e = t.entity,
                i = `${e.id}_${t.type}`;
            if (o.has(i)) {
                const o = n.find(n => n.entity.id === e.id && n.type === t.type);
                o && ((o.confidence = Math.min(0.98, 1.2 * o.confidence)), (o.method = 'hybrid'));
            } else
                (o.add(i),
                    n.push({
                        type: t.type,
                        entity: t.entity,
                        confidence: t.confidence,
                        position: t.position,
                        method: t.method || 'template_match',
                    }));
        }),
        n.sort((t, e) => e.confidence - t.confidence)
    );
}
export { t as a, e as c };
//# sourceMappingURL=aggregation-DIdlweK3.js.map
