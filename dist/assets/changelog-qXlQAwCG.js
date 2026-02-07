import { a as e, k as n, e as t, m as a, b as s } from './main-BWYXOf-Y.js';
function i(e, n) {
    switch (e) {
        case 'item':
            return s.items?.items?.find(e => e.id === n) || null;
        case 'weapon':
            return s.weapons?.weapons?.find(e => e.id === n) || null;
        case 'tome':
            return s.tomes?.tomes?.find(e => e.id === n) || null;
        case 'character':
            return s.characters?.characters?.find(e => e.id === n) || null;
        case 'shrine':
            return s.shrines?.shrines?.find(e => e.id === n) || null;
        default:
            return null;
    }
}
function c(e) {
    if (!e) return '';
    return e.replace(/\[\[(\w+):([\w-]*)\|([^\]]+)\]\]/g, (e, n, a, s) => {
        if (!['item', 'weapon', 'tome', 'character', 'shrine'].includes(n)) return s;
        if (!i(n, a)) return t(s);
        const c = t(n),
            r = t(a),
            o = t(s);
        return `<a href="#" class="entity-link"\n                   data-entity-type="${c}"\n                   data-entity-id="${r}"\n                   title="View ${o}">${o}</a>`;
    });
}
function r(e) {
    return (
        {
            balance: 'Balance Changes',
            new_content: 'New Content',
            bug_fixes: 'Bug Fixes',
            removed: 'Removed',
            other: 'Other Changes',
        }[e] || e
    );
}
function o(e) {
    if (!e) return '';
    const n = new Date(e + 'T00:00:00Z');
    return isNaN(n.getTime())
        ? 'Invalid Date'
        : n.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
}
function l(e, n) {
    if (!e) return n ? `<div class="changelog-raw-notes">${c(t(n))}</div>` : '';
    const a = ['new_content', 'balance', 'bug_fixes', 'removed', 'other']
        .map(n => {
            const t = e[n];
            if (!t || 0 === t.length) return '';
            const a = t
                .map(
                    e =>
                        `\n            <div class="changelog-item ${e.change_type || ''}">\n                ${c(e.text)}\n            </div>\n        `
                )
                .join('');
            return `\n            <div class="changelog-section">\n                <div class="changelog-section-title">${r(n)}</div>\n                ${a}\n            </div>\n        `;
        })
        .join('');
    return !a.trim() && n ? `<div class="changelog-raw-notes">${c(t(n))}</div>` : a;
}
function d(s) {
    const i = e('changelogContainer');
    if (!i) return;
    if (((i.innerHTML = ''), !s || 0 === s.length)) return void (i.innerHTML = n('📋', 'Changelog Entries'));
    const c = s[0]?.date ? o(s[0].date) : 'Unknown',
        d = document.createElement('header');
    ((d.className = 'changelog-page-header'),
        (d.innerHTML = `\n        <h2 class="changelog-page-title">📋 MegaBonk Changelog</h2>\n        <p class="changelog-page-subtitle">Official game updates and patch notes</p>\n        <div class="changelog-page-stats">\n            <span>${s.length} patches</span>\n            <span>•</span>\n            <span>Latest: ${c}</span>\n        </div>\n    `),
        i.appendChild(d),
        s.forEach(e => {
            const n = document.createElement('article');
            ((n.className = 'changelog-entry'), (n.dataset.patchId = e.id));
            const s = Object.entries(e.categories || {})
                .filter(([e, n]) => n && n.length > 0)
                .map(([e, n]) => ({ cat: e, count: n.length }))
                .map(({ cat: e, count: n }) => `<span class="category-pill ${e}">${r(e).split(' ')[0]} (${n})</span>`)
                .join('');
            ((n.innerHTML = `\n            <div class="changelog-header">\n                <span class="changelog-version">v${t(e.version)}</span>\n                <h3 class="changelog-title">${t(e.title)}</h3>\n                <span class="changelog-date">${o(e.date)}</span>\n                ${e.steam_url && a(e.steam_url) ? `\n                    <a href="${t(e.steam_url)}" target="_blank" rel="noopener" class="changelog-steam-link">\n                        🔗 Steam\n                    </a>\n                ` : ''}\n            </div>\n            <p class="changelog-summary">${t(e.summary || '')}</p>\n            <div class="changelog-categories">${s}</div>\n            <div class="changelog-changes" id="changes-${e.id}">\n                ${l(e.categories, e.raw_notes)}\n            </div>\n            <button class="changelog-expand-btn" data-target="changes-${e.id}"\n                    aria-expanded="false" aria-controls="changes-${e.id}">\n                Show Details\n            </button>\n        `),
                i.appendChild(n));
        }),
        i.removeEventListener('click', g),
        i.addEventListener('click', g));
}
function g(e) {
    const n = e.target.closest('.changelog-expand-btn');
    n && h(n);
}
function h(n) {
    const t = n.dataset.target;
    if (!t) return;
    const a = e(t);
    if (!a) return;
    a.classList.contains('expanded')
        ? (a.classList.remove('expanded'), (n.textContent = 'Show Details'), n.setAttribute('aria-expanded', 'false'))
        : (a.classList.add('expanded'), (n.textContent = 'Hide Details'), n.setAttribute('aria-expanded', 'true'));
}
function u(n) {
    const t = e('item-count');
    if (!t) return;
    const a = s.changelog?.patches?.length || 0,
        i = n?.length || 0;
    t.textContent = i === a ? `${i} patches` : `${i}/${a} patches`;
}
export {
    i as findEntityInData,
    r as formatCategoryName,
    o as formatChangelogDate,
    g as handleExpandClick,
    c as parseChangelogLinks,
    d as renderChangelog,
    l as renderChangesSections,
    h as toggleChangelogExpand,
    u as updateChangelogStats,
};
//# sourceMappingURL=changelog-qXlQAwCG.js.map
