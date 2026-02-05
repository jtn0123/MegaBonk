const __vite__mapDeps = (
    i,
    m = __vite__mapDeps,
    d = m.f ||
        (m.f = [
            'assets/build-planner-scan-CFTSzGm7.js',
            'assets/aggregation-DIdlweK3.js',
            'assets/build-planner-B3C08AMw.js',
            'assets/scan-build-9a7G2FoA.js',
        ])
) => i.map(i => d[i]);
!(function () {
    const e = document.createElement('link').relList;
    if (!(e && e.supports && e.supports('modulepreload'))) {
        for (const e of document.querySelectorAll('link[rel="modulepreload"]')) t(e);
        new MutationObserver(e => {
            for (const n of e)
                if ('childList' === n.type)
                    for (const e of n.addedNodes) 'LINK' === e.tagName && 'modulepreload' === e.rel && t(e);
        }).observe(document, { childList: !0, subtree: !0 });
    }
    function t(e) {
        if (e.ep) return;
        e.ep = !0;
        const t = (function (e) {
            const t = {};
            return (
                e.integrity && (t.integrity = e.integrity),
                e.referrerPolicy && (t.referrerPolicy = e.referrerPolicy),
                'use-credentials' === e.crossOrigin
                    ? (t.credentials = 'include')
                    : 'anonymous' === e.crossOrigin
                      ? (t.credentials = 'omit')
                      : (t.credentials = 'same-origin'),
                t
            );
        })(e);
        fetch(e.href, t);
    }
})();
const e = {
        container: null,
        init() {
            this.container ||
                ((this.container = document.createElement('div')),
                (this.container.id = 'toast-container'),
                this.container.setAttribute('role', 'status'),
                this.container.setAttribute('aria-live', 'polite'),
                this.container.setAttribute('aria-atomic', 'true'),
                document.body.appendChild(this.container));
        },
        show(e, t = 'info', n = 3e3) {
            this.init();
            const a = document.createElement('div');
            return (
                (a.className = `toast toast-${t}`),
                (a.textContent = e),
                a.setAttribute('role', 'alert'),
                this.container.appendChild(a),
                requestAnimationFrame(() => {
                    a.classList.add('toast-visible');
                }),
                setTimeout(() => {
                    (a.classList.remove('toast-visible'),
                        a.addEventListener(
                            'transitionend',
                            () => {
                                a.parentNode && a.remove();
                            },
                            { once: !0 }
                        ),
                        setTimeout(() => {
                            a.parentNode && a.remove();
                        }, 500));
                }, n),
                a
            );
        },
        info(e) {
            return this.show(e, 'info');
        },
        success(e) {
            return this.show(e, 'success');
        },
        warning(e) {
            return this.show(e, 'warning');
        },
        error(e) {
            return this.show(e, 'error');
        },
        reset() {
            this.container && (this.container.remove(), (this.container = null));
        },
    },
    t = {},
    n = function (e, n, a) {
        let i = Promise.resolve();
        if (n && n.length > 0) {
            let e = function (e) {
                return Promise.all(
                    e.map(e =>
                        Promise.resolve(e).then(
                            e => ({ status: 'fulfilled', value: e }),
                            e => ({ status: 'rejected', reason: e })
                        )
                    )
                );
            };
            document.getElementsByTagName('link');
            const a = document.querySelector('meta[property=csp-nonce]'),
                o = a?.nonce || a?.getAttribute('nonce');
            i = e(
                n.map(e => {
                    if (
                        (e = (function (e) {
                            return '/' + e;
                        })(e)) in t
                    )
                        return;
                    t[e] = !0;
                    const n = e.endsWith('.css'),
                        a = n ? '[rel="stylesheet"]' : '';
                    if (document.querySelector(`link[href="${e}"]${a}`)) return;
                    const i = document.createElement('link');
                    return (
                        (i.rel = n ? 'stylesheet' : 'modulepreload'),
                        n || (i.as = 'script'),
                        (i.crossOrigin = ''),
                        (i.href = e),
                        o && i.setAttribute('nonce', o),
                        document.head.appendChild(i),
                        n
                            ? new Promise((t, n) => {
                                  (i.addEventListener('load', t),
                                      i.addEventListener('error', () =>
                                          n(new Error(`Unable to preload CSS for ${e}`))
                                      ));
                              })
                            : void 0
                    );
                })
            );
        }
        function o(e) {
            const t = new Event('vite:preloadError', { cancelable: !0 });
            if (((t.payload = e), window.dispatchEvent(t), !t.defaultPrevented)) throw e;
        }
        return i.then(t => {
            for (const e of t || []) 'rejected' === e.status && o(e.reason);
            return e().catch(o);
        });
    };
function a(e, t, n) {
    function a(n, a) {
        if (
            (n._zod ||
                Object.defineProperty(n, '_zod', { value: { def: a, constr: r, traits: new Set() }, enumerable: !1 }),
            n._zod.traits.has(e))
        )
            return;
        (n._zod.traits.add(e), t(n, a));
        const i = r.prototype,
            o = Object.keys(i);
        for (let e = 0; e < o.length; e++) {
            const t = o[e];
            t in n || (n[t] = i[t].bind(n));
        }
    }
    const i = n?.Parent ?? Object;
    class o extends i {}
    function r(e) {
        var t;
        const i = n?.Parent ? new o() : this;
        (a(i, e), (t = i._zod).deferred ?? (t.deferred = []));
        for (const n of i._zod.deferred) n();
        return i;
    }
    return (
        Object.defineProperty(o, 'name', { value: e }),
        Object.defineProperty(r, 'init', { value: a }),
        Object.defineProperty(r, Symbol.hasInstance, {
            value: t => !!(n?.Parent && t instanceof n.Parent) || t?._zod?.traits?.has(e),
        }),
        Object.defineProperty(r, 'name', { value: e }),
        r
    );
}
class i extends Error {
    constructor() {
        super('Encountered Promise during synchronous parse. Use .parseAsync() instead.');
    }
}
class o extends Error {
    constructor(e) {
        (super(`Encountered unidirectional transform during encode: ${e}`), (this.name = 'ZodEncodeError'));
    }
}
const r = {};
function s(e) {
    return r;
}
function c(e) {
    const t = Object.values(e).filter(e => 'number' == typeof e);
    return Object.entries(e)
        .filter(([e, n]) => -1 === t.indexOf(+e))
        .map(([e, t]) => t);
}
function l(e, t) {
    return 'bigint' == typeof t ? t.toString() : t;
}
function d(e) {
    return {
        get value() {
            {
                const t = e();
                return (Object.defineProperty(this, 'value', { value: t }), t);
            }
        },
    };
}
function u(e) {
    return null == e;
}
function h(e) {
    const t = e.startsWith('^') ? 1 : 0,
        n = e.endsWith('$') ? e.length - 1 : e.length;
    return e.slice(t, n);
}
const m = Symbol('evaluating');
function p(e, t, n) {
    let a;
    Object.defineProperty(e, t, {
        get() {
            if (a !== m) return (void 0 === a && ((a = m), (a = n())), a);
        },
        set(n) {
            Object.defineProperty(e, t, { value: n });
        },
        configurable: !0,
    });
}
function f(e, t, n) {
    Object.defineProperty(e, t, { value: n, writable: !0, enumerable: !0, configurable: !0 });
}
function g(...e) {
    const t = {};
    for (const n of e) {
        const e = Object.getOwnPropertyDescriptors(n);
        Object.assign(t, e);
    }
    return Object.defineProperties({}, t);
}
function y(e) {
    return JSON.stringify(e);
}
const v = 'captureStackTrace' in Error ? Error.captureStackTrace : (...e) => {};
function b(e) {
    return 'object' == typeof e && null !== e && !Array.isArray(e);
}
const w = d(() => {
    if ('undefined' != typeof navigator && navigator?.userAgent?.includes('Cloudflare')) return !1;
    try {
        return (new Function(''), !0);
    } catch (e) {
        return !1;
    }
});
function _(e) {
    if (!1 === b(e)) return !1;
    const t = e.constructor;
    if (void 0 === t) return !0;
    if ('function' != typeof t) return !0;
    const n = t.prototype;
    return !1 !== b(n) && !1 !== Object.prototype.hasOwnProperty.call(n, 'isPrototypeOf');
}
function k(e) {
    return _(e) ? { ...e } : Array.isArray(e) ? [...e] : e;
}
const x = new Set(['string', 'number', 'symbol']);
function E(e) {
    return e.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function S(e, t, n) {
    const a = new e._zod.constr(t ?? e._zod.def);
    return ((t && !n?.parent) || (a._zod.parent = e), a);
}
function C(e) {
    const t = e;
    if (!t) return {};
    if ('string' == typeof t) return { error: () => t };
    if (void 0 !== t?.message) {
        if (void 0 !== t?.error) throw new Error('Cannot specify both `message` and `error` params');
        t.error = t.message;
    }
    return (delete t.message, 'string' == typeof t.error ? { ...t, error: () => t.error } : t);
}
const $ = {
    safeint: [Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER],
    int32: [-2147483648, 2147483647],
    uint32: [0, 4294967295],
    float32: [-34028234663852886e22, 34028234663852886e22],
    float64: [-Number.MAX_VALUE, Number.MAX_VALUE],
};
function M(e, t = 0) {
    if (!0 === e.aborted) return !0;
    for (let n = t; n < e.issues.length; n++) if (!0 !== e.issues[n]?.continue) return !0;
    return !1;
}
function T(e, t) {
    return t.map(t => {
        var n;
        return ((n = t).path ?? (n.path = []), t.path.unshift(e), t);
    });
}
function A(e) {
    return 'string' == typeof e ? e : e?.message;
}
function I(e, t, n) {
    const a = { ...e, path: e.path ?? [] };
    if (!e.message) {
        const i =
            A(e.inst?._zod.def?.error?.(e)) ??
            A(t?.error?.(e)) ??
            A(n.customError?.(e)) ??
            A(n.localeError?.(e)) ??
            'Invalid input';
        a.message = i;
    }
    return (delete a.inst, delete a.continue, t?.reportInput || delete a.input, a);
}
function L(e) {
    return Array.isArray(e) ? 'array' : 'string' == typeof e ? 'string' : 'unknown';
}
function z(...e) {
    const [t, n, a] = e;
    return 'string' == typeof t ? { message: t, code: 'custom', input: n, inst: a } : { ...t };
}
const D = (e, t) => {
        ((e.name = '$ZodError'),
            Object.defineProperty(e, '_zod', { value: e._zod, enumerable: !1 }),
            Object.defineProperty(e, 'issues', { value: t, enumerable: !1 }),
            (e.message = JSON.stringify(t, l, 2)),
            Object.defineProperty(e, 'toString', { value: () => e.message, enumerable: !1 }));
    },
    F = a('$ZodError', D),
    O = a('$ZodError', D, { Parent: Error });
const R = e => (t, n, a, o) => {
        const r = a ? Object.assign(a, { async: !1 }) : { async: !1 },
            c = t._zod.run({ value: n, issues: [] }, r);
        if (c instanceof Promise) throw new i();
        if (c.issues.length) {
            const t = new (o?.Err ?? e)(c.issues.map(e => I(e, r, s())));
            throw (v(t, o?.callee), t);
        }
        return c.value;
    },
    P = e => async (t, n, a, i) => {
        const o = a ? Object.assign(a, { async: !0 }) : { async: !0 };
        let r = t._zod.run({ value: n, issues: [] }, o);
        if ((r instanceof Promise && (r = await r), r.issues.length)) {
            const t = new (i?.Err ?? e)(r.issues.map(e => I(e, o, s())));
            throw (v(t, i?.callee), t);
        }
        return r.value;
    },
    N = e => (t, n, a) => {
        const o = a ? { ...a, async: !1 } : { async: !1 },
            r = t._zod.run({ value: n, issues: [] }, o);
        if (r instanceof Promise) throw new i();
        return r.issues.length
            ? { success: !1, error: new (e ?? F)(r.issues.map(e => I(e, o, s()))) }
            : { success: !0, data: r.value };
    },
    B = N(O),
    j = e => async (t, n, a) => {
        const i = a ? Object.assign(a, { async: !0 }) : { async: !0 };
        let o = t._zod.run({ value: n, issues: [] }, i);
        return (
            o instanceof Promise && (o = await o),
            o.issues.length
                ? { success: !1, error: new e(o.issues.map(e => I(e, i, s()))) }
                : { success: !0, data: o.value }
        );
    },
    q = j(O),
    H = e => (t, n, a) => {
        const i = a ? Object.assign(a, { direction: 'backward' }) : { direction: 'backward' };
        return R(e)(t, n, i);
    },
    Z = e => (t, n, a) => R(e)(t, n, a),
    U = e => async (t, n, a) => {
        const i = a ? Object.assign(a, { direction: 'backward' }) : { direction: 'backward' };
        return P(e)(t, n, i);
    },
    V = e => async (t, n, a) => P(e)(t, n, a),
    W = e => (t, n, a) => {
        const i = a ? Object.assign(a, { direction: 'backward' }) : { direction: 'backward' };
        return N(e)(t, n, i);
    },
    J = e => (t, n, a) => N(e)(t, n, a),
    K = e => async (t, n, a) => {
        const i = a ? Object.assign(a, { direction: 'backward' }) : { direction: 'backward' };
        return j(e)(t, n, i);
    },
    G = e => async (t, n, a) => j(e)(t, n, a),
    Y = /^[cC][^\s-]{8,}$/,
    X = /^[0-9a-z]+$/,
    Q = /^[0-9A-HJKMNP-TV-Za-hjkmnp-tv-z]{26}$/,
    ee = /^[0-9a-vA-V]{20}$/,
    te = /^[A-Za-z0-9]{27}$/,
    ne = /^[a-zA-Z0-9_-]{21}$/,
    ae = /^P(?:(\d+W)|(?!.*W)(?=\d|T\d)(\d+Y)?(\d+M)?(\d+D)?(T(?=\d)(\d+H)?(\d+M)?(\d+([.,]\d+)?S)?)?)$/,
    ie = /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/,
    oe = e =>
        e
            ? new RegExp(`^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-${e}[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12})$`)
            : /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/,
    re = /^(?!\.)(?!.*\.\.)([A-Za-z0-9_'+\-\.]*)[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9\-]*\.)+[A-Za-z]{2,}$/;
const se =
        /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/,
    ce =
        /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:))$/,
    le =
        /^((25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/([0-9]|[1-2][0-9]|3[0-2])$/,
    de =
        /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|::|([0-9a-fA-F]{1,4})?::([0-9a-fA-F]{1,4}:?){0,6})\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/,
    ue = /^$|^(?:[0-9a-zA-Z+/]{4})*(?:(?:[0-9a-zA-Z+/]{2}==)|(?:[0-9a-zA-Z+/]{3}=))?$/,
    he = /^[A-Za-z0-9_-]*$/,
    me = /^\+[1-9]\d{6,14}$/,
    pe =
        '(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))',
    fe = new RegExp(`^${pe}$`);
function ge(e) {
    const t = '(?:[01]\\d|2[0-3]):[0-5]\\d';
    return 'number' == typeof e.precision
        ? -1 === e.precision
            ? `${t}`
            : 0 === e.precision
              ? `${t}:[0-5]\\d`
              : `${t}:[0-5]\\d\\.\\d{${e.precision}}`
        : `${t}(?::[0-5]\\d(?:\\.\\d+)?)?`;
}
const ye = /^-?\d+$/,
    ve = /^-?\d+(?:\.\d+)?$/,
    be = /^(?:true|false)$/i,
    we = /^[^A-Z]*$/,
    _e = /^[^a-z]*$/,
    ke = a('$ZodCheck', (e, t) => {
        var n;
        (e._zod ?? (e._zod = {}), (e._zod.def = t), (n = e._zod).onattach ?? (n.onattach = []));
    }),
    xe = { number: 'number', bigint: 'bigint', object: 'date' },
    Ee = a('$ZodCheckLessThan', (e, t) => {
        ke.init(e, t);
        const n = xe[typeof t.value];
        (e._zod.onattach.push(e => {
            const n = e._zod.bag,
                a = (t.inclusive ? n.maximum : n.exclusiveMaximum) ?? Number.POSITIVE_INFINITY;
            t.value < a && (t.inclusive ? (n.maximum = t.value) : (n.exclusiveMaximum = t.value));
        }),
            (e._zod.check = a => {
                (t.inclusive ? a.value <= t.value : a.value < t.value) ||
                    a.issues.push({
                        origin: n,
                        code: 'too_big',
                        maximum: 'object' == typeof t.value ? t.value.getTime() : t.value,
                        input: a.value,
                        inclusive: t.inclusive,
                        inst: e,
                        continue: !t.abort,
                    });
            }));
    }),
    Se = a('$ZodCheckGreaterThan', (e, t) => {
        ke.init(e, t);
        const n = xe[typeof t.value];
        (e._zod.onattach.push(e => {
            const n = e._zod.bag,
                a = (t.inclusive ? n.minimum : n.exclusiveMinimum) ?? Number.NEGATIVE_INFINITY;
            t.value > a && (t.inclusive ? (n.minimum = t.value) : (n.exclusiveMinimum = t.value));
        }),
            (e._zod.check = a => {
                (t.inclusive ? a.value >= t.value : a.value > t.value) ||
                    a.issues.push({
                        origin: n,
                        code: 'too_small',
                        minimum: 'object' == typeof t.value ? t.value.getTime() : t.value,
                        input: a.value,
                        inclusive: t.inclusive,
                        inst: e,
                        continue: !t.abort,
                    });
            }));
    }),
    Ce = a('$ZodCheckMultipleOf', (e, t) => {
        (ke.init(e, t),
            e._zod.onattach.push(e => {
                var n;
                (n = e._zod.bag).multipleOf ?? (n.multipleOf = t.value);
            }),
            (e._zod.check = n => {
                if (typeof n.value != typeof t.value)
                    throw new Error('Cannot mix number and bigint in multiple_of check.');
                ('bigint' == typeof n.value
                    ? n.value % t.value === BigInt(0)
                    : 0 ===
                      (function (e, t) {
                          const n = (e.toString().split('.')[1] || '').length,
                              a = t.toString();
                          let i = (a.split('.')[1] || '').length;
                          if (0 === i && /\d?e-\d?/.test(a)) {
                              const e = a.match(/\d?e-(\d?)/);
                              e?.[1] && (i = Number.parseInt(e[1]));
                          }
                          const o = n > i ? n : i;
                          return (
                              (Number.parseInt(e.toFixed(o).replace('.', '')) %
                                  Number.parseInt(t.toFixed(o).replace('.', ''))) /
                              10 ** o
                          );
                      })(n.value, t.value)) ||
                    n.issues.push({
                        origin: typeof n.value,
                        code: 'not_multiple_of',
                        divisor: t.value,
                        input: n.value,
                        inst: e,
                        continue: !t.abort,
                    });
            }));
    }),
    $e = a('$ZodCheckNumberFormat', (e, t) => {
        (ke.init(e, t), (t.format = t.format || 'float64'));
        const n = t.format?.includes('int'),
            a = n ? 'int' : 'number',
            [i, o] = $[t.format];
        (e._zod.onattach.push(e => {
            const a = e._zod.bag;
            ((a.format = t.format), (a.minimum = i), (a.maximum = o), n && (a.pattern = ye));
        }),
            (e._zod.check = r => {
                const s = r.value;
                if (n) {
                    if (!Number.isInteger(s))
                        return void r.issues.push({
                            expected: a,
                            format: t.format,
                            code: 'invalid_type',
                            continue: !1,
                            input: s,
                            inst: e,
                        });
                    if (!Number.isSafeInteger(s))
                        return void (s > 0
                            ? r.issues.push({
                                  input: s,
                                  code: 'too_big',
                                  maximum: Number.MAX_SAFE_INTEGER,
                                  note: 'Integers must be within the safe integer range.',
                                  inst: e,
                                  origin: a,
                                  inclusive: !0,
                                  continue: !t.abort,
                              })
                            : r.issues.push({
                                  input: s,
                                  code: 'too_small',
                                  minimum: Number.MIN_SAFE_INTEGER,
                                  note: 'Integers must be within the safe integer range.',
                                  inst: e,
                                  origin: a,
                                  inclusive: !0,
                                  continue: !t.abort,
                              }));
                }
                (s < i &&
                    r.issues.push({
                        origin: 'number',
                        input: s,
                        code: 'too_small',
                        minimum: i,
                        inclusive: !0,
                        inst: e,
                        continue: !t.abort,
                    }),
                    s > o &&
                        r.issues.push({
                            origin: 'number',
                            input: s,
                            code: 'too_big',
                            maximum: o,
                            inclusive: !0,
                            inst: e,
                            continue: !t.abort,
                        }));
            }));
    }),
    Me = a('$ZodCheckMaxLength', (e, t) => {
        var n;
        (ke.init(e, t),
            (n = e._zod.def).when ??
                (n.when = e => {
                    const t = e.value;
                    return !u(t) && void 0 !== t.length;
                }),
            e._zod.onattach.push(e => {
                const n = e._zod.bag.maximum ?? Number.POSITIVE_INFINITY;
                t.maximum < n && (e._zod.bag.maximum = t.maximum);
            }),
            (e._zod.check = n => {
                const a = n.value;
                if (a.length <= t.maximum) return;
                const i = L(a);
                n.issues.push({
                    origin: i,
                    code: 'too_big',
                    maximum: t.maximum,
                    inclusive: !0,
                    input: a,
                    inst: e,
                    continue: !t.abort,
                });
            }));
    }),
    Te = a('$ZodCheckMinLength', (e, t) => {
        var n;
        (ke.init(e, t),
            (n = e._zod.def).when ??
                (n.when = e => {
                    const t = e.value;
                    return !u(t) && void 0 !== t.length;
                }),
            e._zod.onattach.push(e => {
                const n = e._zod.bag.minimum ?? Number.NEGATIVE_INFINITY;
                t.minimum > n && (e._zod.bag.minimum = t.minimum);
            }),
            (e._zod.check = n => {
                const a = n.value;
                if (a.length >= t.minimum) return;
                const i = L(a);
                n.issues.push({
                    origin: i,
                    code: 'too_small',
                    minimum: t.minimum,
                    inclusive: !0,
                    input: a,
                    inst: e,
                    continue: !t.abort,
                });
            }));
    }),
    Ae = a('$ZodCheckLengthEquals', (e, t) => {
        var n;
        (ke.init(e, t),
            (n = e._zod.def).when ??
                (n.when = e => {
                    const t = e.value;
                    return !u(t) && void 0 !== t.length;
                }),
            e._zod.onattach.push(e => {
                const n = e._zod.bag;
                ((n.minimum = t.length), (n.maximum = t.length), (n.length = t.length));
            }),
            (e._zod.check = n => {
                const a = n.value,
                    i = a.length;
                if (i === t.length) return;
                const o = L(a),
                    r = i > t.length;
                n.issues.push({
                    origin: o,
                    ...(r ? { code: 'too_big', maximum: t.length } : { code: 'too_small', minimum: t.length }),
                    inclusive: !0,
                    exact: !0,
                    input: n.value,
                    inst: e,
                    continue: !t.abort,
                });
            }));
    }),
    Ie = a('$ZodCheckStringFormat', (e, t) => {
        var n, a;
        (ke.init(e, t),
            e._zod.onattach.push(e => {
                const n = e._zod.bag;
                ((n.format = t.format),
                    t.pattern && (n.patterns ?? (n.patterns = new Set()), n.patterns.add(t.pattern)));
            }),
            t.pattern
                ? ((n = e._zod).check ??
                  (n.check = n => {
                      ((t.pattern.lastIndex = 0),
                          t.pattern.test(n.value) ||
                              n.issues.push({
                                  origin: 'string',
                                  code: 'invalid_format',
                                  format: t.format,
                                  input: n.value,
                                  ...(t.pattern ? { pattern: t.pattern.toString() } : {}),
                                  inst: e,
                                  continue: !t.abort,
                              }));
                  }))
                : ((a = e._zod).check ?? (a.check = () => {})));
    }),
    Le = a('$ZodCheckRegex', (e, t) => {
        (Ie.init(e, t),
            (e._zod.check = n => {
                ((t.pattern.lastIndex = 0),
                    t.pattern.test(n.value) ||
                        n.issues.push({
                            origin: 'string',
                            code: 'invalid_format',
                            format: 'regex',
                            input: n.value,
                            pattern: t.pattern.toString(),
                            inst: e,
                            continue: !t.abort,
                        }));
            }));
    }),
    ze = a('$ZodCheckLowerCase', (e, t) => {
        (t.pattern ?? (t.pattern = we), Ie.init(e, t));
    }),
    De = a('$ZodCheckUpperCase', (e, t) => {
        (t.pattern ?? (t.pattern = _e), Ie.init(e, t));
    }),
    Fe = a('$ZodCheckIncludes', (e, t) => {
        ke.init(e, t);
        const n = E(t.includes),
            a = new RegExp('number' == typeof t.position ? `^.{${t.position}}${n}` : n);
        ((t.pattern = a),
            e._zod.onattach.push(e => {
                const t = e._zod.bag;
                (t.patterns ?? (t.patterns = new Set()), t.patterns.add(a));
            }),
            (e._zod.check = n => {
                n.value.includes(t.includes, t.position) ||
                    n.issues.push({
                        origin: 'string',
                        code: 'invalid_format',
                        format: 'includes',
                        includes: t.includes,
                        input: n.value,
                        inst: e,
                        continue: !t.abort,
                    });
            }));
    }),
    Oe = a('$ZodCheckStartsWith', (e, t) => {
        ke.init(e, t);
        const n = new RegExp(`^${E(t.prefix)}.*`);
        (t.pattern ?? (t.pattern = n),
            e._zod.onattach.push(e => {
                const t = e._zod.bag;
                (t.patterns ?? (t.patterns = new Set()), t.patterns.add(n));
            }),
            (e._zod.check = n => {
                n.value.startsWith(t.prefix) ||
                    n.issues.push({
                        origin: 'string',
                        code: 'invalid_format',
                        format: 'starts_with',
                        prefix: t.prefix,
                        input: n.value,
                        inst: e,
                        continue: !t.abort,
                    });
            }));
    }),
    Re = a('$ZodCheckEndsWith', (e, t) => {
        ke.init(e, t);
        const n = new RegExp(`.*${E(t.suffix)}$`);
        (t.pattern ?? (t.pattern = n),
            e._zod.onattach.push(e => {
                const t = e._zod.bag;
                (t.patterns ?? (t.patterns = new Set()), t.patterns.add(n));
            }),
            (e._zod.check = n => {
                n.value.endsWith(t.suffix) ||
                    n.issues.push({
                        origin: 'string',
                        code: 'invalid_format',
                        format: 'ends_with',
                        suffix: t.suffix,
                        input: n.value,
                        inst: e,
                        continue: !t.abort,
                    });
            }));
    }),
    Pe = a('$ZodCheckOverwrite', (e, t) => {
        (ke.init(e, t),
            (e._zod.check = e => {
                e.value = t.tx(e.value);
            }));
    });
class Ne {
    constructor(e = []) {
        ((this.content = []), (this.indent = 0), this && (this.args = e));
    }
    indented(e) {
        ((this.indent += 1), e(this), (this.indent -= 1));
    }
    write(e) {
        if ('function' == typeof e) return (e(this, { execution: 'sync' }), void e(this, { execution: 'async' }));
        const t = e.split('\n').filter(e => e),
            n = Math.min(...t.map(e => e.length - e.trimStart().length)),
            a = t.map(e => e.slice(n)).map(e => ' '.repeat(2 * this.indent) + e);
        for (const i of a) this.content.push(i);
    }
    compile() {
        const e = Function,
            t = this?.args;
        return new e(...t, [...(this?.content ?? ['']).map(e => `  ${e}`)].join('\n'));
    }
}
const Be = { major: 4, minor: 3, patch: 6 },
    je = a('$ZodType', (e, t) => {
        var n;
        (e ?? (e = {}), (e._zod.def = t), (e._zod.bag = e._zod.bag || {}), (e._zod.version = Be));
        const a = [...(e._zod.def.checks ?? [])];
        e._zod.traits.has('$ZodCheck') && a.unshift(e);
        for (const i of a) for (const t of i._zod.onattach) t(e);
        if (0 === a.length)
            ((n = e._zod).deferred ?? (n.deferred = []),
                e._zod.deferred?.push(() => {
                    e._zod.run = e._zod.parse;
                }));
        else {
            const t = (e, t, n) => {
                    let a,
                        o = M(e);
                    for (const r of t) {
                        if (r._zod.def.when) {
                            if (!r._zod.def.when(e)) continue;
                        } else if (o) continue;
                        const t = e.issues.length,
                            s = r._zod.check(e);
                        if (s instanceof Promise && !1 === n?.async) throw new i();
                        if (a || s instanceof Promise)
                            a = (a ?? Promise.resolve()).then(async () => {
                                await s;
                                e.issues.length !== t && (o || (o = M(e, t)));
                            });
                        else {
                            if (e.issues.length === t) continue;
                            o || (o = M(e, t));
                        }
                    }
                    return a ? a.then(() => e) : e;
                },
                n = (n, o, r) => {
                    if (M(n)) return ((n.aborted = !0), n);
                    const s = t(o, a, r);
                    if (s instanceof Promise) {
                        if (!1 === r.async) throw new i();
                        return s.then(t => e._zod.parse(t, r));
                    }
                    return e._zod.parse(s, r);
                };
            e._zod.run = (o, r) => {
                if (r.skipChecks) return e._zod.parse(o, r);
                if ('backward' === r.direction) {
                    const t = e._zod.parse({ value: o.value, issues: [] }, { ...r, skipChecks: !0 });
                    return t instanceof Promise ? t.then(e => n(e, o, r)) : n(t, o, r);
                }
                const s = e._zod.parse(o, r);
                if (s instanceof Promise) {
                    if (!1 === r.async) throw new i();
                    return s.then(e => t(e, a, r));
                }
                return t(s, a, r);
            };
        }
        p(e, '~standard', () => ({
            validate: t => {
                try {
                    const n = B(e, t);
                    return n.success ? { value: n.data } : { issues: n.error?.issues };
                } catch (n) {
                    return q(e, t).then(e => (e.success ? { value: e.data } : { issues: e.error?.issues }));
                }
            },
            vendor: 'zod',
            version: 1,
        }));
    }),
    qe = a('$ZodString', (e, t) => {
        var n;
        (je.init(e, t),
            (e._zod.pattern =
                [...(e?._zod.bag?.patterns ?? [])].pop() ??
                ((n = e._zod.bag),
                new RegExp(`^${n ? `[\\s\\S]{${n?.minimum ?? 0},${n?.maximum ?? ''}}` : '[\\s\\S]*'}$`))),
            (e._zod.parse = (n, a) => {
                if (t.coerce)
                    try {
                        n.value = String(n.value);
                    } catch (i) {}
                return (
                    'string' == typeof n.value ||
                        n.issues.push({ expected: 'string', code: 'invalid_type', input: n.value, inst: e }),
                    n
                );
            }));
    }),
    He = a('$ZodStringFormat', (e, t) => {
        (Ie.init(e, t), qe.init(e, t));
    }),
    Ze = a('$ZodGUID', (e, t) => {
        (t.pattern ?? (t.pattern = ie), He.init(e, t));
    }),
    Ue = a('$ZodUUID', (e, t) => {
        if (t.version) {
            const e = { v1: 1, v2: 2, v3: 3, v4: 4, v5: 5, v6: 6, v7: 7, v8: 8 }[t.version];
            if (void 0 === e) throw new Error(`Invalid UUID version: "${t.version}"`);
            t.pattern ?? (t.pattern = oe(e));
        } else t.pattern ?? (t.pattern = oe());
        He.init(e, t);
    }),
    Ve = a('$ZodEmail', (e, t) => {
        (t.pattern ?? (t.pattern = re), He.init(e, t));
    }),
    We = a('$ZodURL', (e, t) => {
        (He.init(e, t),
            (e._zod.check = n => {
                try {
                    const a = n.value.trim(),
                        i = new URL(a);
                    return (
                        t.hostname &&
                            ((t.hostname.lastIndex = 0),
                            t.hostname.test(i.hostname) ||
                                n.issues.push({
                                    code: 'invalid_format',
                                    format: 'url',
                                    note: 'Invalid hostname',
                                    pattern: t.hostname.source,
                                    input: n.value,
                                    inst: e,
                                    continue: !t.abort,
                                })),
                        t.protocol &&
                            ((t.protocol.lastIndex = 0),
                            t.protocol.test(i.protocol.endsWith(':') ? i.protocol.slice(0, -1) : i.protocol) ||
                                n.issues.push({
                                    code: 'invalid_format',
                                    format: 'url',
                                    note: 'Invalid protocol',
                                    pattern: t.protocol.source,
                                    input: n.value,
                                    inst: e,
                                    continue: !t.abort,
                                })),
                        void (t.normalize ? (n.value = i.href) : (n.value = a))
                    );
                } catch (a) {
                    n.issues.push({
                        code: 'invalid_format',
                        format: 'url',
                        input: n.value,
                        inst: e,
                        continue: !t.abort,
                    });
                }
            }));
    }),
    Je = a('$ZodEmoji', (e, t) => {
        (t.pattern ?? (t.pattern = new RegExp('^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$', 'u')),
            He.init(e, t));
    }),
    Ke = a('$ZodNanoID', (e, t) => {
        (t.pattern ?? (t.pattern = ne), He.init(e, t));
    }),
    Ge = a('$ZodCUID', (e, t) => {
        (t.pattern ?? (t.pattern = Y), He.init(e, t));
    }),
    Ye = a('$ZodCUID2', (e, t) => {
        (t.pattern ?? (t.pattern = X), He.init(e, t));
    }),
    Xe = a('$ZodULID', (e, t) => {
        (t.pattern ?? (t.pattern = Q), He.init(e, t));
    }),
    Qe = a('$ZodXID', (e, t) => {
        (t.pattern ?? (t.pattern = ee), He.init(e, t));
    }),
    et = a('$ZodKSUID', (e, t) => {
        (t.pattern ?? (t.pattern = te), He.init(e, t));
    }),
    tt = a('$ZodISODateTime', (e, t) => {
        (t.pattern ??
            (t.pattern = (function (e) {
                const t = ge({ precision: e.precision }),
                    n = ['Z'];
                (e.local && n.push(''), e.offset && n.push('([+-](?:[01]\\d|2[0-3]):[0-5]\\d)'));
                const a = `${t}(?:${n.join('|')})`;
                return new RegExp(`^${pe}T(?:${a})$`);
            })(t)),
            He.init(e, t));
    }),
    nt = a('$ZodISODate', (e, t) => {
        (t.pattern ?? (t.pattern = fe), He.init(e, t));
    }),
    at = a('$ZodISOTime', (e, t) => {
        (t.pattern ?? (t.pattern = new RegExp(`^${ge(t)}$`)), He.init(e, t));
    }),
    it = a('$ZodISODuration', (e, t) => {
        (t.pattern ?? (t.pattern = ae), He.init(e, t));
    }),
    ot = a('$ZodIPv4', (e, t) => {
        (t.pattern ?? (t.pattern = se), He.init(e, t), (e._zod.bag.format = 'ipv4'));
    }),
    rt = a('$ZodIPv6', (e, t) => {
        (t.pattern ?? (t.pattern = ce),
            He.init(e, t),
            (e._zod.bag.format = 'ipv6'),
            (e._zod.check = n => {
                try {
                    new URL(`http://[${n.value}]`);
                } catch {
                    n.issues.push({
                        code: 'invalid_format',
                        format: 'ipv6',
                        input: n.value,
                        inst: e,
                        continue: !t.abort,
                    });
                }
            }));
    }),
    st = a('$ZodCIDRv4', (e, t) => {
        (t.pattern ?? (t.pattern = le), He.init(e, t));
    }),
    ct = a('$ZodCIDRv6', (e, t) => {
        (t.pattern ?? (t.pattern = de),
            He.init(e, t),
            (e._zod.check = n => {
                const a = n.value.split('/');
                try {
                    if (2 !== a.length) throw new Error();
                    const [e, t] = a;
                    if (!t) throw new Error();
                    const n = Number(t);
                    if (`${n}` !== t) throw new Error();
                    if (n < 0 || n > 128) throw new Error();
                    new URL(`http://[${e}]`);
                } catch {
                    n.issues.push({
                        code: 'invalid_format',
                        format: 'cidrv6',
                        input: n.value,
                        inst: e,
                        continue: !t.abort,
                    });
                }
            }));
    });
function lt(e) {
    if ('' === e) return !0;
    if (e.length % 4 != 0) return !1;
    try {
        return (atob(e), !0);
    } catch {
        return !1;
    }
}
const dt = a('$ZodBase64', (e, t) => {
    (t.pattern ?? (t.pattern = ue),
        He.init(e, t),
        (e._zod.bag.contentEncoding = 'base64'),
        (e._zod.check = n => {
            lt(n.value) ||
                n.issues.push({
                    code: 'invalid_format',
                    format: 'base64',
                    input: n.value,
                    inst: e,
                    continue: !t.abort,
                });
        }));
});
const ut = a('$ZodBase64URL', (e, t) => {
        (t.pattern ?? (t.pattern = he),
            He.init(e, t),
            (e._zod.bag.contentEncoding = 'base64url'),
            (e._zod.check = n => {
                (function (e) {
                    if (!he.test(e)) return !1;
                    const t = e.replace(/[-_]/g, e => ('-' === e ? '+' : '/'));
                    return lt(t.padEnd(4 * Math.ceil(t.length / 4), '='));
                })(n.value) ||
                    n.issues.push({
                        code: 'invalid_format',
                        format: 'base64url',
                        input: n.value,
                        inst: e,
                        continue: !t.abort,
                    });
            }));
    }),
    ht = a('$ZodE164', (e, t) => {
        (t.pattern ?? (t.pattern = me), He.init(e, t));
    });
const mt = a('$ZodJWT', (e, t) => {
        (He.init(e, t),
            (e._zod.check = n => {
                (function (e, t = null) {
                    try {
                        const n = e.split('.');
                        if (3 !== n.length) return !1;
                        const [a] = n;
                        if (!a) return !1;
                        const i = JSON.parse(atob(a));
                        return !(('typ' in i && 'JWT' !== i?.typ) || !i.alg || (t && (!('alg' in i) || i.alg !== t)));
                    } catch {
                        return !1;
                    }
                })(n.value, t.alg) ||
                    n.issues.push({
                        code: 'invalid_format',
                        format: 'jwt',
                        input: n.value,
                        inst: e,
                        continue: !t.abort,
                    });
            }));
    }),
    pt = a('$ZodNumber', (e, t) => {
        (je.init(e, t),
            (e._zod.pattern = e._zod.bag.pattern ?? ve),
            (e._zod.parse = (n, a) => {
                if (t.coerce)
                    try {
                        n.value = Number(n.value);
                    } catch (r) {}
                const i = n.value;
                if ('number' == typeof i && !Number.isNaN(i) && Number.isFinite(i)) return n;
                const o =
                    'number' == typeof i
                        ? Number.isNaN(i)
                            ? 'NaN'
                            : Number.isFinite(i)
                              ? void 0
                              : 'Infinity'
                        : void 0;
                return (
                    n.issues.push({
                        expected: 'number',
                        code: 'invalid_type',
                        input: i,
                        inst: e,
                        ...(o ? { received: o } : {}),
                    }),
                    n
                );
            }));
    }),
    ft = a('$ZodNumberFormat', (e, t) => {
        ($e.init(e, t), pt.init(e, t));
    }),
    gt = a('$ZodBoolean', (e, t) => {
        (je.init(e, t),
            (e._zod.pattern = be),
            (e._zod.parse = (n, a) => {
                if (t.coerce)
                    try {
                        n.value = Boolean(n.value);
                    } catch (o) {}
                const i = n.value;
                return (
                    'boolean' == typeof i ||
                        n.issues.push({ expected: 'boolean', code: 'invalid_type', input: i, inst: e }),
                    n
                );
            }));
    }),
    yt = a('$ZodUnknown', (e, t) => {
        (je.init(e, t), (e._zod.parse = e => e));
    }),
    vt = a('$ZodNever', (e, t) => {
        (je.init(e, t),
            (e._zod.parse = (t, n) => (
                t.issues.push({ expected: 'never', code: 'invalid_type', input: t.value, inst: e }),
                t
            )));
    });
function bt(e, t, n) {
    (e.issues.length && t.issues.push(...T(n, e.issues)), (t.value[n] = e.value));
}
const wt = a('$ZodArray', (e, t) => {
    (je.init(e, t),
        (e._zod.parse = (n, a) => {
            const i = n.value;
            if (!Array.isArray(i))
                return (n.issues.push({ expected: 'array', code: 'invalid_type', input: i, inst: e }), n);
            n.value = Array(i.length);
            const o = [];
            for (let e = 0; e < i.length; e++) {
                const r = i[e],
                    s = t.element._zod.run({ value: r, issues: [] }, a);
                s instanceof Promise ? o.push(s.then(t => bt(t, n, e))) : bt(s, n, e);
            }
            return o.length ? Promise.all(o).then(() => n) : n;
        }));
});
function _t(e, t, n, a, i) {
    if (e.issues.length) {
        if (i && !(n in a)) return;
        t.issues.push(...T(n, e.issues));
    }
    void 0 === e.value ? n in a && (t.value[n] = void 0) : (t.value[n] = e.value);
}
function kt(e) {
    const t = Object.keys(e.shape);
    for (const i of t)
        if (!e.shape?.[i]?._zod?.traits?.has('$ZodType'))
            throw new Error(`Invalid element at key "${i}": expected a Zod schema`);
    const n =
        ((a = e.shape), Object.keys(a).filter(e => 'optional' === a[e]._zod.optin && 'optional' === a[e]._zod.optout));
    var a;
    return { ...e, keys: t, keySet: new Set(t), numKeys: t.length, optionalKeys: new Set(n) };
}
function xt(e, t, n, a, i, o) {
    const r = [],
        s = i.keySet,
        c = i.catchall._zod,
        l = c.def.type,
        d = 'optional' === c.optout;
    for (const u in t) {
        if (s.has(u)) continue;
        if ('never' === l) {
            r.push(u);
            continue;
        }
        const i = c.run({ value: t[u], issues: [] }, a);
        i instanceof Promise ? e.push(i.then(e => _t(e, n, u, t, d))) : _t(i, n, u, t, d);
    }
    return (
        r.length && n.issues.push({ code: 'unrecognized_keys', keys: r, input: t, inst: o }),
        e.length ? Promise.all(e).then(() => n) : n
    );
}
const Et = a('$ZodObject', (e, t) => {
        je.init(e, t);
        const n = Object.getOwnPropertyDescriptor(t, 'shape');
        if (!n?.get) {
            const e = t.shape;
            Object.defineProperty(t, 'shape', {
                get: () => {
                    const n = { ...e };
                    return (Object.defineProperty(t, 'shape', { value: n }), n);
                },
            });
        }
        const a = d(() => kt(t));
        p(e._zod, 'propValues', () => {
            const e = t.shape,
                n = {};
            for (const t in e) {
                const a = e[t]._zod;
                if (a.values) {
                    n[t] ?? (n[t] = new Set());
                    for (const e of a.values) n[t].add(e);
                }
            }
            return n;
        });
        const i = b,
            o = t.catchall;
        let r;
        e._zod.parse = (t, n) => {
            r ?? (r = a.value);
            const s = t.value;
            if (!i(s)) return (t.issues.push({ expected: 'object', code: 'invalid_type', input: s, inst: e }), t);
            t.value = {};
            const c = [],
                l = r.shape;
            for (const e of r.keys) {
                const a = l[e],
                    i = 'optional' === a._zod.optout,
                    o = a._zod.run({ value: s[e], issues: [] }, n);
                o instanceof Promise ? c.push(o.then(n => _t(n, t, e, s, i))) : _t(o, t, e, s, i);
            }
            return o ? xt(c, s, t, n, a.value, e) : c.length ? Promise.all(c).then(() => t) : t;
        };
    }),
    St = a('$ZodObjectJIT', (e, t) => {
        Et.init(e, t);
        const n = e._zod.parse,
            a = d(() => kt(t));
        let i;
        const o = b,
            s = !r.jitless,
            c = s && w.value,
            l = t.catchall;
        let u;
        e._zod.parse = (r, d) => {
            u ?? (u = a.value);
            const h = r.value;
            return o(h)
                ? s && c && !1 === d?.async && !0 !== d.jitless
                    ? (i ||
                          (i = (e => {
                              const t = new Ne(['shape', 'payload', 'ctx']),
                                  n = a.value,
                                  i = e => {
                                      const t = y(e);
                                      return `shape[${t}]._zod.run({ value: input[${t}], issues: [] }, ctx)`;
                                  };
                              t.write('const input = payload.value;');
                              const o = Object.create(null);
                              let r = 0;
                              for (const a of n.keys) o[a] = 'key_' + r++;
                              t.write('const newResult = {};');
                              for (const a of n.keys) {
                                  const n = o[a],
                                      r = y(a),
                                      s = e[a],
                                      c = 'optional' === s?._zod?.optout;
                                  (t.write(`const ${n} = ${i(a)};`),
                                      c
                                          ? t.write(
                                                `\n        if (${n}.issues.length) {\n          if (${r} in input) {\n            payload.issues = payload.issues.concat(${n}.issues.map(iss => ({\n              ...iss,\n              path: iss.path ? [${r}, ...iss.path] : [${r}]\n            })));\n          }\n        }\n        \n        if (${n}.value === undefined) {\n          if (${r} in input) {\n            newResult[${r}] = undefined;\n          }\n        } else {\n          newResult[${r}] = ${n}.value;\n        }\n        \n      `
                                            )
                                          : t.write(
                                                `\n        if (${n}.issues.length) {\n          payload.issues = payload.issues.concat(${n}.issues.map(iss => ({\n            ...iss,\n            path: iss.path ? [${r}, ...iss.path] : [${r}]\n          })));\n        }\n        \n        if (${n}.value === undefined) {\n          if (${r} in input) {\n            newResult[${r}] = undefined;\n          }\n        } else {\n          newResult[${r}] = ${n}.value;\n        }\n        \n      `
                                            ));
                              }
                              (t.write('payload.value = newResult;'), t.write('return payload;'));
                              const s = t.compile();
                              return (t, n) => s(e, t, n);
                          })(t.shape)),
                      (r = i(r, d)),
                      l ? xt([], h, r, d, u, e) : r)
                    : n(r, d)
                : (r.issues.push({ expected: 'object', code: 'invalid_type', input: h, inst: e }), r);
        };
    });
function Ct(e, t, n, a) {
    for (const o of e) if (0 === o.issues.length) return ((t.value = o.value), t);
    const i = e.filter(e => !M(e));
    return 1 === i.length
        ? ((t.value = i[0].value), i[0])
        : (t.issues.push({
              code: 'invalid_union',
              input: t.value,
              inst: n,
              errors: e.map(e => e.issues.map(e => I(e, a, s()))),
          }),
          t);
}
const $t = a('$ZodUnion', (e, t) => {
        (je.init(e, t),
            p(e._zod, 'optin', () => (t.options.some(e => 'optional' === e._zod.optin) ? 'optional' : void 0)),
            p(e._zod, 'optout', () => (t.options.some(e => 'optional' === e._zod.optout) ? 'optional' : void 0)),
            p(e._zod, 'values', () => {
                if (t.options.every(e => e._zod.values))
                    return new Set(t.options.flatMap(e => Array.from(e._zod.values)));
            }),
            p(e._zod, 'pattern', () => {
                if (t.options.every(e => e._zod.pattern)) {
                    const e = t.options.map(e => e._zod.pattern);
                    return new RegExp(`^(${e.map(e => h(e.source)).join('|')})$`);
                }
            }));
        const n = 1 === t.options.length,
            a = t.options[0]._zod.run;
        e._zod.parse = (i, o) => {
            if (n) return a(i, o);
            let r = !1;
            const s = [];
            for (const e of t.options) {
                const t = e._zod.run({ value: i.value, issues: [] }, o);
                if (t instanceof Promise) (s.push(t), (r = !0));
                else {
                    if (0 === t.issues.length) return t;
                    s.push(t);
                }
            }
            return r ? Promise.all(s).then(t => Ct(t, i, e, o)) : Ct(s, i, e, o);
        };
    }),
    Mt = a('$ZodIntersection', (e, t) => {
        (je.init(e, t),
            (e._zod.parse = (e, n) => {
                const a = e.value,
                    i = t.left._zod.run({ value: a, issues: [] }, n),
                    o = t.right._zod.run({ value: a, issues: [] }, n);
                return i instanceof Promise || o instanceof Promise
                    ? Promise.all([i, o]).then(([t, n]) => At(e, t, n))
                    : At(e, i, o);
            }));
    });
function Tt(e, t) {
    if (e === t) return { valid: !0, data: e };
    if (e instanceof Date && t instanceof Date && +e === +t) return { valid: !0, data: e };
    if (_(e) && _(t)) {
        const n = Object.keys(t),
            a = Object.keys(e).filter(e => -1 !== n.indexOf(e)),
            i = { ...e, ...t };
        for (const o of a) {
            const n = Tt(e[o], t[o]);
            if (!n.valid) return { valid: !1, mergeErrorPath: [o, ...n.mergeErrorPath] };
            i[o] = n.data;
        }
        return { valid: !0, data: i };
    }
    if (Array.isArray(e) && Array.isArray(t)) {
        if (e.length !== t.length) return { valid: !1, mergeErrorPath: [] };
        const n = [];
        for (let a = 0; a < e.length; a++) {
            const i = Tt(e[a], t[a]);
            if (!i.valid) return { valid: !1, mergeErrorPath: [a, ...i.mergeErrorPath] };
            n.push(i.data);
        }
        return { valid: !0, data: n };
    }
    return { valid: !1, mergeErrorPath: [] };
}
function At(e, t, n) {
    const a = new Map();
    let i;
    for (const s of t.issues)
        if ('unrecognized_keys' === s.code) {
            i ?? (i = s);
            for (const e of s.keys) (a.has(e) || a.set(e, {}), (a.get(e).l = !0));
        } else e.issues.push(s);
    for (const s of n.issues)
        if ('unrecognized_keys' === s.code) for (const e of s.keys) (a.has(e) || a.set(e, {}), (a.get(e).r = !0));
        else e.issues.push(s);
    const o = [...a].filter(([, e]) => e.l && e.r).map(([e]) => e);
    if ((o.length && i && e.issues.push({ ...i, keys: o }), M(e))) return e;
    const r = Tt(t.value, n.value);
    if (!r.valid) throw new Error(`Unmergable intersection. Error path: ${JSON.stringify(r.mergeErrorPath)}`);
    return ((e.value = r.data), e);
}
const It = a('$ZodRecord', (e, t) => {
        (je.init(e, t),
            (e._zod.parse = (n, a) => {
                const i = n.value;
                if (!_(i)) return (n.issues.push({ expected: 'record', code: 'invalid_type', input: i, inst: e }), n);
                const o = [],
                    r = t.keyType._zod.values;
                if (r) {
                    n.value = {};
                    const s = new Set();
                    for (const e of r)
                        if ('string' == typeof e || 'number' == typeof e || 'symbol' == typeof e) {
                            s.add('number' == typeof e ? e.toString() : e);
                            const r = t.valueType._zod.run({ value: i[e], issues: [] }, a);
                            r instanceof Promise
                                ? o.push(
                                      r.then(t => {
                                          (t.issues.length && n.issues.push(...T(e, t.issues)), (n.value[e] = t.value));
                                      })
                                  )
                                : (r.issues.length && n.issues.push(...T(e, r.issues)), (n.value[e] = r.value));
                        }
                    let c;
                    for (const e in i) s.has(e) || ((c = c ?? []), c.push(e));
                    c && c.length > 0 && n.issues.push({ code: 'unrecognized_keys', input: i, inst: e, keys: c });
                } else {
                    n.value = {};
                    for (const r of Reflect.ownKeys(i)) {
                        if ('__proto__' === r) continue;
                        let c = t.keyType._zod.run({ value: r, issues: [] }, a);
                        if (c instanceof Promise)
                            throw new Error('Async schemas not supported in object keys currently');
                        if ('string' == typeof r && ve.test(r) && c.issues.length) {
                            const e = t.keyType._zod.run({ value: Number(r), issues: [] }, a);
                            if (e instanceof Promise)
                                throw new Error('Async schemas not supported in object keys currently');
                            0 === e.issues.length && (c = e);
                        }
                        if (c.issues.length) {
                            'loose' === t.mode
                                ? (n.value[r] = i[r])
                                : n.issues.push({
                                      code: 'invalid_key',
                                      origin: 'record',
                                      issues: c.issues.map(e => I(e, a, s())),
                                      input: r,
                                      path: [r],
                                      inst: e,
                                  });
                            continue;
                        }
                        const l = t.valueType._zod.run({ value: i[r], issues: [] }, a);
                        l instanceof Promise
                            ? o.push(
                                  l.then(e => {
                                      (e.issues.length && n.issues.push(...T(r, e.issues)),
                                          (n.value[c.value] = e.value));
                                  })
                              )
                            : (l.issues.length && n.issues.push(...T(r, l.issues)), (n.value[c.value] = l.value));
                    }
                }
                return o.length ? Promise.all(o).then(() => n) : n;
            }));
    }),
    Lt = a('$ZodEnum', (e, t) => {
        je.init(e, t);
        const n = c(t.entries),
            a = new Set(n);
        ((e._zod.values = a),
            (e._zod.pattern = new RegExp(
                `^(${n
                    .filter(e => x.has(typeof e))
                    .map(e => ('string' == typeof e ? E(e) : e.toString()))
                    .join('|')})$`
            )),
            (e._zod.parse = (t, i) => {
                const o = t.value;
                return (a.has(o) || t.issues.push({ code: 'invalid_value', values: n, input: o, inst: e }), t);
            }));
    }),
    zt = a('$ZodTransform', (e, t) => {
        (je.init(e, t),
            (e._zod.parse = (n, a) => {
                if ('backward' === a.direction) throw new o(e.constructor.name);
                const r = t.transform(n.value, n);
                if (a.async) {
                    return (r instanceof Promise ? r : Promise.resolve(r)).then(e => ((n.value = e), n));
                }
                if (r instanceof Promise) throw new i();
                return ((n.value = r), n);
            }));
    });
function Dt(e, t) {
    return e.issues.length && void 0 === t ? { issues: [], value: void 0 } : e;
}
const Ft = a('$ZodOptional', (e, t) => {
        (je.init(e, t),
            (e._zod.optin = 'optional'),
            (e._zod.optout = 'optional'),
            p(e._zod, 'values', () =>
                t.innerType._zod.values ? new Set([...t.innerType._zod.values, void 0]) : void 0
            ),
            p(e._zod, 'pattern', () => {
                const e = t.innerType._zod.pattern;
                return e ? new RegExp(`^(${h(e.source)})?$`) : void 0;
            }),
            (e._zod.parse = (e, n) => {
                if ('optional' === t.innerType._zod.optin) {
                    const a = t.innerType._zod.run(e, n);
                    return a instanceof Promise ? a.then(t => Dt(t, e.value)) : Dt(a, e.value);
                }
                return void 0 === e.value ? e : t.innerType._zod.run(e, n);
            }));
    }),
    Ot = a('$ZodExactOptional', (e, t) => {
        (Ft.init(e, t),
            p(e._zod, 'values', () => t.innerType._zod.values),
            p(e._zod, 'pattern', () => t.innerType._zod.pattern),
            (e._zod.parse = (e, n) => t.innerType._zod.run(e, n)));
    }),
    Rt = a('$ZodNullable', (e, t) => {
        (je.init(e, t),
            p(e._zod, 'optin', () => t.innerType._zod.optin),
            p(e._zod, 'optout', () => t.innerType._zod.optout),
            p(e._zod, 'pattern', () => {
                const e = t.innerType._zod.pattern;
                return e ? new RegExp(`^(${h(e.source)}|null)$`) : void 0;
            }),
            p(e._zod, 'values', () => (t.innerType._zod.values ? new Set([...t.innerType._zod.values, null]) : void 0)),
            (e._zod.parse = (e, n) => (null === e.value ? e : t.innerType._zod.run(e, n))));
    }),
    Pt = a('$ZodDefault', (e, t) => {
        (je.init(e, t),
            (e._zod.optin = 'optional'),
            p(e._zod, 'values', () => t.innerType._zod.values),
            (e._zod.parse = (e, n) => {
                if ('backward' === n.direction) return t.innerType._zod.run(e, n);
                if (void 0 === e.value) return ((e.value = t.defaultValue), e);
                const a = t.innerType._zod.run(e, n);
                return a instanceof Promise ? a.then(e => Nt(e, t)) : Nt(a, t);
            }));
    });
function Nt(e, t) {
    return (void 0 === e.value && (e.value = t.defaultValue), e);
}
const Bt = a('$ZodPrefault', (e, t) => {
        (je.init(e, t),
            (e._zod.optin = 'optional'),
            p(e._zod, 'values', () => t.innerType._zod.values),
            (e._zod.parse = (e, n) => (
                'backward' === n.direction || (void 0 === e.value && (e.value = t.defaultValue)),
                t.innerType._zod.run(e, n)
            )));
    }),
    jt = a('$ZodNonOptional', (e, t) => {
        (je.init(e, t),
            p(e._zod, 'values', () => {
                const e = t.innerType._zod.values;
                return e ? new Set([...e].filter(e => void 0 !== e)) : void 0;
            }),
            (e._zod.parse = (n, a) => {
                const i = t.innerType._zod.run(n, a);
                return i instanceof Promise ? i.then(t => qt(t, e)) : qt(i, e);
            }));
    });
function qt(e, t) {
    return (
        e.issues.length ||
            void 0 !== e.value ||
            e.issues.push({ code: 'invalid_type', expected: 'nonoptional', input: e.value, inst: t }),
        e
    );
}
const Ht = a('$ZodCatch', (e, t) => {
        (je.init(e, t),
            p(e._zod, 'optin', () => t.innerType._zod.optin),
            p(e._zod, 'optout', () => t.innerType._zod.optout),
            p(e._zod, 'values', () => t.innerType._zod.values),
            (e._zod.parse = (e, n) => {
                if ('backward' === n.direction) return t.innerType._zod.run(e, n);
                const a = t.innerType._zod.run(e, n);
                return a instanceof Promise
                    ? a.then(
                          a => (
                              (e.value = a.value),
                              a.issues.length &&
                                  ((e.value = t.catchValue({
                                      ...e,
                                      error: { issues: a.issues.map(e => I(e, n, s())) },
                                      input: e.value,
                                  })),
                                  (e.issues = [])),
                              e
                          )
                      )
                    : ((e.value = a.value),
                      a.issues.length &&
                          ((e.value = t.catchValue({
                              ...e,
                              error: { issues: a.issues.map(e => I(e, n, s())) },
                              input: e.value,
                          })),
                          (e.issues = [])),
                      e);
            }));
    }),
    Zt = a('$ZodPipe', (e, t) => {
        (je.init(e, t),
            p(e._zod, 'values', () => t.in._zod.values),
            p(e._zod, 'optin', () => t.in._zod.optin),
            p(e._zod, 'optout', () => t.out._zod.optout),
            p(e._zod, 'propValues', () => t.in._zod.propValues),
            (e._zod.parse = (e, n) => {
                if ('backward' === n.direction) {
                    const a = t.out._zod.run(e, n);
                    return a instanceof Promise ? a.then(e => Ut(e, t.in, n)) : Ut(a, t.in, n);
                }
                const a = t.in._zod.run(e, n);
                return a instanceof Promise ? a.then(e => Ut(e, t.out, n)) : Ut(a, t.out, n);
            }));
    });
function Ut(e, t, n) {
    return e.issues.length ? ((e.aborted = !0), e) : t._zod.run({ value: e.value, issues: e.issues }, n);
}
const Vt = a('$ZodReadonly', (e, t) => {
    (je.init(e, t),
        p(e._zod, 'propValues', () => t.innerType._zod.propValues),
        p(e._zod, 'values', () => t.innerType._zod.values),
        p(e._zod, 'optin', () => t.innerType?._zod?.optin),
        p(e._zod, 'optout', () => t.innerType?._zod?.optout),
        (e._zod.parse = (e, n) => {
            if ('backward' === n.direction) return t.innerType._zod.run(e, n);
            const a = t.innerType._zod.run(e, n);
            return a instanceof Promise ? a.then(Wt) : Wt(a);
        }));
});
function Wt(e) {
    return ((e.value = Object.freeze(e.value)), e);
}
const Jt = a('$ZodCustom', (e, t) => {
    (ke.init(e, t),
        je.init(e, t),
        (e._zod.parse = (e, t) => e),
        (e._zod.check = n => {
            const a = n.value,
                i = t.fn(a);
            if (i instanceof Promise) return i.then(t => Kt(t, n, a, e));
            Kt(i, n, a, e);
        }));
});
function Kt(e, t, n, a) {
    if (!e) {
        const e = {
            code: 'custom',
            input: n,
            inst: a,
            path: [...(a._zod.def.path ?? [])],
            continue: !a._zod.def.abort,
        };
        (a._zod.def.params && (e.params = a._zod.def.params), t.issues.push(z(e)));
    }
}
var Gt;
class Yt {
    constructor() {
        ((this._map = new WeakMap()), (this._idmap = new Map()));
    }
    add(e, ...t) {
        const n = t[0];
        return (this._map.set(e, n), n && 'object' == typeof n && 'id' in n && this._idmap.set(n.id, e), this);
    }
    clear() {
        return ((this._map = new WeakMap()), (this._idmap = new Map()), this);
    }
    remove(e) {
        const t = this._map.get(e);
        return (t && 'object' == typeof t && 'id' in t && this._idmap.delete(t.id), this._map.delete(e), this);
    }
    get(e) {
        const t = e._zod.parent;
        if (t) {
            const n = { ...(this.get(t) ?? {}) };
            delete n.id;
            const a = { ...n, ...this._map.get(e) };
            return Object.keys(a).length ? a : void 0;
        }
        return this._map.get(e);
    }
    has(e) {
        return this._map.has(e);
    }
}
(Gt = globalThis).__zod_globalRegistry ?? (Gt.__zod_globalRegistry = new Yt());
const Xt = globalThis.__zod_globalRegistry;
function Qt(e, t) {
    return new e({ type: 'string', ...C(t) });
}
function en(e, t) {
    return new e({ type: 'string', format: 'email', check: 'string_format', abort: !1, ...C(t) });
}
function tn(e, t) {
    return new e({ type: 'string', format: 'guid', check: 'string_format', abort: !1, ...C(t) });
}
function nn(e, t) {
    return new e({ type: 'string', format: 'uuid', check: 'string_format', abort: !1, ...C(t) });
}
function an(e, t) {
    return new e({ type: 'string', format: 'uuid', check: 'string_format', abort: !1, version: 'v4', ...C(t) });
}
function on(e, t) {
    return new e({ type: 'string', format: 'uuid', check: 'string_format', abort: !1, version: 'v6', ...C(t) });
}
function rn(e, t) {
    return new e({ type: 'string', format: 'uuid', check: 'string_format', abort: !1, version: 'v7', ...C(t) });
}
function sn(e, t) {
    return new e({ type: 'string', format: 'url', check: 'string_format', abort: !1, ...C(t) });
}
function cn(e, t) {
    return new e({ type: 'string', format: 'emoji', check: 'string_format', abort: !1, ...C(t) });
}
function ln(e, t) {
    return new e({ type: 'string', format: 'nanoid', check: 'string_format', abort: !1, ...C(t) });
}
function dn(e, t) {
    return new e({ type: 'string', format: 'cuid', check: 'string_format', abort: !1, ...C(t) });
}
function un(e, t) {
    return new e({ type: 'string', format: 'cuid2', check: 'string_format', abort: !1, ...C(t) });
}
function hn(e, t) {
    return new e({ type: 'string', format: 'ulid', check: 'string_format', abort: !1, ...C(t) });
}
function mn(e, t) {
    return new e({ type: 'string', format: 'xid', check: 'string_format', abort: !1, ...C(t) });
}
function pn(e, t) {
    return new e({ type: 'string', format: 'ksuid', check: 'string_format', abort: !1, ...C(t) });
}
function fn(e, t) {
    return new e({ type: 'string', format: 'ipv4', check: 'string_format', abort: !1, ...C(t) });
}
function gn(e, t) {
    return new e({ type: 'string', format: 'ipv6', check: 'string_format', abort: !1, ...C(t) });
}
function yn(e, t) {
    return new e({ type: 'string', format: 'cidrv4', check: 'string_format', abort: !1, ...C(t) });
}
function vn(e, t) {
    return new e({ type: 'string', format: 'cidrv6', check: 'string_format', abort: !1, ...C(t) });
}
function bn(e, t) {
    return new e({ type: 'string', format: 'base64', check: 'string_format', abort: !1, ...C(t) });
}
function wn(e, t) {
    return new e({ type: 'string', format: 'base64url', check: 'string_format', abort: !1, ...C(t) });
}
function _n(e, t) {
    return new e({ type: 'string', format: 'e164', check: 'string_format', abort: !1, ...C(t) });
}
function kn(e, t) {
    return new e({ type: 'string', format: 'jwt', check: 'string_format', abort: !1, ...C(t) });
}
function xn(e, t) {
    return new e({
        type: 'string',
        format: 'datetime',
        check: 'string_format',
        offset: !1,
        local: !1,
        precision: null,
        ...C(t),
    });
}
function En(e, t) {
    return new e({ type: 'string', format: 'date', check: 'string_format', ...C(t) });
}
function Sn(e, t) {
    return new e({ type: 'string', format: 'time', check: 'string_format', precision: null, ...C(t) });
}
function Cn(e, t) {
    return new e({ type: 'string', format: 'duration', check: 'string_format', ...C(t) });
}
function $n(e, t) {
    return new e({ type: 'number', checks: [], ...C(t) });
}
function Mn(e, t) {
    return new e({ type: 'number', check: 'number_format', abort: !1, format: 'safeint', ...C(t) });
}
function Tn(e, t) {
    return new e({ type: 'boolean', ...C(t) });
}
function An(e) {
    return new e({ type: 'unknown' });
}
function In(e, t) {
    return new e({ type: 'never', ...C(t) });
}
function Ln(e, t) {
    return new Ee({ check: 'less_than', ...C(t), value: e, inclusive: !1 });
}
function zn(e, t) {
    return new Ee({ check: 'less_than', ...C(t), value: e, inclusive: !0 });
}
function Dn(e, t) {
    return new Se({ check: 'greater_than', ...C(t), value: e, inclusive: !1 });
}
function Fn(e, t) {
    return new Se({ check: 'greater_than', ...C(t), value: e, inclusive: !0 });
}
function On(e, t) {
    return new Ce({ check: 'multiple_of', ...C(t), value: e });
}
function Rn(e, t) {
    return new Me({ check: 'max_length', ...C(t), maximum: e });
}
function Pn(e, t) {
    return new Te({ check: 'min_length', ...C(t), minimum: e });
}
function Nn(e, t) {
    return new Ae({ check: 'length_equals', ...C(t), length: e });
}
function Bn(e, t) {
    return new Le({ check: 'string_format', format: 'regex', ...C(t), pattern: e });
}
function jn(e) {
    return new ze({ check: 'string_format', format: 'lowercase', ...C(e) });
}
function qn(e) {
    return new De({ check: 'string_format', format: 'uppercase', ...C(e) });
}
function Hn(e, t) {
    return new Fe({ check: 'string_format', format: 'includes', ...C(t), includes: e });
}
function Zn(e, t) {
    return new Oe({ check: 'string_format', format: 'starts_with', ...C(t), prefix: e });
}
function Un(e, t) {
    return new Re({ check: 'string_format', format: 'ends_with', ...C(t), suffix: e });
}
function Vn(e) {
    return new Pe({ check: 'overwrite', tx: e });
}
function Wn(e) {
    return Vn(t => t.normalize(e));
}
function Jn() {
    return Vn(e => e.trim());
}
function Kn() {
    return Vn(e => e.toLowerCase());
}
function Gn() {
    return Vn(e => e.toUpperCase());
}
function Yn() {
    return Vn(e =>
        (function (e) {
            return e
                .toLowerCase()
                .trim()
                .replace(/[^\w\s-]/g, '')
                .replace(/[\s_-]+/g, '-')
                .replace(/^-+|-+$/g, '');
        })(e)
    );
}
function Xn(e, t, n) {
    return new e({ type: 'array', element: t, ...C(n) });
}
function Qn(e, t, n) {
    return new e({ type: 'custom', check: 'custom', fn: t, ...C(n) });
}
function ea(e) {
    const t = ta(
        n => (
            (n.addIssue = e => {
                if ('string' == typeof e) n.issues.push(z(e, n.value, t._zod.def));
                else {
                    const a = e;
                    (a.fatal && (a.continue = !1),
                        a.code ?? (a.code = 'custom'),
                        a.input ?? (a.input = n.value),
                        a.inst ?? (a.inst = t),
                        a.continue ?? (a.continue = !t._zod.def.abort),
                        n.issues.push(z(a)));
                }
            }),
            e(n.value, n)
        )
    );
    return t;
}
function ta(e, t) {
    const n = new ke({ check: 'custom', ...C(t) });
    return ((n._zod.check = e), n);
}
function na(e) {
    let t = e?.target ?? 'draft-2020-12';
    return (
        'draft-4' === t && (t = 'draft-04'),
        'draft-7' === t && (t = 'draft-07'),
        {
            processors: e.processors ?? {},
            metadataRegistry: e?.metadata ?? Xt,
            target: t,
            unrepresentable: e?.unrepresentable ?? 'throw',
            override: e?.override ?? (() => {}),
            io: e?.io ?? 'output',
            counter: 0,
            seen: new Map(),
            cycles: e?.cycles ?? 'ref',
            reused: e?.reused ?? 'inline',
            external: e?.external ?? void 0,
        }
    );
}
function aa(e, t, n = { path: [], schemaPath: [] }) {
    var a;
    const i = e._zod.def,
        o = t.seen.get(e);
    if (o) {
        o.count++;
        return (n.schemaPath.includes(e) && (o.cycle = n.path), o.schema);
    }
    const r = { schema: {}, count: 1, cycle: void 0, path: n.path };
    t.seen.set(e, r);
    const s = e._zod.toJSONSchema?.();
    if (s) r.schema = s;
    else {
        const a = { ...n, schemaPath: [...n.schemaPath, e], path: n.path };
        if (e._zod.processJSONSchema) e._zod.processJSONSchema(t, r.schema, a);
        else {
            const n = r.schema,
                o = t.processors[i.type];
            if (!o) throw new Error(`[toJSONSchema]: Non-representable type encountered: ${i.type}`);
            o(e, t, n, a);
        }
        const o = e._zod.parent;
        o && (r.ref || (r.ref = o), aa(o, t, a), (t.seen.get(o).isParent = !0));
    }
    const c = t.metadataRegistry.get(e);
    (c && Object.assign(r.schema, c),
        'input' === t.io && ra(e) && (delete r.schema.examples, delete r.schema.default),
        'input' === t.io && r.schema._prefault && ((a = r.schema).default ?? (a.default = r.schema._prefault)),
        delete r.schema._prefault);
    return t.seen.get(e).schema;
}
function ia(e, t) {
    const n = e.seen.get(t);
    if (!n) throw new Error('Unprocessed schema. This is a bug in Zod.');
    const a = new Map();
    for (const o of e.seen.entries()) {
        const t = e.metadataRegistry.get(o[0])?.id;
        if (t) {
            const e = a.get(t);
            if (e && e !== o[0])
                throw new Error(
                    `Duplicate schema id "${t}" detected during JSON Schema conversion. Two different schemas cannot share the same id when converted together.`
                );
            a.set(t, o[0]);
        }
    }
    const i = t => {
        if (t[1].schema.$ref) return;
        const a = t[1],
            { ref: i, defId: o } = (t => {
                const a = 'draft-2020-12' === e.target ? '$defs' : 'definitions';
                if (e.external) {
                    const n = e.external.registry.get(t[0])?.id,
                        i = e.external.uri ?? (e => e);
                    if (n) return { ref: i(n) };
                    const o = t[1].defId ?? t[1].schema.id ?? 'schema' + e.counter++;
                    return ((t[1].defId = o), { defId: o, ref: `${i('__shared')}#/${a}/${o}` });
                }
                if (t[1] === n) return { ref: '#' };
                const i = `#/${a}/`,
                    o = t[1].schema.id ?? '__schema' + e.counter++;
                return { defId: o, ref: i + o };
            })(t);
        ((a.def = { ...a.schema }), o && (a.defId = o));
        const r = a.schema;
        for (const e in r) delete r[e];
        r.$ref = i;
    };
    if ('throw' === e.cycles)
        for (const o of e.seen.entries()) {
            const e = o[1];
            if (e.cycle)
                throw new Error(
                    `Cycle detected: #/${e.cycle?.join('/')}/<root>\n\nSet the \`cycles\` parameter to \`"ref"\` to resolve cyclical schemas with defs.`
                );
        }
    for (const o of e.seen.entries()) {
        const n = o[1];
        if (t === o[0]) {
            i(o);
            continue;
        }
        if (e.external) {
            const n = e.external.registry.get(o[0])?.id;
            if (t !== o[0] && n) {
                i(o);
                continue;
            }
        }
        const a = e.metadataRegistry.get(o[0])?.id;
        a ? i(o) : (n.cycle || (n.count > 1 && 'ref' === e.reused)) && i(o);
    }
}
function oa(e, t) {
    const n = e.seen.get(t);
    if (!n) throw new Error('Unprocessed schema. This is a bug in Zod.');
    const a = t => {
        const n = e.seen.get(t);
        if (null === n.ref) return;
        const i = n.def ?? n.schema,
            o = { ...i },
            r = n.ref;
        if (((n.ref = null), r)) {
            a(r);
            const n = e.seen.get(r),
                s = n.schema;
            (!s.$ref || ('draft-07' !== e.target && 'draft-04' !== e.target && 'openapi-3.0' !== e.target)
                ? Object.assign(i, s)
                : ((i.allOf = i.allOf ?? []), i.allOf.push(s)),
                Object.assign(i, o));
            if (t._zod.parent === r) for (const e in i) '$ref' !== e && 'allOf' !== e && (e in o || delete i[e]);
            if (s.$ref && n.def)
                for (const e in i)
                    '$ref' !== e &&
                        'allOf' !== e &&
                        e in n.def &&
                        JSON.stringify(i[e]) === JSON.stringify(n.def[e]) &&
                        delete i[e];
        }
        const s = t._zod.parent;
        if (s && s !== r) {
            a(s);
            const t = e.seen.get(s);
            if (t?.schema.$ref && ((i.$ref = t.schema.$ref), t.def))
                for (const e in i)
                    '$ref' !== e &&
                        'allOf' !== e &&
                        e in t.def &&
                        JSON.stringify(i[e]) === JSON.stringify(t.def[e]) &&
                        delete i[e];
        }
        e.override({ zodSchema: t, jsonSchema: i, path: n.path ?? [] });
    };
    for (const s of [...e.seen.entries()].reverse()) a(s[0]);
    const i = {};
    if (
        ('draft-2020-12' === e.target
            ? (i.$schema = 'https://json-schema.org/draft/2020-12/schema')
            : 'draft-07' === e.target
              ? (i.$schema = 'http://json-schema.org/draft-07/schema#')
              : 'draft-04' === e.target
                ? (i.$schema = 'http://json-schema.org/draft-04/schema#')
                : e.target,
        e.external?.uri)
    ) {
        const n = e.external.registry.get(t)?.id;
        if (!n) throw new Error('Schema is missing an `id` property');
        i.$id = e.external.uri(n);
    }
    Object.assign(i, n.def ?? n.schema);
    const o = e.external?.defs ?? {};
    for (const s of e.seen.entries()) {
        const e = s[1];
        e.def && e.defId && (o[e.defId] = e.def);
    }
    e.external || (Object.keys(o).length > 0 && ('draft-2020-12' === e.target ? (i.$defs = o) : (i.definitions = o)));
    try {
        const n = JSON.parse(JSON.stringify(i));
        return (
            Object.defineProperty(n, '~standard', {
                value: {
                    ...t['~standard'],
                    jsonSchema: { input: sa(t, 'input', e.processors), output: sa(t, 'output', e.processors) },
                },
                enumerable: !1,
                writable: !1,
            }),
            n
        );
    } catch (r) {
        throw new Error('Error converting schema to JSON.');
    }
}
function ra(e, t) {
    const n = t ?? { seen: new Set() };
    if (n.seen.has(e)) return !1;
    n.seen.add(e);
    const a = e._zod.def;
    if ('transform' === a.type) return !0;
    if ('array' === a.type) return ra(a.element, n);
    if ('set' === a.type) return ra(a.valueType, n);
    if ('lazy' === a.type) return ra(a.getter(), n);
    if (
        'promise' === a.type ||
        'optional' === a.type ||
        'nonoptional' === a.type ||
        'nullable' === a.type ||
        'readonly' === a.type ||
        'default' === a.type ||
        'prefault' === a.type
    )
        return ra(a.innerType, n);
    if ('intersection' === a.type) return ra(a.left, n) || ra(a.right, n);
    if ('record' === a.type || 'map' === a.type) return ra(a.keyType, n) || ra(a.valueType, n);
    if ('pipe' === a.type) return ra(a.in, n) || ra(a.out, n);
    if ('object' === a.type) {
        for (const e in a.shape) if (ra(a.shape[e], n)) return !0;
        return !1;
    }
    if ('union' === a.type) {
        for (const e of a.options) if (ra(e, n)) return !0;
        return !1;
    }
    if ('tuple' === a.type) {
        for (const e of a.items) if (ra(e, n)) return !0;
        return !(!a.rest || !ra(a.rest, n));
    }
    return !1;
}
const sa =
        (e, t, n = {}) =>
        a => {
            const { libraryOptions: i, target: o } = a ?? {},
                r = na({ ...(i ?? {}), target: o, io: t, processors: n });
            return (aa(e, r), ia(r, e), oa(r, e));
        },
    ca = { guid: 'uuid', url: 'uri', datetime: 'date-time', json_string: 'json-string', regex: '' },
    la = (e, t, n, a) => {
        const i = e._zod.def;
        aa(i.innerType, t, a);
        t.seen.get(e).ref = i.innerType;
    },
    da = a('ZodISODateTime', (e, t) => {
        (tt.init(e, t), za.init(e, t));
    });
const ua = a('ZodISODate', (e, t) => {
    (nt.init(e, t), za.init(e, t));
});
const ha = a('ZodISOTime', (e, t) => {
    (at.init(e, t), za.init(e, t));
});
const ma = a('ZodISODuration', (e, t) => {
    (it.init(e, t), za.init(e, t));
});
const pa = (e, t) => {
        (F.init(e, t),
            (e.name = 'ZodError'),
            Object.defineProperties(e, {
                format: {
                    value: t =>
                        (function (e, t = e => e.message) {
                            const n = { _errors: [] },
                                a = e => {
                                    for (const i of e.issues)
                                        if ('invalid_union' === i.code && i.errors.length)
                                            i.errors.map(e => a({ issues: e }));
                                        else if ('invalid_key' === i.code) a({ issues: i.issues });
                                        else if ('invalid_element' === i.code) a({ issues: i.issues });
                                        else if (0 === i.path.length) n._errors.push(t(i));
                                        else {
                                            let e = n,
                                                a = 0;
                                            for (; a < i.path.length; ) {
                                                const n = i.path[a];
                                                (a === i.path.length - 1
                                                    ? ((e[n] = e[n] || { _errors: [] }), e[n]._errors.push(t(i)))
                                                    : (e[n] = e[n] || { _errors: [] }),
                                                    (e = e[n]),
                                                    a++);
                                            }
                                        }
                                };
                            return (a(e), n);
                        })(e, t),
                },
                flatten: {
                    value: t =>
                        (function (e, t = e => e.message) {
                            const n = {},
                                a = [];
                            for (const i of e.issues)
                                i.path.length > 0
                                    ? ((n[i.path[0]] = n[i.path[0]] || []), n[i.path[0]].push(t(i)))
                                    : a.push(t(i));
                            return { formErrors: a, fieldErrors: n };
                        })(e, t),
                },
                addIssue: {
                    value: t => {
                        (e.issues.push(t), (e.message = JSON.stringify(e.issues, l, 2)));
                    },
                },
                addIssues: {
                    value: t => {
                        (e.issues.push(...t), (e.message = JSON.stringify(e.issues, l, 2)));
                    },
                },
                isEmpty: { get: () => 0 === e.issues.length },
            }));
    },
    fa = a('ZodError', pa),
    ga = a('ZodError', pa, { Parent: Error }),
    ya = R(ga),
    va = P(ga),
    ba = N(ga),
    wa = j(ga),
    _a = H(ga),
    ka = Z(ga),
    xa = U(ga),
    Ea = V(ga),
    Sa = W(ga),
    Ca = J(ga),
    $a = K(ga),
    Ma = G(ga),
    Ta = a(
        'ZodType',
        (e, t) => (
            je.init(e, t),
            Object.assign(e['~standard'], { jsonSchema: { input: sa(e, 'input'), output: sa(e, 'output') } }),
            (e.toJSONSchema = (
                (e, t = {}) =>
                n => {
                    const a = na({ ...n, processors: t });
                    return (aa(e, a), ia(a, e), oa(a, e));
                }
            )(e, {})),
            (e.def = t),
            (e.type = t.type),
            Object.defineProperty(e, '_def', { value: t }),
            (e.check = (...n) =>
                e.clone(
                    g(t, {
                        checks: [
                            ...(t.checks ?? []),
                            ...n.map(e =>
                                'function' == typeof e
                                    ? { _zod: { check: e, def: { check: 'custom' }, onattach: [] } }
                                    : e
                            ),
                        ],
                    }),
                    { parent: !0 }
                )),
            (e.with = e.check),
            (e.clone = (t, n) => S(e, t, n)),
            (e.brand = () => e),
            (e.register = (t, n) => (t.add(e, n), e)),
            (e.parse = (t, n) => ya(e, t, n, { callee: e.parse })),
            (e.safeParse = (t, n) => ba(e, t, n)),
            (e.parseAsync = async (t, n) => va(e, t, n, { callee: e.parseAsync })),
            (e.safeParseAsync = async (t, n) => wa(e, t, n)),
            (e.spa = e.safeParseAsync),
            (e.encode = (t, n) => _a(e, t, n)),
            (e.decode = (t, n) => ka(e, t, n)),
            (e.encodeAsync = async (t, n) => xa(e, t, n)),
            (e.decodeAsync = async (t, n) => Ea(e, t, n)),
            (e.safeEncode = (t, n) => Sa(e, t, n)),
            (e.safeDecode = (t, n) => Ca(e, t, n)),
            (e.safeEncodeAsync = async (t, n) => $a(e, t, n)),
            (e.safeDecodeAsync = async (t, n) => Ma(e, t, n)),
            (e.refine = (t, n) =>
                e.check(
                    (function (e, t = {}) {
                        return Qn(Ii, e, t);
                    })(t, n)
                )),
            (e.superRefine = t => e.check(ea(t))),
            (e.overwrite = t => e.check(Vn(t))),
            (e.optional = () => wi(e)),
            (e.exactOptional = () => new _i({ type: 'optional', innerType: e })),
            (e.nullable = () => xi(e)),
            (e.nullish = () => wi(xi(e))),
            (e.nonoptional = t =>
                (function (e, t) {
                    return new Ci({ type: 'nonoptional', innerType: e, ...C(t) });
                })(e, t)),
            (e.array = () => li(e)),
            (e.or = t => {
                return new hi({ type: 'union', options: [e, t], ...C(n) });
                var n;
            }),
            (e.and = t => new mi({ type: 'intersection', left: e, right: t })),
            (e.transform = t => Ti(e, new vi({ type: 'transform', transform: t }))),
            (e.default = t => {
                return (
                    (n = t),
                    new Ei({
                        type: 'default',
                        innerType: e,
                        get defaultValue() {
                            return 'function' == typeof n ? n() : k(n);
                        },
                    })
                );
                var n;
            }),
            (e.prefault = t => {
                return (
                    (n = t),
                    new Si({
                        type: 'prefault',
                        innerType: e,
                        get defaultValue() {
                            return 'function' == typeof n ? n() : k(n);
                        },
                    })
                );
                var n;
            }),
            (e.catch = t => {
                return new $i({ type: 'catch', innerType: e, catchValue: 'function' == typeof (n = t) ? n : () => n });
                var n;
            }),
            (e.pipe = t => Ti(e, t)),
            (e.readonly = () => new Ai({ type: 'readonly', innerType: e })),
            (e.describe = t => {
                const n = e.clone();
                return (Xt.add(n, { description: t }), n);
            }),
            Object.defineProperty(e, 'description', { get: () => Xt.get(e)?.description, configurable: !0 }),
            (e.meta = (...t) => {
                if (0 === t.length) return Xt.get(e);
                const n = e.clone();
                return (Xt.add(n, t[0]), n);
            }),
            (e.isOptional = () => e.safeParse(void 0).success),
            (e.isNullable = () => e.safeParse(null).success),
            (e.apply = t => t(e)),
            e
        )
    ),
    Aa = a('_ZodString', (e, t) => {
        (qe.init(e, t),
            Ta.init(e, t),
            (e._zod.processJSONSchema = (t, n, a) =>
                ((e, t, n) => {
                    const a = n;
                    a.type = 'string';
                    const { minimum: i, maximum: o, format: r, patterns: s, contentEncoding: c } = e._zod.bag;
                    if (
                        ('number' == typeof i && (a.minLength = i),
                        'number' == typeof o && (a.maxLength = o),
                        r &&
                            ((a.format = ca[r] ?? r),
                            '' === a.format && delete a.format,
                            'time' === r && delete a.format),
                        c && (a.contentEncoding = c),
                        s && s.size > 0)
                    ) {
                        const e = [...s];
                        1 === e.length
                            ? (a.pattern = e[0].source)
                            : e.length > 1 &&
                              (a.allOf = [
                                  ...e.map(e => ({
                                      ...('draft-07' === t.target ||
                                      'draft-04' === t.target ||
                                      'openapi-3.0' === t.target
                                          ? { type: 'string' }
                                          : {}),
                                      pattern: e.source,
                                  })),
                              ]);
                    }
                })(e, t, n)));
        const n = e._zod.bag;
        ((e.format = n.format ?? null),
            (e.minLength = n.minimum ?? null),
            (e.maxLength = n.maximum ?? null),
            (e.regex = (...t) => e.check(Bn(...t))),
            (e.includes = (...t) => e.check(Hn(...t))),
            (e.startsWith = (...t) => e.check(Zn(...t))),
            (e.endsWith = (...t) => e.check(Un(...t))),
            (e.min = (...t) => e.check(Pn(...t))),
            (e.max = (...t) => e.check(Rn(...t))),
            (e.length = (...t) => e.check(Nn(...t))),
            (e.nonempty = (...t) => e.check(Pn(1, ...t))),
            (e.lowercase = t => e.check(jn(t))),
            (e.uppercase = t => e.check(qn(t))),
            (e.trim = () => e.check(Jn())),
            (e.normalize = (...t) => e.check(Wn(...t))),
            (e.toLowerCase = () => e.check(Kn())),
            (e.toUpperCase = () => e.check(Gn())),
            (e.slugify = () => e.check(Yn())));
    }),
    Ia = a('ZodString', (e, t) => {
        (qe.init(e, t),
            Aa.init(e, t),
            (e.email = t => e.check(en(Da, t))),
            (e.url = t => e.check(sn(Ra, t))),
            (e.jwt = t => e.check(kn(Xa, t))),
            (e.emoji = t => e.check(cn(Pa, t))),
            (e.guid = t => e.check(tn(Fa, t))),
            (e.uuid = t => e.check(nn(Oa, t))),
            (e.uuidv4 = t => e.check(an(Oa, t))),
            (e.uuidv6 = t => e.check(on(Oa, t))),
            (e.uuidv7 = t => e.check(rn(Oa, t))),
            (e.nanoid = t => e.check(ln(Na, t))),
            (e.guid = t => e.check(tn(Fa, t))),
            (e.cuid = t => e.check(dn(Ba, t))),
            (e.cuid2 = t => e.check(un(ja, t))),
            (e.ulid = t => e.check(hn(qa, t))),
            (e.base64 = t => e.check(bn(Ka, t))),
            (e.base64url = t => e.check(wn(Ga, t))),
            (e.xid = t => e.check(mn(Ha, t))),
            (e.ksuid = t => e.check(pn(Za, t))),
            (e.ipv4 = t => e.check(fn(Ua, t))),
            (e.ipv6 = t => e.check(gn(Va, t))),
            (e.cidrv4 = t => e.check(yn(Wa, t))),
            (e.cidrv6 = t => e.check(vn(Ja, t))),
            (e.e164 = t => e.check(_n(Ya, t))),
            (e.datetime = t =>
                e.check(
                    (function (e) {
                        return xn(da, e);
                    })(t)
                )),
            (e.date = t =>
                e.check(
                    (function (e) {
                        return En(ua, e);
                    })(t)
                )),
            (e.time = t =>
                e.check(
                    (function (e) {
                        return Sn(ha, e);
                    })(t)
                )),
            (e.duration = t =>
                e.check(
                    (function (e) {
                        return Cn(ma, e);
                    })(t)
                )));
    });
function La(e) {
    return Qt(Ia, e);
}
const za = a('ZodStringFormat', (e, t) => {
        (He.init(e, t), Aa.init(e, t));
    }),
    Da = a('ZodEmail', (e, t) => {
        (Ve.init(e, t), za.init(e, t));
    }),
    Fa = a('ZodGUID', (e, t) => {
        (Ze.init(e, t), za.init(e, t));
    }),
    Oa = a('ZodUUID', (e, t) => {
        (Ue.init(e, t), za.init(e, t));
    }),
    Ra = a('ZodURL', (e, t) => {
        (We.init(e, t), za.init(e, t));
    }),
    Pa = a('ZodEmoji', (e, t) => {
        (Je.init(e, t), za.init(e, t));
    }),
    Na = a('ZodNanoID', (e, t) => {
        (Ke.init(e, t), za.init(e, t));
    }),
    Ba = a('ZodCUID', (e, t) => {
        (Ge.init(e, t), za.init(e, t));
    }),
    ja = a('ZodCUID2', (e, t) => {
        (Ye.init(e, t), za.init(e, t));
    }),
    qa = a('ZodULID', (e, t) => {
        (Xe.init(e, t), za.init(e, t));
    }),
    Ha = a('ZodXID', (e, t) => {
        (Qe.init(e, t), za.init(e, t));
    }),
    Za = a('ZodKSUID', (e, t) => {
        (et.init(e, t), za.init(e, t));
    }),
    Ua = a('ZodIPv4', (e, t) => {
        (ot.init(e, t), za.init(e, t));
    }),
    Va = a('ZodIPv6', (e, t) => {
        (rt.init(e, t), za.init(e, t));
    }),
    Wa = a('ZodCIDRv4', (e, t) => {
        (st.init(e, t), za.init(e, t));
    }),
    Ja = a('ZodCIDRv6', (e, t) => {
        (ct.init(e, t), za.init(e, t));
    }),
    Ka = a('ZodBase64', (e, t) => {
        (dt.init(e, t), za.init(e, t));
    }),
    Ga = a('ZodBase64URL', (e, t) => {
        (ut.init(e, t), za.init(e, t));
    }),
    Ya = a('ZodE164', (e, t) => {
        (ht.init(e, t), za.init(e, t));
    }),
    Xa = a('ZodJWT', (e, t) => {
        (mt.init(e, t), za.init(e, t));
    }),
    Qa = a('ZodNumber', (e, t) => {
        (pt.init(e, t),
            Ta.init(e, t),
            (e._zod.processJSONSchema = (t, n, a) =>
                ((e, t, n) => {
                    const a = n,
                        {
                            minimum: i,
                            maximum: o,
                            format: r,
                            multipleOf: s,
                            exclusiveMaximum: c,
                            exclusiveMinimum: l,
                        } = e._zod.bag;
                    ('string' == typeof r && r.includes('int') ? (a.type = 'integer') : (a.type = 'number'),
                        'number' == typeof l &&
                            ('draft-04' === t.target || 'openapi-3.0' === t.target
                                ? ((a.minimum = l), (a.exclusiveMinimum = !0))
                                : (a.exclusiveMinimum = l)),
                        'number' == typeof i &&
                            ((a.minimum = i),
                            'number' == typeof l &&
                                'draft-04' !== t.target &&
                                (l >= i ? delete a.minimum : delete a.exclusiveMinimum)),
                        'number' == typeof c &&
                            ('draft-04' === t.target || 'openapi-3.0' === t.target
                                ? ((a.maximum = c), (a.exclusiveMaximum = !0))
                                : (a.exclusiveMaximum = c)),
                        'number' == typeof o &&
                            ((a.maximum = o),
                            'number' == typeof c &&
                                'draft-04' !== t.target &&
                                (c <= o ? delete a.maximum : delete a.exclusiveMaximum)),
                        'number' == typeof s && (a.multipleOf = s));
                })(e, t, n)),
            (e.gt = (t, n) => e.check(Dn(t, n))),
            (e.gte = (t, n) => e.check(Fn(t, n))),
            (e.min = (t, n) => e.check(Fn(t, n))),
            (e.lt = (t, n) => e.check(Ln(t, n))),
            (e.lte = (t, n) => e.check(zn(t, n))),
            (e.max = (t, n) => e.check(zn(t, n))),
            (e.int = t => e.check(ni(t))),
            (e.safe = t => e.check(ni(t))),
            (e.positive = t => e.check(Dn(0, t))),
            (e.nonnegative = t => e.check(Fn(0, t))),
            (e.negative = t => e.check(Ln(0, t))),
            (e.nonpositive = t => e.check(zn(0, t))),
            (e.multipleOf = (t, n) => e.check(On(t, n))),
            (e.step = (t, n) => e.check(On(t, n))),
            (e.finite = () => e));
        const n = e._zod.bag;
        ((e.minValue =
            Math.max(n.minimum ?? Number.NEGATIVE_INFINITY, n.exclusiveMinimum ?? Number.NEGATIVE_INFINITY) ?? null),
            (e.maxValue =
                Math.min(n.maximum ?? Number.POSITIVE_INFINITY, n.exclusiveMaximum ?? Number.POSITIVE_INFINITY) ??
                null),
            (e.isInt = (n.format ?? '').includes('int') || Number.isSafeInteger(n.multipleOf ?? 0.5)),
            (e.isFinite = !0),
            (e.format = n.format ?? null));
    });
function ei(e) {
    return $n(Qa, e);
}
const ti = a('ZodNumberFormat', (e, t) => {
    (ft.init(e, t), Qa.init(e, t));
});
function ni(e) {
    return Mn(ti, e);
}
const ai = a('ZodBoolean', (e, t) => {
    (gt.init(e, t),
        Ta.init(e, t),
        (e._zod.processJSONSchema = (e, t, n) =>
            ((e, t, n) => {
                n.type = 'boolean';
            })(0, 0, t)));
});
function ii(e) {
    return Tn(ai, e);
}
const oi = a('ZodUnknown', (e, t) => {
    (yt.init(e, t), Ta.init(e, t), (e._zod.processJSONSchema = (e, t, n) => {}));
});
function ri() {
    return An(oi);
}
const si = a('ZodNever', (e, t) => {
    (vt.init(e, t),
        Ta.init(e, t),
        (e._zod.processJSONSchema = (e, t, n) =>
            ((e, t, n) => {
                n.not = {};
            })(0, 0, t)));
});
const ci = a('ZodArray', (e, t) => {
    (wt.init(e, t),
        Ta.init(e, t),
        (e._zod.processJSONSchema = (t, n, a) =>
            ((e, t, n, a) => {
                const i = n,
                    o = e._zod.def,
                    { minimum: r, maximum: s } = e._zod.bag;
                ('number' == typeof r && (i.minItems = r),
                    'number' == typeof s && (i.maxItems = s),
                    (i.type = 'array'),
                    (i.items = aa(o.element, t, { ...a, path: [...a.path, 'items'] })));
            })(e, t, n, a)),
        (e.element = t.element),
        (e.min = (t, n) => e.check(Pn(t, n))),
        (e.nonempty = t => e.check(Pn(1, t))),
        (e.max = (t, n) => e.check(Rn(t, n))),
        (e.length = (t, n) => e.check(Nn(t, n))),
        (e.unwrap = () => e.element));
});
function li(e, t) {
    return Xn(ci, e, t);
}
const di = a('ZodObject', (e, t) => {
    (St.init(e, t),
        Ta.init(e, t),
        (e._zod.processJSONSchema = (t, n, a) =>
            ((e, t, n, a) => {
                const i = n,
                    o = e._zod.def;
                ((i.type = 'object'), (i.properties = {}));
                const r = o.shape;
                for (const l in r) i.properties[l] = aa(r[l], t, { ...a, path: [...a.path, 'properties', l] });
                const s = new Set(Object.keys(r)),
                    c = new Set(
                        [...s].filter(e => {
                            const n = o.shape[e]._zod;
                            return 'input' === t.io ? void 0 === n.optin : void 0 === n.optout;
                        })
                    );
                (c.size > 0 && (i.required = Array.from(c)),
                    'never' === o.catchall?._zod.def.type
                        ? (i.additionalProperties = !1)
                        : o.catchall
                          ? o.catchall &&
                            (i.additionalProperties = aa(o.catchall, t, {
                                ...a,
                                path: [...a.path, 'additionalProperties'],
                            }))
                          : 'output' === t.io && (i.additionalProperties = !1));
            })(e, t, n, a)),
        p(e, 'shape', () => t.shape),
        (e.keyof = () => yi(Object.keys(e._zod.def.shape))),
        (e.catchall = t => e.clone({ ...e._zod.def, catchall: t })),
        (e.passthrough = () => e.clone({ ...e._zod.def, catchall: ri() })),
        (e.loose = () => e.clone({ ...e._zod.def, catchall: ri() })),
        (e.strict = () => {
            return e.clone({ ...e._zod.def, catchall: In(si, t) });
            var t;
        }),
        (e.strip = () => e.clone({ ...e._zod.def, catchall: void 0 })),
        (e.extend = t =>
            (function (e, t) {
                if (!_(t)) throw new Error('Invalid input to extend: expected a plain object');
                const n = e._zod.def.checks;
                if (n && n.length > 0) {
                    const n = e._zod.def.shape;
                    for (const e in t)
                        if (void 0 !== Object.getOwnPropertyDescriptor(n, e))
                            throw new Error(
                                'Cannot overwrite keys on object schemas containing refinements. Use `.safeExtend()` instead.'
                            );
                }
                const a = g(e._zod.def, {
                    get shape() {
                        const n = { ...e._zod.def.shape, ...t };
                        return (f(this, 'shape', n), n);
                    },
                });
                return S(e, a);
            })(e, t)),
        (e.safeExtend = t =>
            (function (e, t) {
                if (!_(t)) throw new Error('Invalid input to safeExtend: expected a plain object');
                const n = g(e._zod.def, {
                    get shape() {
                        const n = { ...e._zod.def.shape, ...t };
                        return (f(this, 'shape', n), n);
                    },
                });
                return S(e, n);
            })(e, t)),
        (e.merge = t =>
            (function (e, t) {
                const n = g(e._zod.def, {
                    get shape() {
                        const n = { ...e._zod.def.shape, ...t._zod.def.shape };
                        return (f(this, 'shape', n), n);
                    },
                    get catchall() {
                        return t._zod.def.catchall;
                    },
                    checks: [],
                });
                return S(e, n);
            })(e, t)),
        (e.pick = t =>
            (function (e, t) {
                const n = e._zod.def,
                    a = n.checks;
                if (a && a.length > 0)
                    throw new Error('.pick() cannot be used on object schemas containing refinements');
                return S(
                    e,
                    g(e._zod.def, {
                        get shape() {
                            const e = {};
                            for (const a in t) {
                                if (!(a in n.shape)) throw new Error(`Unrecognized key: "${a}"`);
                                t[a] && (e[a] = n.shape[a]);
                            }
                            return (f(this, 'shape', e), e);
                        },
                        checks: [],
                    })
                );
            })(e, t)),
        (e.omit = t =>
            (function (e, t) {
                const n = e._zod.def,
                    a = n.checks;
                if (a && a.length > 0)
                    throw new Error('.omit() cannot be used on object schemas containing refinements');
                const i = g(e._zod.def, {
                    get shape() {
                        const a = { ...e._zod.def.shape };
                        for (const e in t) {
                            if (!(e in n.shape)) throw new Error(`Unrecognized key: "${e}"`);
                            t[e] && delete a[e];
                        }
                        return (f(this, 'shape', a), a);
                    },
                    checks: [],
                });
                return S(e, i);
            })(e, t)),
        (e.partial = (...t) =>
            (function (e, t, n) {
                const a = t._zod.def.checks;
                if (a && a.length > 0)
                    throw new Error('.partial() cannot be used on object schemas containing refinements');
                const i = g(t._zod.def, {
                    get shape() {
                        const a = t._zod.def.shape,
                            i = { ...a };
                        if (n)
                            for (const t in n) {
                                if (!(t in a)) throw new Error(`Unrecognized key: "${t}"`);
                                n[t] && (i[t] = e ? new e({ type: 'optional', innerType: a[t] }) : a[t]);
                            }
                        else for (const t in a) i[t] = e ? new e({ type: 'optional', innerType: a[t] }) : a[t];
                        return (f(this, 'shape', i), i);
                    },
                    checks: [],
                });
                return S(t, i);
            })(bi, e, t[0])),
        (e.required = (...t) =>
            (function (e, t, n) {
                const a = g(t._zod.def, {
                    get shape() {
                        const a = t._zod.def.shape,
                            i = { ...a };
                        if (n)
                            for (const t in n) {
                                if (!(t in i)) throw new Error(`Unrecognized key: "${t}"`);
                                n[t] && (i[t] = new e({ type: 'nonoptional', innerType: a[t] }));
                            }
                        else for (const t in a) i[t] = new e({ type: 'nonoptional', innerType: a[t] });
                        return (f(this, 'shape', i), i);
                    },
                });
                return S(t, a);
            })(Ci, e, t[0])));
});
function ui(e, t) {
    const n = { type: 'object', shape: e ?? {}, ...C(t) };
    return new di(n);
}
const hi = a('ZodUnion', (e, t) => {
    ($t.init(e, t),
        Ta.init(e, t),
        (e._zod.processJSONSchema = (t, n, a) =>
            ((e, t, n, a) => {
                const i = e._zod.def,
                    o = !1 === i.inclusive,
                    r = i.options.map((e, n) => aa(e, t, { ...a, path: [...a.path, o ? 'oneOf' : 'anyOf', n] }));
                o ? (n.oneOf = r) : (n.anyOf = r);
            })(e, t, n, a)),
        (e.options = t.options));
});
const mi = a('ZodIntersection', (e, t) => {
    (Mt.init(e, t),
        Ta.init(e, t),
        (e._zod.processJSONSchema = (t, n, a) =>
            ((e, t, n, a) => {
                const i = e._zod.def,
                    o = aa(i.left, t, { ...a, path: [...a.path, 'allOf', 0] }),
                    r = aa(i.right, t, { ...a, path: [...a.path, 'allOf', 1] }),
                    s = e => 'allOf' in e && 1 === Object.keys(e).length,
                    c = [...(s(o) ? o.allOf : [o]), ...(s(r) ? r.allOf : [r])];
                n.allOf = c;
            })(e, t, n, a)));
});
const pi = a('ZodRecord', (e, t) => {
    (It.init(e, t),
        Ta.init(e, t),
        (e._zod.processJSONSchema = (t, n, a) =>
            ((e, t, n, a) => {
                const i = n,
                    o = e._zod.def;
                i.type = 'object';
                const r = o.keyType,
                    s = r._zod.bag,
                    c = s?.patterns;
                if ('loose' === o.mode && c && c.size > 0) {
                    const e = aa(o.valueType, t, { ...a, path: [...a.path, 'patternProperties', '*'] });
                    i.patternProperties = {};
                    for (const t of c) i.patternProperties[t.source] = e;
                } else
                    (('draft-07' !== t.target && 'draft-2020-12' !== t.target) ||
                        (i.propertyNames = aa(o.keyType, t, { ...a, path: [...a.path, 'propertyNames'] })),
                        (i.additionalProperties = aa(o.valueType, t, {
                            ...a,
                            path: [...a.path, 'additionalProperties'],
                        })));
                const l = r._zod.values;
                if (l) {
                    const e = [...l].filter(e => 'string' == typeof e || 'number' == typeof e);
                    e.length > 0 && (i.required = e);
                }
            })(e, t, n, a)),
        (e.keyType = t.keyType),
        (e.valueType = t.valueType));
});
function fi(e, t, n) {
    return new pi({ type: 'record', keyType: e, valueType: t, ...C(n) });
}
const gi = a('ZodEnum', (e, t) => {
    (Lt.init(e, t),
        Ta.init(e, t),
        (e._zod.processJSONSchema = (t, n, a) =>
            ((e, t, n) => {
                const a = c(e._zod.def.entries);
                (a.every(e => 'number' == typeof e) && (n.type = 'number'),
                    a.every(e => 'string' == typeof e) && (n.type = 'string'),
                    (n.enum = a));
            })(e, 0, n)),
        (e.enum = t.entries),
        (e.options = Object.values(t.entries)));
    const n = new Set(Object.keys(t.entries));
    ((e.extract = (e, a) => {
        const i = {};
        for (const o of e) {
            if (!n.has(o)) throw new Error(`Key ${o} not found in enum`);
            i[o] = t.entries[o];
        }
        return new gi({ ...t, checks: [], ...C(a), entries: i });
    }),
        (e.exclude = (e, a) => {
            const i = { ...t.entries };
            for (const t of e) {
                if (!n.has(t)) throw new Error(`Key ${t} not found in enum`);
                delete i[t];
            }
            return new gi({ ...t, checks: [], ...C(a), entries: i });
        }));
});
function yi(e, t) {
    const n = Array.isArray(e) ? Object.fromEntries(e.map(e => [e, e])) : e;
    return new gi({ type: 'enum', entries: n, ...C(t) });
}
const vi = a('ZodTransform', (e, t) => {
    (zt.init(e, t),
        Ta.init(e, t),
        (e._zod.processJSONSchema = (e, t, n) =>
            ((e, t) => {
                if ('throw' === t.unrepresentable) throw new Error('Transforms cannot be represented in JSON Schema');
            })(0, e)),
        (e._zod.parse = (n, a) => {
            if ('backward' === a.direction) throw new o(e.constructor.name);
            n.addIssue = a => {
                if ('string' == typeof a) n.issues.push(z(a, n.value, t));
                else {
                    const t = a;
                    (t.fatal && (t.continue = !1),
                        t.code ?? (t.code = 'custom'),
                        t.input ?? (t.input = n.value),
                        t.inst ?? (t.inst = e),
                        n.issues.push(z(t)));
                }
            };
            const i = t.transform(n.value, n);
            return i instanceof Promise ? i.then(e => ((n.value = e), n)) : ((n.value = i), n);
        }));
});
const bi = a('ZodOptional', (e, t) => {
    (Ft.init(e, t),
        Ta.init(e, t),
        (e._zod.processJSONSchema = (t, n, a) => la(e, t, 0, a)),
        (e.unwrap = () => e._zod.def.innerType));
});
function wi(e) {
    return new bi({ type: 'optional', innerType: e });
}
const _i = a('ZodExactOptional', (e, t) => {
    (Ot.init(e, t),
        Ta.init(e, t),
        (e._zod.processJSONSchema = (t, n, a) => la(e, t, 0, a)),
        (e.unwrap = () => e._zod.def.innerType));
});
const ki = a('ZodNullable', (e, t) => {
    (Rt.init(e, t),
        Ta.init(e, t),
        (e._zod.processJSONSchema = (t, n, a) =>
            ((e, t, n, a) => {
                const i = e._zod.def,
                    o = aa(i.innerType, t, a),
                    r = t.seen.get(e);
                'openapi-3.0' === t.target
                    ? ((r.ref = i.innerType), (n.nullable = !0))
                    : (n.anyOf = [o, { type: 'null' }]);
            })(e, t, n, a)),
        (e.unwrap = () => e._zod.def.innerType));
});
function xi(e) {
    return new ki({ type: 'nullable', innerType: e });
}
const Ei = a('ZodDefault', (e, t) => {
    (Pt.init(e, t),
        Ta.init(e, t),
        (e._zod.processJSONSchema = (t, n, a) =>
            ((e, t, n, a) => {
                const i = e._zod.def;
                (aa(i.innerType, t, a),
                    (t.seen.get(e).ref = i.innerType),
                    (n.default = JSON.parse(JSON.stringify(i.defaultValue))));
            })(e, t, n, a)),
        (e.unwrap = () => e._zod.def.innerType),
        (e.removeDefault = e.unwrap));
});
const Si = a('ZodPrefault', (e, t) => {
    (Bt.init(e, t),
        Ta.init(e, t),
        (e._zod.processJSONSchema = (t, n, a) =>
            ((e, t, n, a) => {
                const i = e._zod.def;
                (aa(i.innerType, t, a),
                    (t.seen.get(e).ref = i.innerType),
                    'input' === t.io && (n._prefault = JSON.parse(JSON.stringify(i.defaultValue))));
            })(e, t, n, a)),
        (e.unwrap = () => e._zod.def.innerType));
});
const Ci = a('ZodNonOptional', (e, t) => {
    (jt.init(e, t),
        Ta.init(e, t),
        (e._zod.processJSONSchema = (t, n, a) =>
            ((e, t, n, a) => {
                const i = e._zod.def;
                (aa(i.innerType, t, a), (t.seen.get(e).ref = i.innerType));
            })(e, t, 0, a)),
        (e.unwrap = () => e._zod.def.innerType));
});
const $i = a('ZodCatch', (e, t) => {
    (Ht.init(e, t),
        Ta.init(e, t),
        (e._zod.processJSONSchema = (t, n, a) =>
            ((e, t, n, a) => {
                const i = e._zod.def;
                let o;
                (aa(i.innerType, t, a), (t.seen.get(e).ref = i.innerType));
                try {
                    o = i.catchValue(void 0);
                } catch {
                    throw new Error('Dynamic catch values are not supported in JSON Schema');
                }
                n.default = o;
            })(e, t, n, a)),
        (e.unwrap = () => e._zod.def.innerType),
        (e.removeCatch = e.unwrap));
});
const Mi = a('ZodPipe', (e, t) => {
    (Zt.init(e, t),
        Ta.init(e, t),
        (e._zod.processJSONSchema = (t, n, a) =>
            ((e, t, n, a) => {
                const i = e._zod.def,
                    o = 'input' === t.io ? ('transform' === i.in._zod.def.type ? i.out : i.in) : i.out;
                (aa(o, t, a), (t.seen.get(e).ref = o));
            })(e, t, 0, a)),
        (e.in = t.in),
        (e.out = t.out));
});
function Ti(e, t) {
    return new Mi({ type: 'pipe', in: e, out: t });
}
const Ai = a('ZodReadonly', (e, t) => {
    (Vt.init(e, t),
        Ta.init(e, t),
        (e._zod.processJSONSchema = (t, n, a) =>
            ((e, t, n, a) => {
                const i = e._zod.def;
                (aa(i.innerType, t, a), (t.seen.get(e).ref = i.innerType), (n.readOnly = !0));
            })(e, t, n, a)),
        (e.unwrap = () => e._zod.def.innerType));
});
const Ii = a('ZodCustom', (e, t) => {
    (Jt.init(e, t),
        Ta.init(e, t),
        (e._zod.processJSONSchema = (e, t, n) =>
            ((e, t) => {
                if ('throw' === t.unrepresentable) throw new Error('Custom types cannot be represented in JSON Schema');
            })(0, e)));
});
class Li {
    constructor() {
        ((this.globalContext = {}),
            (this.correlationStack = []),
            (this.remoteBuffer = []),
            (this.remoteFlushTimeout = null),
            (this.sessionId = this.generateSessionId()),
            (this.config = {
                minLevel: this.isProduction() ? 1 : 0,
                enableConsole: !0,
                enableRemote: !1,
                includeStackTrace: !this.isProduction(),
                maxContextSize: 1e4,
                sampling: {
                    errorSampleRate: 1,
                    slowRequestThresholdMs: 1e3,
                    slowRequestSampleRate: 1,
                    defaultSampleRate: 0.05,
                },
            }));
    }
    static getInstance() {
        return (Li.instance || (Li.instance = new Li()), Li.instance);
    }
    configure(e) {
        this.config = { ...this.config, ...e };
    }
    getConfig() {
        return { ...this.config };
    }
    debug(e) {
        this.log(0, e);
    }
    info(e) {
        this.log(1, e);
    }
    warn(e) {
        this.log(2, e);
    }
    error(e) {
        this.log(3, e);
    }
    setContext(e, t) {
        this.globalContext[e] = t;
    }
    clearContext(e) {
        delete this.globalContext[e];
    }
    getContext() {
        return { ...this.globalContext };
    }
    getSessionId() {
        return this.sessionId;
    }
    startTimer(e) {
        const t = performance.now();
        return () => Math.round(performance.now() - t);
    }
    startOperation(e) {
        const t = `${e}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        return (this.correlationStack.push(t), t);
    }
    endOperation(e) {
        const t = this.correlationStack.indexOf(e);
        t > -1 && this.correlationStack.splice(t, 1);
    }
    getCurrentCorrelationId() {
        return this.correlationStack[this.correlationStack.length - 1];
    }
    async withOperation(e, t, n) {
        const a = this.startOperation(e),
            i = this.startTimer(e);
        try {
            const o = await t();
            return (this.info({ operation: e, correlationId: a, durationMs: i(), success: !0, data: n }), o);
        } catch (o) {
            const t = o;
            throw (
                this.error({
                    operation: e,
                    correlationId: a,
                    durationMs: i(),
                    success: !1,
                    error: {
                        name: t.name,
                        message: t.message,
                        stack: this.config.includeStackTrace ? t.stack : void 0,
                    },
                    data: n,
                }),
                o
            );
        } finally {
            this.endOperation(a);
        }
    }
    log(e, t) {
        if (e < this.config.minLevel) return;
        const n = {
            ...t,
            timestamp: Date.now(),
            sessionId: this.sessionId,
            correlationId: t.correlationId || this.getCurrentCorrelationId(),
            context: this.buildContext(t.context),
        };
        (this.config.enableConsole && this.outputToConsole(e, n),
            this.config.enableRemote && this.config.remoteEndpoint && this.sendToRemote(n));
    }
    buildContext(e) {
        const t = {
            ...this.globalContext,
            ...e,
            sessionId: this.sessionId,
            online: 'undefined' == typeof navigator || navigator.onLine,
        };
        return (
            'undefined' != typeof window && (t.viewportSize = { width: window.innerWidth, height: window.innerHeight }),
            t
        );
    }
    outputToConsole(e, t) {
        const n = [console.debug, console.info, console.warn, console.error],
            a = ['DEBUG', 'INFO', 'WARN', 'ERROR'][e] ?? 'INFO',
            i = ['#6b7280', '#3b82f6', '#f59e0b', '#ef4444'][e] ?? '#3b82f6',
            o = n[e] ?? console.info;
        if (this.isProduction()) o(JSON.stringify(t));
        else {
            const e = t.durationMs ? ` (${t.durationMs}ms)` : '',
                n = void 0 !== t.success ? (t.success ? ' OK' : ' FAIL') : '';
            o(`%c[${a}]%c ${t.operation}${e}${n}`, `color: ${i}; font-weight: bold;`, 'color: inherit;', t);
        }
    }
    shouldSample(e) {
        const { sampling: t } = this.config;
        return e.error || !1 === e.success
            ? Math.random() < t.errorSampleRate
            : e.durationMs && e.durationMs > t.slowRequestThresholdMs
              ? Math.random() < t.slowRequestSampleRate
              : Math.random() < t.defaultSampleRate;
    }
    sendToRemote(e) {
        this.shouldSample(e) &&
            (this.remoteBuffer.push(e),
            this.remoteBuffer.length >= 50
                ? this.flushRemoteBuffer()
                : this.remoteFlushTimeout ||
                  (this.remoteFlushTimeout = setTimeout(() => this.flushRemoteBuffer(), 5e3)));
    }
    flushRemoteBuffer() {
        if (0 === this.remoteBuffer.length) return;
        const e = this.remoteBuffer.splice(0, this.remoteBuffer.length);
        ((this.remoteFlushTimeout = null),
            this.config.remoteEndpoint &&
                fetch(this.config.remoteEndpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(e),
                    keepalive: !0,
                }).catch(() => {
                    this.remoteBuffer.length < 100 && this.remoteBuffer.unshift(...e);
                }));
    }
    generateSessionId() {
        return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    }
    isProduction() {
        try {
            return !0;
        } catch {
            return !1;
        }
    }
}
const zi = Li.getInstance();
ui({ formula: La(), min: ei().optional(), max: ei().optional(), cap: ei().optional() }).optional();
const Di = ui({
        id: La(),
        name: La(),
        rarity: yi(['common', 'uncommon', 'rare', 'epic', 'legendary']),
        tier: yi(['SS', 'S', 'A', 'B', 'C']),
        unlocked_by_default: ii().optional(),
        unlock_requirement: La().nullable().optional(),
        unlock_cost_silver: ei().optional(),
        base_effect: La().optional(),
        scaling_type: La().optional(),
        stacking_behavior: La().optional(),
        stacks_well: ii().optional(),
        stack_cap: ei().nullable().optional(),
        formula: La().optional(),
        scaling_per_stack: li(ei()).optional(),
        detailed_description: La().optional(),
        synergies: li(La()).optional(),
        anti_synergies: li(La()).optional(),
        notes: La().optional(),
        graph_type: La().optional(),
        one_and_done: ii().optional(),
        image: La().optional(),
    }),
    Fi = ui({
        id: La(),
        name: La(),
        tier: yi(['SS', 'S', 'A', 'B', 'C']),
        base_damage: ei().optional(),
        base_projectile_count: ei().optional(),
        attack_pattern: La().optional(),
        upgradeable_stats: li(La()).optional(),
        unlock_requirement: La().nullable().optional(),
        unlock_cost_silver: ei().optional(),
        unlocked_by_default: ii().optional(),
        description: La().optional(),
        best_for: li(La()).optional(),
        synergies_items: li(La()).optional(),
        synergies_tomes: li(La()).optional(),
        synergies_characters: li(La()).optional(),
        playstyle: La().optional(),
        pros: li(La()).optional(),
        cons: li(La()).optional(),
        image: La().optional(),
    }),
    Oi = ui({
        id: La(),
        name: La(),
        tier: yi(['SS', 'S', 'A', 'B', 'C']),
        stat_affected: La().optional(),
        value_per_level: La().optional(),
        unlocked_by_default: ii().optional(),
        unlock_requirement: La().nullable().optional(),
        unlock_cost_silver: ei().optional(),
        max_level: ei().optional(),
        description: La().optional(),
        priority: ei().optional(),
        recommended_for: li(La()).optional(),
        synergies_items: li(La()).optional(),
        synergies_weapons: li(La()).optional(),
        synergies_characters: li(La()).optional(),
        notes: La().optional(),
        image: La().optional(),
    }),
    Ri = ui({
        id: La(),
        name: La(),
        tier: yi(['SS', 'S', 'A', 'B', 'C']),
        starting_weapon: La().optional(),
        passive_ability: La().optional(),
        passive_description: La().optional(),
        unlock_requirement: La().nullable().optional(),
        unlock_cost_silver: ei().optional(),
        unlocked_by_default: ii().optional(),
        playstyle: La().optional(),
        best_for: li(La()).optional(),
        strengths: li(La()).optional(),
        weaknesses: li(La()).optional(),
        synergies_items: li(La()).optional(),
        synergies_tomes: li(La()).optional(),
        synergies_weapons: li(La()).optional(),
        build_tips: La().optional(),
        image: La().optional(),
    }),
    Pi = ui({
        id: La(),
        name: La(),
        type: La().optional(),
        icon: La().optional(),
        description: La().optional(),
        activation: La().optional(),
        reward: La().optional(),
        reusable: ii().optional(),
        spawn_count: La().optional(),
        map_icon: La().optional(),
        best_for: li(La()).optional(),
        synergies_items: li(La()).optional(),
        strategy: La().optional(),
        notes: La().optional(),
        image: La().optional(),
    }),
    Ni = ui({
        version: La().optional(),
        last_updated: La().optional(),
        mechanics: fi(La(), ri()).optional(),
        breakpoints: fi(La(), ri()).optional(),
    }),
    Bi = ui({ version: La(), last_updated: La(), total_items: ei().optional(), items: li(Di) }).passthrough(),
    ji = ui({ version: La(), last_updated: La(), total_weapons: ei().optional(), weapons: li(Fi) }).passthrough(),
    qi = ui({ version: La(), last_updated: La(), total_tomes: ei().optional(), tomes: li(Oi) }).passthrough(),
    Hi = ui({ version: La(), last_updated: La(), total_characters: ei().optional(), characters: li(Ri) }).passthrough(),
    Zi = ui({ version: La(), last_updated: La(), total_shrines: ei().optional(), shrines: li(Pi) }).passthrough();
function Ui(e, t, n) {
    try {
        return { success: !0, data: t.parse(e) };
    } catch (a) {
        const e = a;
        let t;
        if (
            (zi.error({
                operation: 'schema.validate',
                error: { name: e.name, message: e.message, module: 'schema-validator' },
                data: { dataType: n },
            }),
            a instanceof fa)
        ) {
            t = a.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
        } else t = a instanceof Error ? a.message : 'Unknown error';
        return { success: !1, error: `Invalid ${n} data: ${t}`, zodError: a instanceof fa ? a : void 0 };
    }
}
const Vi = Object.freeze({ SS: 0, S: 1, A: 2, B: 3, C: 4 }),
    Wi = Object.freeze({ legendary: 0, epic: 1, rare: 2, uncommon: 3, common: 4 }),
    Ji = Object.freeze({
        GYM_SAUCE: 'gym_sauce',
        FORBIDDEN_JUICE: 'forbidden_juice',
        OATS: 'oats',
        BATTERY: 'battery',
        TURBO_SOCKS: 'turbo_socks',
        BEER: 'beer',
        BACKPACK: 'backpack',
        SLIPPERY_RING: 'slippery_ring',
        PHANTOM_SHROUD: 'phantom_shroud',
        BEEFY_RING: 'beefy_ring',
        LEECHING_CRYSTAL: 'leeching_crystal',
        BRASS_KNUCKLES: 'brass_knuckles',
        BOSS_BUSTER: 'boss_buster',
    }),
    Ki = Object.freeze({
        [Ji.GYM_SAUCE]: { stat: 'damage', value: 10, type: 'add' },
        [Ji.FORBIDDEN_JUICE]: { stat: 'crit_chance', value: 10, type: 'add' },
        [Ji.OATS]: { stat: 'hp', value: 25, type: 'add' },
        [Ji.BATTERY]: { stat: 'attack_speed', value: 8, type: 'add' },
        [Ji.TURBO_SOCKS]: { stat: 'movement_speed', value: 15, type: 'add' },
        [Ji.BEER]: { stat: 'damage', value: 20, type: 'add' },
        [Ji.BACKPACK]: { stat: 'projectiles', value: 1, type: 'add' },
        [Ji.SLIPPERY_RING]: { stat: 'evasion_internal', value: 15, type: 'add' },
        [Ji.PHANTOM_SHROUD]: { stat: 'evasion_internal', value: 15, type: 'add' },
        [Ji.BEEFY_RING]: { stat: 'damage', value: 20, type: 'hp_percent' },
        [Ji.LEECHING_CRYSTAL]: { stat: 'hp', value: 1.5, type: 'multiply' },
        [Ji.BRASS_KNUCKLES]: { stat: 'damage', value: 20, type: 'add' },
        [Ji.BOSS_BUSTER]: { stat: 'damage', value: 15, type: 'add' },
    }),
    Gi = Object.freeze({
        damage: 100,
        hp: 100,
        crit_chance: 5,
        crit_damage: 150,
        attack_speed: 100,
        movement_speed: 100,
        armor: 0,
        evasion_internal: 0,
        projectiles: 1,
    }),
    Yi = 3,
    Xi = 40,
    Qi = Object.freeze(['SS', 'S', 'A', 'B', 'C']),
    eo = Object.freeze(['common', 'uncommon', 'rare', 'epic', 'legendary']),
    to = 99,
    no = 10485760,
    ao = 20,
    io = Object.freeze({
        COMPARE_ITEMS: !1,
        BUILD_SCANNER: !0,
        BUILD_ADVISOR: !0,
        PULL_TO_REFRESH: !0,
        FAVORITES: !1,
        VIEW_DETAILS_BUTTON: !1,
        MODAL_BACKDROP_CLOSE: !1,
        TAB_SCROLL_INDICATORS: !1,
        SEARCH_FOCUS_HISTORY: !1,
        MOBILE_MORE_MENU: !1,
        OFFLINE_NOTIFICATIONS: !1,
    });
function oo(e, t) {
    let n;
    switch (t) {
        case 'items':
            n = (function (e) {
                return Ui(e, Bi, 'items');
            })(e);
            break;
        case 'weapons':
            n = (function (e) {
                return Ui(e, ji, 'weapons');
            })(e);
            break;
        case 'tomes':
            n = (function (e) {
                return Ui(e, qi, 'tomes');
            })(e);
            break;
        case 'characters':
            n = (function (e) {
                return Ui(e, Hi, 'characters');
            })(e);
            break;
        case 'shrines':
            n = (function (e) {
                return Ui(e, Zi, 'shrines');
            })(e);
            break;
        case 'stats':
            n = (function (e) {
                return Ui(e, Ni, 'stats');
            })(e);
            break;
        default:
            return { valid: !1, errors: [`Unknown data type: ${t}`] };
    }
    return n.success
        ? { valid: !0, errors: [], data: n.data }
        : { valid: !1, errors: [n.error || 'Unknown validation error'] };
}
function ro(e, t, n) {
    const a = [];
    return (
        e.tier &&
            !Qi.includes(e.tier) &&
            a.push(`${t}[${n}] (${e.name}): Invalid tier '${e.tier}'. Must be one of: ${Qi.join(', ')}`),
        a
    );
}
function so(e) {
    const t = [],
        n = [];
    if (!e) return { valid: !1, errors: ['No data provided for validation'], warnings: [] };
    (['items', 'weapons', 'tomes', 'characters', 'shrines'].forEach(a => {
        const i = e[a];
        if (i) {
            const e = (function (e, t) {
                const n = [];
                if (!e) return (n.push(`${t}: Data is null or undefined`), { valid: !1, errors: n });
                (e.version || n.push(`${t}: Missing 'version' field`),
                    e.last_updated || n.push(`${t}: Missing 'last_updated' field`));
                const a = e[t];
                return Array.isArray(a)
                    ? (a.forEach((e, a) => {
                          (e.id || n.push(`${t}[${a}]: Missing 'id' field`),
                              e.name || n.push(`${t}[${a}]: Missing 'name' field`),
                              'items' === t &&
                                  (e.rarity || n.push(`${t}[${a}] (${e.name || e.id}): Missing 'rarity' field`),
                                  e.tier || n.push(`${t}[${a}] (${e.name || e.id}): Missing 'tier' field`),
                                  e.detailed_description ||
                                      n.push(`${t}[${a}] (${e.name || e.id}): Missing 'detailed_description' field`)),
                              ('weapons' !== t && 'tomes' !== t && 'characters' !== t) ||
                                  e.tier ||
                                  n.push(`${t}[${a}] (${e.name || e.id}): Missing 'tier' field`));
                      }),
                      { valid: 0 === n.length, errors: n })
                    : (n.push(`${t}: Data array is missing or not an array`), { valid: !1, errors: n });
            })(i, a);
            t.push(...e.errors);
        } else n.push(`${a}: Data not loaded`);
    }),
        e.items?.items &&
            e.items.items.forEach((e, n) => {
                (t.push(
                    ...(function (e, t, n) {
                        const a = [];
                        return (
                            e.rarity &&
                                !eo.includes(e.rarity.toLowerCase()) &&
                                a.push(
                                    `${t}[${n}] (${e.name}): Invalid rarity '${e.rarity}'. Must be one of: ${eo.join(', ')}`
                                ),
                            a
                        );
                    })(e, 'items', n)
                ),
                    t.push(...ro(e, 'items', n)));
            }),
        ['weapons', 'tomes', 'characters'].forEach(n => {
            const a = e[n];
            (a?.[n] || []).forEach((e, a) => {
                t.push(...ro(e, n, a));
            });
        }));
    const a = (function (e) {
        const t = [];
        if (!e) return (t.push('Cross-reference validation: allData is null or undefined'), { valid: !1, errors: t });
        const n = new Set((e.items?.items || []).map(e => e.id)),
            a = new Set((e.weapons?.weapons || []).map(e => e.id)),
            i = new Set((e.tomes?.tomes || []).map(e => e.id)),
            o = new Set((e.characters?.characters || []).map(e => e.id));
        return (
            (e.items?.items || []).forEach((e, r) => {
                e.synergies &&
                    Array.isArray(e.synergies) &&
                    e.synergies.forEach((s, c) => {
                        if ('object' == typeof s && null !== s && 'with' in s) {
                            const l = s.with;
                            (Array.isArray(l) ? l : l ? [l] : []).forEach(s => {
                                n.has(s) ||
                                    a.has(s) ||
                                    i.has(s) ||
                                    o.has(s) ||
                                    t.push(`items[${r}] (${e.name}): synergy[${c}] references unknown entity '${s}'`);
                            });
                        }
                    });
            }),
            (e.characters?.characters || []).forEach((e, a) => {
                if ('passive_item_ref' in e) {
                    const i = e.passive_item_ref;
                    i &&
                        !n.has(i) &&
                        t.push(`characters[${a}] (${e.name}): passive_item_ref '${i}' not found in items`);
                }
            }),
            (e.weapons?.weapons || []).forEach((e, n) => {
                if ('upgrades_from' in e) {
                    const i = e.upgrades_from;
                    i && !a.has(i) && t.push(`weapons[${n}] (${e.name}): upgrades_from '${i}' not found in weapons`);
                }
                if ('upgrades_to' in e) {
                    const i = e.upgrades_to;
                    (Array.isArray(i) ? i : i ? [i] : []).forEach(i => {
                        a.has(i) || t.push(`weapons[${n}] (${e.name}): upgrades_to '${i}' not found in weapons`);
                    });
                }
            }),
            { valid: 0 === t.length, errors: t }
        );
    })(e);
    return (
        t.push(...a.errors),
        e.items?.items &&
            e.items.items.forEach((e, t) => {
                (e.image || n.push(`items[${t}] (${e.name}): Missing recommended 'image' field`),
                    (e.tags && 0 !== e.tags.length) ||
                        n.push(`items[${t}] (${e.name}): Missing recommended 'tags' field`));
            }),
        e.tomes?.tomes &&
            e.tomes.tomes.forEach((e, t) => {
                (e.image || n.push(`tomes[${t}] (${e.name}): Missing recommended 'image' field`),
                    (e.tags && 0 !== e.tags.length) ||
                        n.push(`tomes[${t}] (${e.name}): Missing recommended 'tags' field`));
            }),
        { valid: 0 === t.length, errors: t, warnings: n }
    );
}
function co(e) {
    return (
        'rarity' in e &&
        'tier' in e &&
        !('base_damage' in e) &&
        !('attack_pattern' in e) &&
        !('stat_affected' in e) &&
        !('passive_ability' in e) &&
        !('activation' in e)
    );
}
function lo(e) {
    return null !== e && 'INPUT' === e.tagName;
}
function uo(e) {
    return null !== e && 'SELECT' === e.tagName;
}
function ho(e, t = null) {
    return document.getElementById(e) || t;
}
function mo(e, t = document, n = null) {
    return t.querySelector(e) || n;
}
function po(e, t = document) {
    return t.querySelectorAll(e);
}
function fo(e, t) {
    const n = document.getElementById(e);
    n && (n.value = String(t));
}
function go(e, t, n = 'entity-image') {
    if (!e) return '';
    return `<picture class="blur-up-container">\n        <source srcset="${e.replace(/\.(png|jpg|jpeg)$/i, '.webp')}" type="image/webp">\n        <img src="${e}" alt="${So(t)}" class="${n} blur-up-image" data-fallback="true" data-blur-up="true" loading="lazy">\n    </picture>`;
}
let yo = !1,
    vo = !1;
function bo(e, t, n = 'entity-image') {
    return e && e.image ? go(e.image, t, n) : '';
}
function wo(e, t, n) {
    return e && e.image ? go(e.image, t, `modal-${n}-image`) : '';
}
function _o(e, t) {
    return `\n        <div class="empty-state">\n            <div class="empty-icon">${e}</div>\n            <h3>No ${t} Found</h3>\n            <p>Try adjusting your search or filter criteria.</p>\n            <button class="btn-secondary" data-action="clear-filters">Clear Filters</button>\n        </div>\n    `;
}
function ko(e) {
    return 'object' == typeof e && null !== e && 'name' in e;
}
function xo(e) {
    return 'object' == typeof e && null !== e && 'tier' in e;
}
function Eo(e) {
    return 'object' == typeof e && null !== e && 'rarity' in e;
}
function So(e) {
    if (!e) return '';
    const t = document.createElement('div');
    return ((t.textContent = e), t.innerHTML.replace(/"/g, '&quot;'));
}
function Co(e) {
    return `<span class="tier-label">${e} Tier</span>`;
}
function $o(e) {
    if (!e || 'string' != typeof e) return !1;
    try {
        const t = new URL(e);
        return 'https:' === t.protocol || 'http:' === t.protocol;
    } catch {
        return !1;
    }
}
function Mo(e, t) {
    let n;
    const a = function (...a) {
        (clearTimeout(n), (n = setTimeout(() => e.apply(this, a), t)));
    };
    return (
        (a.cancel = () => {
            (clearTimeout(n), (n = void 0));
        }),
        a
    );
}
let To = {
    currentTab: 'items',
    filteredData: [],
    allData: {
        items: void 0,
        weapons: void 0,
        tomes: void 0,
        characters: void 0,
        shrines: void 0,
        stats: void 0,
        changelog: void 0,
    },
    currentBuild: { character: null, weapon: null, tomes: [], items: [], name: '', notes: '' },
    compareItems: [],
    favorites: { items: [], weapons: [], tomes: [], characters: [], shrines: [] },
};
const Ao = new Map();
function Io(e) {
    return To[e];
}
function Lo(e, t) {
    ((To[e] = t),
        'undefined' != typeof window &&
            (function (e, t) {
                switch (e) {
                    case 'currentTab':
                        window.currentTab = t;
                        break;
                    case 'filteredData':
                        window.filteredData = t;
                        break;
                    case 'allData':
                        window.allData = t;
                        break;
                    case 'currentBuild':
                        window.currentBuild = t;
                        break;
                    case 'compareItems':
                        window.compareItems = t;
                        break;
                    case 'favorites':
                        window.favorites = t;
                }
            })(e, t));
    const n = Ao.get(e);
    n &&
        n.forEach(n => {
            try {
                n(t);
            } catch (a) {
                const t = a;
                zi.error({
                    operation: 'store.subscriber_error',
                    error: { name: t.name, message: t.message },
                    data: { key: e },
                });
            }
        });
}
function zo(e, t) {
    Ao.has(e) || Ao.set(e, new Set());
    const n = Ao.get(e),
        a = t;
    return (
        n.add(a),
        () => {
            (n.delete(a), 0 === n.size && Ao.delete(e));
        }
    );
}
const Do = Object.freeze(
        Object.defineProperty({ __proto__: null, getState: Io, setState: Lo, subscribe: zo }, Symbol.toStringTag, {
            value: 'Module',
        })
    ),
    Fo = 'megabonk_favorites';
let Oo = null;
function Ro() {
    if (null !== Oo) return Oo;
    try {
        const e = '__megabonk_storage_test__';
        localStorage.setItem(e, 'test');
        const t = localStorage.getItem(e);
        return (localStorage.removeItem(e), (Oo = 'test' === t), Oo);
    } catch {
        return ((Oo = !1), !1);
    }
}
function Po() {
    if (Ro())
        try {
            const e = Io('favorites');
            localStorage.setItem(Fo, JSON.stringify(e));
        } catch (t) {
            const n = t;
            try {
                'QuotaExceededError' === n.name
                    ? e.error('Storage full. Try clearing browser cache to save favorites.')
                    : 'SecurityError' === n.name
                      ? e.warning('Favorites disabled in private browsing mode')
                      : e.error('Failed to save favorite');
            } catch {}
        }
}
function No(e, t) {
    const n = { ...Io('favorites') };
    n[e] ? (n[e] = [...n[e]]) : (n[e] = []);
    const a = n[e].indexOf(t);
    return a > -1 ? (n[e].splice(a, 1), Lo('favorites', n), Po(), !1) : (n[e].push(t), Lo('favorites', n), Po(), !0);
}
const Bo = 'megabonk_search_history';
function jo() {
    try {
        const e = localStorage.getItem(Bo);
        if (!e) return [];
        const t = JSON.parse(e);
        return Array.isArray(t) ? t.filter(e => 'string' == typeof e && e.length > 0) : [];
    } catch (e) {
        return [];
    }
}
function qo(e, t) {
    const n = jo();
    if (0 === n.length) return;
    const a = document.querySelector('.search-history-dropdown');
    a && a.remove();
    const i = document.createElement('div');
    ((i.className = 'search-history-dropdown'),
        i.setAttribute('role', 'listbox'),
        i.setAttribute('aria-label', 'Search history'),
        e.setAttribute('aria-expanded', 'true'),
        e.setAttribute('aria-haspopup', 'listbox'),
        (i.innerHTML = `\n        <div class="search-history-header">\n            <span>Recent Searches</span>\n            <button class="clear-history-btn" aria-label="Clear search history">Clear</button>\n        </div>\n        <ul class="search-history-list" role="group">\n            ${n.map((e, t) => `\n                <li class="search-history-item" role="option" tabindex="0" data-term="${So(e)}" data-index="${t}" aria-selected="false">\n                    ${So(e)}\n                </li>\n            `).join('')}\n        </ul>\n    `));
    const o = e.parentElement;
    o && ((o.style.position = 'relative'), o.appendChild(i));
    const r = new AbortController(),
        s = () => {
            (r.abort(), e.setAttribute('aria-expanded', 'false'), i.parentElement && i.remove());
        },
        c = i.querySelector('.clear-history-btn');
    c?.addEventListener(
        'click',
        e => {
            (e.stopPropagation(),
                (function () {
                    try {
                        localStorage.removeItem(Bo);
                    } catch (e) {}
                })(),
                s());
        },
        { signal: r.signal }
    );
    const l = i.querySelectorAll('.search-history-item');
    let d = -1;
    const u = () => {
        l.forEach((e, t) => {
            const n = t === d;
            (e.classList.toggle('active', n), e.setAttribute('aria-selected', n ? 'true' : 'false'), n && e.focus());
        });
    };
    (l.forEach(n => {
        n.addEventListener(
            'click',
            () => {
                const a = n.getAttribute('data-term');
                a && e && ((e.value = a), t(a), s());
            },
            { signal: r.signal }
        );
    }),
        e.addEventListener(
            'keydown',
            n => {
                'ArrowDown' === n.key
                    ? (n.preventDefault(), (d = Math.min(d + 1, l.length - 1)), u())
                    : 'ArrowUp' === n.key
                      ? (n.preventDefault(), (d = Math.max(d - 1, 0)), u())
                      : 'Enter' === n.key &&
                        d >= 0 &&
                        (n.preventDefault(),
                        (() => {
                            if (d >= 0 && d < l.length) {
                                const n = l[d].getAttribute('data-term');
                                n && e && ((e.value = n), t(n), s());
                            }
                        })());
            },
            { signal: r.signal }
        ),
        document.addEventListener(
            'click',
            t => {
                i.contains(t.target) || t.target === e || s();
            },
            { signal: r.signal }
        ),
        document.addEventListener(
            'keydown',
            t => {
                'Escape' === t.key && (s(), e?.focus());
            },
            { signal: r.signal }
        ));
}
const Ho = 'megabonk_filter_state',
    Zo = ['build-planner', 'calculator', 'shrines', 'changelog'];
function Uo() {
    try {
        const e = window.sessionStorage.getItem(Ho);
        return e ? JSON.parse(e) : {};
    } catch (e) {
        return {};
    }
}
function Vo(e) {
    if (e && !Zo.includes(e))
        try {
            const t = ho('searchInput'),
                n = ho('favoritesOnly'),
                a = ho('tierFilter'),
                i = ho('sortBy'),
                o = {
                    search: lo(t) ? t.value : '',
                    favoritesOnly: !!lo(n) && n.checked,
                    tierFilter: uo(a) ? a.value : 'all',
                    sortBy: uo(i) ? i.value : 'rarity',
                };
            if ('items' === e) {
                const e = ho('rarityFilter'),
                    t = ho('stackingFilter');
                ((o.rarityFilter = uo(e) ? e.value : 'all'), (o.stackingFilter = uo(t) ? t.value : 'all'));
            }
            const r = Uo();
            ((r[e] = o), window.sessionStorage.setItem(Ho, JSON.stringify(r)));
        } catch (t) {}
}
function Wo(e, t, n = 'text') {
    if (!e || !t || 'string' != typeof e || 'string' != typeof t) return { score: 0, matchType: 'none', field: n };
    if (((e = e.trim().toLowerCase()), (t = t.trim().toLowerCase()), 0 === e.length || 0 === t.length))
        return { score: 0, matchType: 'none', field: n };
    const a = 'name' === n ? 1e3 : 0;
    if (t === e) return { score: 2e3 + a, matchType: 'exact', field: n };
    if (t.startsWith(e)) return { score: 1500 + a, matchType: 'starts_with', field: n };
    if (t.includes(e)) return { score: 1e3 + a, matchType: 'contains', field: n };
    let i = 0,
        o = 0,
        r = 0;
    for (let s = 0; s < t.length && o < e.length; s++) t[s] === e[o] ? ((i += 1 + r), r++, o++) : (r = 0);
    return o !== e.length ? { score: 0, matchType: 'none', field: n } : { score: i, matchType: 'fuzzy', field: n };
}
const Jo = new Set([
    'tier',
    'rarity',
    'type',
    'name',
    'id',
    'damage',
    'hp',
    'stacks_well',
    'one_and_done',
    'stat',
    'priority',
    'tags',
    'synergy',
    'effect',
    'scaling_type',
    'graph_type',
    'multiplier',
    'base_effect',
    'formula',
    'attack_speed',
    'movement_speed',
    'crit_chance',
    'crit_damage',
    'armor',
    'evasion',
    'stat_affected',
    'value_per_level',
]);
const Ko = 'searchResultsDropdown';
let Go = -1,
    Yo = [],
    Xo = !1;
function Qo() {
    return Xo;
}
function er() {
    const e = ho(Ko),
        t = ho('searchInput');
    (e && ((e.hidden = !0), (e.innerHTML = '')),
        t && t.setAttribute('aria-expanded', 'false'),
        (Go = -1),
        (Yo = []),
        (Xo = !1));
}
function tr(e) {
    if (!Xo || 0 === Yo.length) return !1;
    switch (e.key) {
        case 'ArrowDown':
            return (e.preventDefault(), (Go = Math.min(Go + 1, Yo.length - 1)), ar(), !0);
        case 'ArrowUp':
            return (e.preventDefault(), (Go = Math.max(Go - 1, -1)), ar(), !0);
        case 'Enter':
            return (
                Go >= 0 &&
                (e.preventDefault(),
                (function () {
                    const e = Go >= 0 && Go < Yo.length ? (Yo[Go] ?? null) : null;
                    e && nr(e);
                })(),
                !0)
            );
        case 'Escape':
            return (e.preventDefault(), er(), !0);
        default:
            return !1;
    }
}
function nr(e) {
    er();
    const t = ho('searchInput');
    (t && (t.value = ''),
        'function' == typeof window.switchTab && window.switchTab(e.type),
        requestAnimationFrame(() => {
            const t = e.item.id,
                n = document.querySelector(`[data-entity-id="${t}"]`);
            n &&
                (n.scrollIntoView({ behavior: 'smooth', block: 'center' }),
                n.classList.add('search-highlight'),
                setTimeout(() => {
                    n.classList.remove('search-highlight');
                }, 2e3));
        }));
}
function ar() {
    const e = ho(Ko);
    if (!e) return;
    e.querySelectorAll('.search-dropdown-item').forEach((e, t) => {
        const n = t === Go;
        (e.classList.toggle('keyboard-focused', n),
            e.setAttribute('aria-selected', n ? 'true' : 'false'),
            n && e.scrollIntoView({ block: 'nearest' }));
    });
}
function ir(e) {
    const t = ho('filters');
    t &&
        ((t.innerHTML = ''),
        'items' === e
            ? (t.innerHTML =
                  '\n            <label for="rarityFilter">Rarity:</label>\n            <select id="rarityFilter">\n                <option value="all">All Rarities</option>\n                <option value="common">Common</option>\n                <option value="uncommon">Uncommon</option>\n                <option value="rare">Rare</option>\n                <option value="epic">Epic</option>\n                <option value="legendary">Legendary</option>\n            </select>\n            <label for="tierFilter">Tier:</label>\n            <select id="tierFilter">\n                <option value="all">All Tiers</option>\n                <option value="SS">SS Tier</option>\n                <option value="S">S Tier</option>\n                <option value="A">A Tier</option>\n                <option value="B">B Tier</option>\n                <option value="C">C Tier</option>\n            </select>\n            <label for="stackingFilter">Stacking:</label>\n            <select id="stackingFilter">\n                <option value="all">All</option>\n                <option value="stacks_well">Stacks Well</option>\n                <option value="one_and_done">One-and-Done</option>\n            </select>\n            <label for="sortBy">Sort:</label>\n            <select id="sortBy">\n                <option value="name">Name</option>\n                <option value="tier">Tier</option>\n                <option value="rarity">Rarity</option>\n            </select>\n        ')
            : ['weapons', 'tomes', 'characters'].includes(e)
              ? (t.innerHTML =
                    '\n            <label for="tierFilter">Tier:</label>\n            <select id="tierFilter">\n                <option value="all">All Tiers</option>\n                <option value="SS">SS Tier</option>\n                <option value="S">S Tier</option>\n                <option value="A">A Tier</option>\n                <option value="B">B Tier</option>\n                <option value="C">C Tier</option>\n            </select>\n            <label for="sortBy">Sort:</label>\n            <select id="sortBy">\n                <option value="name">Name</option>\n                <option value="tier">Tier</option>\n            </select>\n        ')
              : 'shrines' === e
                ? (t.innerHTML =
                      '\n            <label for="typeFilter">Type:</label>\n            <select id="typeFilter">\n                <option value="all">All Types</option>\n                <option value="stat_upgrade">Stat Upgrade</option>\n                <option value="combat">Combat</option>\n                <option value="utility">Utility</option>\n                <option value="risk_reward">Risk/Reward</option>\n            </select>\n        ')
                : 'changelog' === e &&
                  (t.innerHTML =
                      '\n            <label for="categoryFilter">Category:</label>\n            <select id="categoryFilter">\n                <option value="all">All Categories</option>\n                <option value="balance">Balance Changes</option>\n                <option value="new_content">New Content</option>\n                <option value="bug_fixes">Bug Fixes</option>\n                <option value="removed">Removed</option>\n                <option value="other">Other</option>\n            </select>\n            <label for="sortBy">Sort:</label>\n            <select id="sortBy">\n                <option value="date_desc">Newest First</option>\n                <option value="date_asc">Oldest First</option>\n            </select>\n        '));
}
function or(e, t) {
    const n = performance.now(),
        a = e.length;
    let i = [...e];
    const o = ho('searchInput'),
        r = o?.value || '';
    if (r.trim()) {
        const e = (function (e) {
            const t = { text: [], filters: {} };
            if (!e || 'string' != typeof e) return t;
            const n = e.trim();
            return (
                0 === n.length ||
                    (n.slice(0, 1e3).match(/(?:[^\s"]+|"[^"]*")+/g) || []).slice(0, 50).forEach(e => {
                        if (!e || 0 === e.length) return;
                        if (0 === (e = e.replace(/^["'](.*)["']$/, '$1')).length) return;
                        const n = e.match(/^(\w+):([\w><=!.+-]+)$/);
                        if (n) {
                            const [, e, a] = n;
                            e &&
                                a &&
                                e.length <= 50 &&
                                a.length <= 100 &&
                                Jo.has(e.toLowerCase()) &&
                                (t.filters[e.toLowerCase()] = a);
                        } else e.length <= 200 && t.text.push(e);
                    }),
                t
            );
        })(r);
        if (e.text.length > 0) {
            const t = e.text.join(' ').toLowerCase();
            i = i
                .map(e => {
                    const n = e.name || '',
                        a = e.description || '',
                        i = (co(e) && e.base_effect) || '',
                        o = (e.tags || []).join(' '),
                        r = [Wo(t, n, 'name'), Wo(t, a, 'description'), Wo(t, i, 'effect'), Wo(t, o, 'tags')].reduce(
                            (e, t) => (t.score > e.score ? t : e)
                        );
                    return { item: { ...e, _matchContext: r }, score: r.score };
                })
                .filter(e => e.score > 0)
                .sort((e, t) => t.score - e.score)
                .map(e => e.item);
        }
        Object.keys(e.filters).length > 0 &&
            (i = i.filter(t =>
                (function (e, t) {
                    for (const [n, a] of Object.entries(t)) {
                        const t = e[n];
                        if (null == t) return !1;
                        if (null != a)
                            if (a.startsWith('>=')) {
                                const e = parseFloat(a.substring(2)),
                                    n = parseFloat(String(t));
                                if (isNaN(e) || isNaN(n) || n < e) return !1;
                            } else if (a.startsWith('<=')) {
                                const e = parseFloat(a.substring(2)),
                                    n = parseFloat(String(t));
                                if (isNaN(e) || isNaN(n) || n > e) return !1;
                            } else if (a.startsWith('>')) {
                                const e = parseFloat(a.substring(1)),
                                    n = parseFloat(String(t));
                                if (isNaN(e) || isNaN(n) || n <= e) return !1;
                            } else if (a.startsWith('<')) {
                                const e = parseFloat(a.substring(1)),
                                    n = parseFloat(String(t));
                                if (isNaN(e) || isNaN(n) || n >= e) return !1;
                            } else if (a.startsWith('!')) {
                                if (String(t).toLowerCase() === a.substring(1).toLowerCase()) return !1;
                            } else if (String(t).toLowerCase() !== a.toLowerCase()) return !1;
                    }
                    return !0;
                })(t, e.filters)
            ));
    }
    const s = ho('favoritesOnly');
    !!lo(s) &&
        s.checked &&
        (i = i.filter(e =>
            (function (e, t) {
                const n = Io('favorites');
                return n[e]?.includes(t) || !1;
            })(t, e.id)
        ));
    const c = ho('tierFilter'),
        l = uo(c) ? c.value : 'all';
    if ((l && 'all' !== l && (i = i.filter(e => e.tier === l)), 'items' === t)) {
        const e = ho('rarityFilter'),
            t = uo(e) ? e.value : 'all';
        t && 'all' !== t && (i = i.filter(e => co(e) && e.rarity === t));
        const n = ho('stackingFilter'),
            a = uo(n) ? n.value : 'all';
        'stacks_well' === a
            ? (i = i.filter(e => co(e) && !0 === e.stacks_well))
            : 'one_and_done' === a && (i = i.filter(e => co(e) && !0 === e.one_and_done));
    }
    if ('shrines' === t) {
        const e = ho('typeFilter'),
            t = uo(e) ? e.value : 'all';
        t &&
            'all' !== t &&
            (i = i.filter(e => {
                return ('activation' in (n = e) || 'reward' in n) && e.type === t;
                var n;
            }));
    }
    if ('changelog' === t) {
        const e = i,
            o = ho('categoryFilter'),
            s = uo(o) ? o.value : 'all';
        if (s && 'all' !== s) {
            i = e.filter(e => {
                if (e.categories && s in e.categories) {
                    const t = e.categories[s];
                    return t && t.length > 0;
                }
                return !1;
            });
        }
        const c = ho('sortBy'),
            l = uo(c) ? c.value : 'date_desc',
            d = i,
            u = new Map(),
            h = 'date_asc' === l ? 1 / 0 : -1 / 0;
        return (
            d.forEach(e => {
                const t = e.date ?? '';
                if (!u.has(t)) {
                    const e = new Date(t);
                    u.set(t, !t || isNaN(e.getTime()) ? h : e.getTime());
                }
            }),
            'date_asc' === l
                ? d.sort((e, t) => (u.get(e.date ?? '') ?? h) - (u.get(t.date ?? '') ?? h))
                : d.sort((e, t) => (u.get(t.date ?? '') ?? h) - (u.get(e.date ?? '') ?? h)),
            rr(n, t, r, a, d.length),
            d
        );
    }
    const d = ho('sortBy'),
        u = uo(d) ? d.value : null;
    return (
        u &&
            (function (e, t) {
                'name' === t
                    ? e.sort((e, t) => {
                          const n = ko(e) ? e.name : '',
                              a = ko(t) ? t.name : '';
                          return n.localeCompare(a);
                      })
                    : 'tier' === t
                      ? e.sort((e, t) => {
                            const n = xo(e) ? e.tier : void 0,
                                a = xo(t) ? t.tier : void 0;
                            return (Vi[n] ?? 99) - (Vi[a] ?? 99);
                        })
                      : 'rarity' === t &&
                        e.sort((e, t) => {
                            const n = Eo(e) ? e.rarity : void 0,
                                a = Eo(t) ? t.rarity : void 0;
                            return (Wi[n] ?? 99) - (Wi[a] ?? 99);
                        });
            })(i, u),
        rr(n, t, r, a, i.length),
        i
    );
}
function rr(e, t, n, a, i) {
    const o = Math.round(performance.now() - e),
        r = ho('tierFilter'),
        s = ho('favoritesOnly');
    (n.trim() || 'all' !== r?.value || s?.checked) &&
        zi.debug({
            operation: 'filter.apply',
            durationMs: o,
            data: { tabName: t, searchQuery: n.trim(), totalItems: a, matchedItems: i },
        });
}
function sr() {
    const e = ho('searchInput'),
        t = (e?.value || '').trim();
    t.length >= 2 &&
        (function (e) {
            if (e && !(e.trim().length < 2))
                try {
                    let t = jo();
                    ((t = t.filter(t => t !== e)),
                        t.unshift(e),
                        (t = t.slice(0, 10)),
                        localStorage.setItem(Bo, JSON.stringify(t)));
                } catch (t) {}
        })(t);
    const n = Io('currentTab');
    if ((er(), t.length >= 2)) {
        const e = Io('allData');
        if (e && window.renderGlobalSearchResults) {
            const a = (function (e, t) {
                if (!e || !e.trim()) return [];
                const n = [],
                    a = e.trim().toLowerCase(),
                    i = [
                        'name',
                        'base_effect',
                        'attack_pattern',
                        'passive_ability',
                        'reward',
                        'description',
                        'effect',
                        'passive',
                    ],
                    o = [
                        { type: 'items', data: t.items?.items },
                        { type: 'weapons', data: t.weapons?.weapons },
                        { type: 'tomes', data: t.tomes?.tomes },
                        { type: 'characters', data: t.characters?.characters },
                        { type: 'shrines', data: t.shrines?.shrines },
                    ];
                for (const { type: r, data: s } of o) {
                    if (!s) continue;
                    let e = 0;
                    for (const t of s) {
                        if (e >= 30) break;
                        let o = 0;
                        for (const e of i) {
                            const n = t[e];
                            if ('string' == typeof n && n) {
                                const t = Wo(a, n, e);
                                if (t.score > o) {
                                    if (((o = t.score), o >= 2500 && 'name' === e)) break;
                                    if (o >= 3e3) break;
                                }
                            }
                        }
                        if (o < 2500) {
                            const e = t.tags;
                            if (Array.isArray(e)) {
                                const t = Wo(a, e.join(' '), 'tags');
                                t.score > o && (o = t.score);
                            }
                        }
                        o > 0 && (n.push({ type: r, item: t, score: o }), e++);
                    }
                }
                return n.sort((e, t) => t.score - e.score).slice(0, 100);
            })(t, e);
            window.renderGlobalSearchResults(a, n, t);
        }
    } else window.renderTabContent && n && window.renderTabContent(n);
    n && Vo(n);
}
function cr() {
    const e = ho('searchInput');
    (e && (e.value = ''),
        er(),
        po('#filters select').forEach(e => {
            e.value = 'all';
        }));
    const t = Io('currentTab');
    window.renderTabContent && t && window.renderTabContent(t);
}
function lr(e, t) {
    requestAnimationFrame(async () => {
        try {
            (await n(() => import('./charts-DLj1O0Ua.js'), []))[e]();
        } catch (a) {
            zi.warn({
                operation: 'chart.init',
                error: { name: 'ImportError', message: `Failed to initialize ${e}`, module: 'renderers' },
                data: { context: t },
            });
        }
    });
}
'undefined' != typeof window &&
    Object.assign(window, { updateFilters: ir, filterData: or, handleSearch: sr, clearFilters: cr });
const dr = ['calculator', 'advisor', 'about', 'build-planner'];
function ur(e, t) {
    const n = ho('item-count');
    if (!n) return;
    if (dr.includes(t)) return void (n.style.display = 'none');
    n.style.display = '';
    const a = hc(t).length,
        i = e.length,
        o = t && t.length > 0 ? t : 'items',
        r = 1 === i ? o.slice(0, -1) : o;
    n.textContent = i === a ? `${i} ${r}` : `${i}/${a} ${r}`;
}
const hr = {
    favorites: { getMessage: () => 'No favorites yet! ❤️', buttonText: 'Browse Items', buttonAction: 'browse' },
    compare: {
        getMessage: () => 'Nothing to compare yet! 🔄',
        buttonText: 'Add Items to Compare',
        buttonAction: 'browse',
    },
    search: {
        getMessage: e => `No results for "${So(e.searchQuery || '')}" 🔍`,
        buttonText: 'Clear Search',
        buttonAction: 'clear-search',
    },
    filters: {
        getMessage: () => 'No items match these filters 🎯',
        buttonText: 'Clear Filters',
        buttonAction: 'clear-filters',
    },
    generic: { getMessage: () => 'No items found', buttonText: 'Clear Filters', buttonAction: 'clear-filters' },
};
function mr(e, t = 4) {
    const n = hc(e);
    if (!n || 0 === n.length) return [];
    const a = { SS: 0, S: 1, A: 2, B: 3, C: 4 };
    return [...n]
        .sort((e, t) => (a[e.tier || 'C'] ?? 5) - (a[t.tier || 'C'] ?? 5))
        .slice(0, t)
        .map(t => pr(t, e));
}
function pr(e, t) {
    const n = { id: e.id, name: e.name || 'Unknown', tier: e.tier, description: fr(e, t) };
    return (
        'shrines' === t && 'icon' in e ? (n.icon = e.icon) : 'image' in e && (n.image = e.image),
        'rarity' in e && (n.rarity = e.rarity),
        n
    );
}
function fr(e, t) {
    let n = '';
    switch (t) {
        case 'items':
            n = e.base_effect || e.description || '';
            break;
        case 'weapons':
            n = e.attack_pattern || e.description || '';
            break;
        case 'tomes':
            n = e.stat_affected || e.description || '';
            break;
        case 'characters':
            n = e.passive_ability || e.description || '';
            break;
        case 'shrines':
            n = e.reward || e.description || '';
            break;
        default:
            n = e.description || '';
    }
    return n.length > 60 ? n.substring(0, 57) + '...' : n;
}
function gr(e) {
    const t = ho('searchInput'),
        n = t?.value?.trim() || '',
        a = ho('favoritesOnly'),
        i = a?.checked || !1,
        o = ho('tierFilter'),
        r = ho('rarityFilter'),
        s = ho('stackingFilter'),
        c = ho('typeFilter'),
        l =
            (o?.value && 'all' !== o.value) ||
            (r?.value && 'all' !== r.value) ||
            (s?.value && 'all' !== s.value) ||
            (c?.value && 'all' !== c.value);
    if (i) {
        const t = (function (e) {
            return Io('favorites')[e] || [];
        })(e);
        if (0 === t.length) return { type: 'favorites', tabName: e };
    }
    return n.length > 0
        ? { type: 'search', tabName: e, searchQuery: n }
        : l
          ? { type: 'filters', tabName: e, hasActiveFilters: !0 }
          : { type: 'generic', tabName: e };
}
function yr(e) {
    const t = hr[e.type],
        n = t.getMessage(e),
        { buttonText: a, buttonAction: i } = t;
    let o = [];
    switch (e.type) {
        case 'favorites':
        default:
            o = mr(e.tabName, 4);
            break;
        case 'compare':
            o = (function (e, t = 4) {
                const n = hc(e);
                if (!n || 0 === n.length) return [];
                const a = {};
                n.forEach(e => {
                    const t = e.tier || 'C';
                    (a[t] || (a[t] = []), a[t].push(e));
                });
                const i = [],
                    o = ['SS', 'S', 'A', 'B'];
                for (const r of o) {
                    if (i.length >= t) break;
                    const n = a[r];
                    if (n && n.length > 0) {
                        const t = n[Math.floor(Math.random() * n.length)];
                        t && i.push(pr(t, e));
                    }
                }
                return i;
            })(e.tabName, 4);
            break;
        case 'search':
            o = (function (e, t = 4) {
                const n = hc(e);
                if (!n || 0 === n.length) return [];
                const a = n.filter(e => 'SS' === e.tier || 'S' === e.tier || 'A' === e.tier);
                return [...(a.length >= t ? a : n)]
                    .sort(() => Math.random() - 0.5)
                    .slice(0, t)
                    .map(t => pr(t, e));
            })(e.tabName, 4);
            break;
        case 'filters':
            o = (function (e, t = 4) {
                return mr(e, t);
            })(e.tabName, 4);
    }
    const r =
        o.length > 0
            ? `\n            <div class="empty-state-suggestions">\n                <span class="suggestions-label">Try these instead:</span>\n                <div class="suggestions-grid">\n                    ${o
                  .map(t =>
                      (function (e, t) {
                          const n = t.replace(/s$/, '');
                          let a = '';
                          a = e.icon
                              ? `<span class="suggestion-icon">${So(e.icon)}</span>`
                              : e.image
                                ? `<img src="${So(e.image)}" alt="${So(e.name)}" class="suggestion-image" loading="lazy" />`
                                : `<span class="suggestion-icon">${{ items: '📦', weapons: '⚔️', tomes: '📚', characters: '👤', shrines: '⛩️' }[t]}</span>`;
                          return `\n        <div class="suggestion-card" \n             data-entity-type="${n}" \n             data-entity-id="${So(e.id)}"\n             data-tab-type="${t}"\n             role="button"\n             tabindex="0">\n            <div class="suggestion-visual">\n                ${a}\n            </div>\n            <div class="suggestion-info">\n                <span class="suggestion-name">${So(e.name)}</span>\n                ${e.tier ? `<span class="suggestion-tier tier-${e.tier}">${e.tier}</span>` : ''}\n            </div>\n        </div>\n    `;
                      })(t, e.tabName)
                  )
                  .join('')}\n                </div>\n            </div>\n        `
            : '';
    return `\n        <div class="empty-state empty-state-enhanced">\n            <div class="empty-state-content">\n                <h3 class="empty-state-message">${n}</h3>\n                <button class="empty-state-action btn-primary" data-action="${i}">\n                    ${So(a)}\n                </button>\n            </div>\n            ${r}\n        </div>\n    `;
}
function vr() {
    const e = ho('searchInput');
    e && (e.value = '');
    const t = ho('favoritesOnly');
    t && (t.checked = !1);
    document.querySelectorAll('#filters select').forEach(e => {
        e.value = 'all';
    });
    const n = Io('currentTab');
    window.renderTabContent && n && window.renderTabContent(n);
}
const br = Object.freeze(
    Object.defineProperty(
        {
            __proto__: null,
            detectEmptyStateType: gr,
            generateEmptyStateWithSuggestions: yr,
            handleEmptyStateClick: function (e) {
                if (e.classList.contains('empty-state-action')) {
                    switch (e.dataset.action) {
                        case 'browse':
                        case 'clear-filters':
                            return (vr(), !0);
                        case 'clear-search':
                            return (
                                (function () {
                                    const e = ho('searchInput');
                                    if (e) {
                                        e.value = '';
                                        const t = Io('currentTab');
                                        window.renderTabContent && t && window.renderTabContent(t);
                                    }
                                })(),
                                !0
                            );
                    }
                }
                if (e.classList.contains('suggestion-card') || e.closest('.suggestion-card')) {
                    const t = e.classList.contains('suggestion-card') ? e : e.closest('.suggestion-card');
                    if (t) {
                        const e = t.dataset.entityType,
                            a = t.dataset.entityId;
                        if (e && a)
                            return (
                                n(
                                    async () => {
                                        const { openDetailModal: e } = await Promise.resolve().then(() => Ps);
                                        return { openDetailModal: e };
                                    },
                                    void 0
                                ).then(({ openDetailModal: t }) => {
                                    t(e, a);
                                }),
                                !0
                            );
                    }
                }
                return !1;
            },
        },
        Symbol.toStringTag,
        { value: 'Module' }
    )
);
function wr(e) {
    const t = ho('weaponsContainer');
    if (!t) return;
    if (0 === e.length) {
        const e = gr('weapons');
        return void (t.innerHTML = yr(e));
    }
    const n = document.createDocumentFragment();
    (e.forEach(e => {
        const t = document.createElement('div');
        ((t.className = 'item-card weapon-card clickable-card'),
            (t.tabIndex = 0),
            (t.dataset.entityType = 'weapon'),
            (t.dataset.entityId = e.id));
        const a = bo(e, e.name);
        ((t.innerHTML = `\n            <div class="item-header">\n                ${a}\n                <div class="item-title">\n                    <div class="item-name">${So(e.name)}</div>\n                    ${Co(e.tier)}\n                </div>\n                \x3c!-- DISABLED: Favorite button hidden\n                <button class="favorite-btn" data-tab="weapons" data-id="${e.id}" title="Add to favorites" aria-label="Add to favorites">\n                    ☆\n                </button>\n                --\x3e\n            </div>\n            <div class="item-effect">${So(e.attack_pattern)}</div>\n            <div class="item-description">${So(e.description)}</div>\n            <div class="item-meta">\n                ${(function (
            e,
            t = 0
        ) {
            return e && e.length
                ? (t > 0 ? e.slice(0, t) : e).map(e => `<span class="meta-tag">${So(e)}</span>`).join(' ')
                : '';
        })(
            Array.isArray(e.upgradeable_stats)
                ? e.upgradeable_stats
                : e.upgradeable_stats
                  ? [e.upgradeable_stats]
                  : null,
            4
        )}\n            </div>\n        `),
            n.appendChild(t));
    }),
        (t.innerHTML = ''),
        t.appendChild(n));
}
const _r = {
    items: { label: 'Items', icon: '📦' },
    weapons: { label: 'Weapons', icon: '⚔️' },
    tomes: { label: 'Tomes', icon: '📚' },
    characters: { label: 'Characters', icon: '👤' },
    shrines: { label: 'Shrines', icon: '⛩️' },
};
function kr(e) {
    const { type: t, item: n } = e,
        a = document.createElement('div');
    ((a.className = 'search-result-card'),
        (a.dataset.entityType = t.slice(0, -1)),
        (a.dataset.entityId = n.id),
        (a.dataset.tabType = t));
    const i = n.name || 'Unknown',
        o = n.tier || '',
        r = (function (e, t) {
            switch (t) {
                case 'items':
                    return e.base_effect || e.description || '';
                case 'weapons':
                    return e.attack_pattern || e.description || '';
                case 'tomes': {
                    const t = e;
                    return `${t.stat_affected || ''}: ${t.value_per_level || ''}`.trim() || e.description || '';
                }
                case 'characters':
                    return e.passive_ability || e.description || '';
                case 'shrines':
                    return e.reward || e.description || '';
                default:
                    return e.description || '';
            }
        })(n, t);
    let s = '';
    var c, l;
    return (
        (s = 'shrines' === t && 'icon' in n ? `<span class="search-result-icon">${n.icon}</span>` : bo(n, i)),
        (a.innerHTML = `\n        <div class="search-result-content">\n            ${s}\n            <div class="search-result-info">\n                <div class="search-result-name">${So(i)}</div>\n                ${o ? Co(o) : ''}\n                <div class="search-result-description">${So(((c = r), (l = 80), c ? (c.length <= l ? c : c.substring(0, l - 3) + '...') : ''))}</div>\n            </div>\n        </div>\n        <div class="search-result-action">\n            <span class="go-to-icon">→</span>\n        </div>\n    `),
        a
    );
}
const xr = {
    switchTab: null,
    renderTabContent: null,
    initAdvisor: null,
    applyScannedBuild: null,
    initScanBuild: null,
    initCV: null,
    initOCR: null,
    initEnhancedCV: null,
    detectItemsWithEnhancedCV: null,
    initEnhancedScanBuild: null,
    handleEnhancedHybridDetect: null,
    compareStrategiesOnImage: null,
};
function Er(e, t) {
    xr[e] = t;
}
function Sr(e, ...t) {
    const n = xr[e];
    if (n) return n(...t);
}
async function Cr(e) {
    if ('build-planner' === e) {
        const { renderBuildPlanner: t } = await n(async () => {
            const { renderBuildPlanner: e } = await import('./build-planner-B3C08AMw.js');
            return { renderBuildPlanner: e };
        }, []);
        t();
        const { initBuildPlannerScan: a } = await n(
            async () => {
                const { initBuildPlannerScan: e } = await import('./build-planner-scan-CFTSzGm7.js');
                return { initBuildPlannerScan: e };
            },
            __vite__mapDeps([0, 1, 2])
        );
        return (a(pc), void ur([], e));
    }
    if ('calculator' === e) {
        const { populateCalculatorItems: t, calculateBreakpoint: a } = await n(async () => {
            const { populateCalculatorItems: e, calculateBreakpoint: t } = await import('./calculator-NgllIFLr.js');
            return { populateCalculatorItems: e, calculateBreakpoint: t };
        }, []);
        t();
        const i = ho('calc-button');
        return (
            i && !i.dataset.listenerAttached && (i.addEventListener('click', a), (i.dataset.listenerAttached = 'true')),
            void ur([], e)
        );
    }
    if ('advisor' === e) return void ur([], e);
    if ('changelog' === e) {
        const { updateChangelogStats: t, renderChangelog: a } = await n(async () => {
                const { updateChangelogStats: e, renderChangelog: t } = await import('./changelog-C90nu2gf.js');
                return { updateChangelogStats: e, renderChangelog: t };
            }, []),
            i = or(hc(e), e);
        return (Lo('filteredData', i), t(i), void a(i));
    }
    if ('about' === e) {
        const { renderAbout: e, updateAboutStats: t } = await n(async () => {
            const { renderAbout: e, updateAboutStats: t } = await import('./about-Ctd5msV9.js');
            return { renderAbout: e, updateAboutStats: t };
        }, []);
        return (t(), void e());
    }
    const t = hc(e);
    if (!t) return;
    const a = or(t, e);
    switch ((Lo('filteredData', a), ur(a, e), e)) {
        case 'items':
            await (async function (e) {
                const t = ho('itemsContainer');
                if (!t) return;
                if (0 === e.length) {
                    const e = gr('items');
                    return void (t.innerHTML = yr(e));
                }
                let a = [];
                if (io.COMPARE_ITEMS) {
                    const { getCompareItems: e } = await n(async () => {
                        const { getCompareItems: e } = await import('./compare-BOHXXp8r.js');
                        return { getCompareItems: e };
                    }, []);
                    a = e();
                }
                const i = document.createDocumentFragment();
                (e.forEach(e => {
                    const t = document.createElement('div');
                    ((t.className = `item-card rarity-${e.rarity} clickable-card`),
                        (t.tabIndex = 0),
                        (t.dataset.entityType = 'item'),
                        (t.dataset.entityId = e.id));
                    const n = e.one_and_done ? 'One-and-Done' : e.stacks_well ? 'Stacks Well' : 'Limited',
                        o = e.one_and_done ? 'tag-one-and-done' : e.stacks_well ? 'tag-stacks-well' : 'tag-limited',
                        r = bo(e, e.name),
                        s =
                            e.scaling_per_stack && !e.one_and_done && 'flat' !== e.graph_type
                                ? `\n            <div class="item-graph-container">\n                <canvas id="chart-${e.id}" class="scaling-chart"></canvas>\n            </div>\n        `
                                : `\n            <div class="item-graph-placeholder">\n                <span>${e.one_and_done ? 'One-and-done: no scaling benefit from stacks' : 'Flat bonus: does not scale'}</span>\n            </div>\n        `,
                        {
                            html: c,
                            needsExpand: l,
                            fullText: d,
                        } = (function (e, t = 120) {
                            return !e || e.length <= t
                                ? { html: e || '', needsExpand: !1, fullText: e || '' }
                                : { html: e.substring(0, t) + '...', needsExpand: !0, fullText: e };
                        })(e.detailed_description, 120),
                        u = io.COMPARE_ITEMS
                            ? `<label class="compare-checkbox-label" title="Add to comparison">\n                    <input type="checkbox" class="compare-checkbox" data-id="${e.id}" ${a.includes(e.id) ? 'checked' : ''}>\n                    <span>+</span>\n                </label>`
                            : '';
                    ((t.innerHTML = `\n            <div class="item-header">\n                ${r}\n                <div class="item-title">\n                    <div class="item-name">${So(e.name)}</div>\n                    ${Co(e.tier)}\n                </div>\n                ${u}\n            </div>\n            <div class="item-effect">${So(e.base_effect)}</div>\n            <div class="item-description ${l ? 'expandable-text' : ''}"\n                 ${l ? `data-full-text="${So(d)}" data-truncated="true"` : ''}>\n                ${c}\n                ${l ? '<span class="expand-indicator">Click to expand</span>' : ''}\n            </div>\n            <div class="item-meta">\n                <span class="meta-tag ${o}">${n}</span>\n            </div>\n            ${s}\n        `),
                        i.appendChild(t));
                }),
                    (t.innerHTML = ''),
                    t.appendChild(i),
                    lr('initializeItemCharts', 'item_tab_render'));
            })(a);
            break;
        case 'weapons':
            wr(a);
            break;
        case 'tomes':
            !(function (e) {
                const t = ho('tomesContainer');
                if (!t) return;
                if (0 === e.length) {
                    const e = gr('tomes');
                    return void (t.innerHTML = yr(e));
                }
                const n = document.createDocumentFragment();
                (e.forEach(e => {
                    const t = document.createElement('div');
                    ((t.className = 'item-card tome-card clickable-card'),
                        (t.tabIndex = 0),
                        (t.dataset.entityType = 'tome'),
                        (t.dataset.entityId = e.id));
                    const a = bo(e, e.name),
                        i = 'number' == typeof e.value_per_level ? String(e.value_per_level) : e.value_per_level,
                        o =
                            i && /[+-]?[\d.]+/.test(i)
                                ? `\n            <div class="tome-graph-container">\n                <canvas id="tome-chart-${e.id}" class="scaling-chart"></canvas>\n            </div>\n        `
                                : '\n            <div class="tome-graph-placeholder">\n                <span>No progression data available</span>\n            </div>\n        ';
                    ((t.innerHTML = `\n            <div class="item-header">\n                ${a}\n                <div class="item-title">\n                    <div class="item-name">${So(e.name)}</div>\n                    <span class="tier-label">${e.tier} Tier · Priority ${e.priority}</span>\n                </div>\n                \x3c!-- DISABLED: Favorite button hidden\n                <button class="favorite-btn" data-tab="tomes" data-id="${e.id}" title="Add to favorites" aria-label="Add to favorites">\n                    ☆\n                </button>\n                --\x3e\n            </div>\n            <div class="item-effect">${So(e.stat_affected)}: ${So(String(e.value_per_level))}</div>\n            <div class="item-description">${So(e.description)}</div>\n            ${o}\n        `),
                        n.appendChild(t));
                }),
                    (t.innerHTML = ''),
                    t.appendChild(n),
                    lr('initializeTomeCharts', 'tome_tab_render'));
            })(a);
            break;
        case 'characters':
            !(function (e) {
                const t = ho('charactersContainer');
                if (!t) return;
                if (0 === e.length) {
                    const e = gr('characters');
                    return void (t.innerHTML = yr(e));
                }
                const n = document.createDocumentFragment();
                (e.forEach(e => {
                    const t = document.createElement('div');
                    ((t.className = 'item-card character-card clickable-card'),
                        (t.tabIndex = 0),
                        (t.dataset.entityType = 'character'),
                        (t.dataset.entityId = e.id));
                    const a = bo(e, e.name);
                    ((t.innerHTML = `\n            <div class="item-header">\n                ${a}\n                <div class="item-title">\n                    <div class="item-name">${So(e.name)}</div>\n                    ${Co(e.tier)}\n                </div>\n                \x3c!-- DISABLED: Favorite button hidden\n                <button class="favorite-btn" data-tab="characters" data-id="${e.id}" title="Add to favorites" aria-label="Add to favorites">\n                    ☆\n                </button>\n                --\x3e\n            </div>\n            <div class="item-effect">${So(e.passive_ability)}</div>\n            <div class="item-description">${So(e.passive_description)}</div>\n            <div class="item-meta">\n                <span class="meta-tag">${So(e.starting_weapon)}</span>\n                <span class="meta-tag">${So(e.playstyle)}</span>\n            </div>\n        `),
                        n.appendChild(t));
                }),
                    (t.innerHTML = ''),
                    t.appendChild(n));
            })(a);
            break;
        case 'shrines':
            !(function (e) {
                const t = ho('shrinesContainer');
                if (!t) return;
                if (0 === e.length) {
                    const e = gr('shrines');
                    return void (t.innerHTML = yr(e));
                }
                const n = document.createDocumentFragment();
                (e.forEach(e => {
                    const t = document.createElement('div');
                    ((t.className = 'item-card shrine-card clickable-card'),
                        (t.tabIndex = 0),
                        (t.dataset.entityType = 'shrine'),
                        (t.dataset.entityId = e.id),
                        (t.innerHTML = `\n            <div class="item-header">\n                <span class="shrine-icon-large">${So(e.icon || '')}</span>\n                <div class="item-title">\n                    <div class="item-name">${So(e.name)}</div>\n                    ${e.type ? `<span class="tier-label">${So(e.type.replace('_', ' '))}</span>` : ''}\n                </div>\n                \x3c!-- DISABLED: Favorite button hidden\n                <button class="favorite-btn" data-tab="shrines" data-id="${So(e.id)}" title="Add to favorites" aria-label="Add to favorites">\n                    ☆\n                </button>\n                --\x3e\n            </div>\n            <div class="item-effect">${So(e.description)}</div>\n            <div class="item-description">${e.reward ? So(e.reward) : ''}</div>\n            <div class="item-meta">\n                ${void 0 !== e.reusable ? (e.reusable ? '<span class="meta-tag">Reusable</span>' : '<span class="meta-tag">One-time</span>') : ''}\n            </div>\n        `),
                        n.appendChild(t));
                }),
                    (t.innerHTML = ''),
                    t.appendChild(n));
            })(a);
    }
}
(Er('renderTabContent', Cr),
    'undefined' != typeof window &&
        ((window.renderTabContent = Cr),
        (window.renderGlobalSearchResults = function (e, t, n) {
            const a = document.querySelector('.tab-content.active'),
                i = a?.querySelector('.items-grid, .items-container') || ho('itemsContainer');
            if (!i) return;
            const o = ho('item-count');
            if (
                (o && (o.textContent = `${e.length} results across all categories`), (i.innerHTML = ''), 0 === e.length)
            ) {
                const e = Io('currentTab'),
                    t = {
                        type: 'search',
                        tabName: ['items', 'weapons', 'tomes', 'characters', 'shrines'].includes(e) ? e : 'items',
                        searchQuery: n || '',
                    };
                return void (i.innerHTML = yr(t));
            }
            const r = new Map();
            for (const l of e) {
                const e = r.get(l.type) || [];
                e.length < 10 && (e.push(l), r.set(l.type, e));
            }
            const s = ['items', 'weapons', 'tomes', 'characters', 'shrines'];
            let c;
            if (t && s.includes(t)) {
                const e = t;
                c = [e, ...s.filter(t => t !== e)];
            } else c = s;
            for (const l of c) {
                const e = r.get(l);
                if (!e || 0 === e.length) continue;
                const { label: n, icon: a } = _r[l],
                    o = l === t,
                    s = document.createElement('div');
                ((s.className = 'global-search-section-header' + (o ? ' current-tab-section' : '')),
                    (s.innerHTML = `\n            <span class="section-icon">${a}</span>\n            <span class="section-title">${n}${o ? ' (Current Tab)' : ''}</span>\n            <span class="section-count">(${e.length})</span>\n        `),
                    i.appendChild(s));
                const c = document.createElement('div');
                ((c.className = 'global-search-section' + (o ? ' current-tab-results' : '')), (c.dataset.type = l));
                for (const t of e) {
                    const e = kr(t);
                    c.appendChild(e);
                }
                i.appendChild(c);
            }
        })));
function $r(e = !1) {
    return `\n        <div class="skeleton-card skeleton-card--item">\n            \x3c!-- Header: image + title area --\x3e\n            <div class="skeleton-header">\n                <div class="skeleton-element skeleton-image"></div>\n                <div class="skeleton-title">\n                    <div class="skeleton-element skeleton-name"></div>\n                    <div class="skeleton-badges">\n                        <div class="skeleton-element skeleton-badge"></div>\n                        <div class="skeleton-element skeleton-badge skeleton-badge--small"></div>\n                    </div>\n                </div>\n            </div>\n            \n            \x3c!-- Effect text (main content) --\x3e\n            <div class="skeleton-element skeleton-text skeleton-effect"></div>\n            <div class="skeleton-element skeleton-text skeleton-effect short"></div>\n            \n            \x3c!-- Description --\x3e\n            <div class="skeleton-element skeleton-text skeleton-description"></div>\n            \n            \x3c!-- Meta tags --\x3e\n            <div class="skeleton-meta">\n                <div class="skeleton-element skeleton-tag"></div>\n                <div class="skeleton-element skeleton-tag"></div>\n                <div class="skeleton-element skeleton-tag skeleton-tag--small"></div>\n            </div>\n            \n            ${e ? '<div class="skeleton-graph">\n               <div class="skeleton-element" style="height: 150px; margin-top: 1rem; border-radius: 6px;"></div>\n           </div>' : ''}\n            \n            \x3c!-- View details button --\x3e\n            <div class="skeleton-element skeleton-button"></div>\n        </div>\n    `;
}
function Mr() {
    return '\n        <div class="skeleton-card skeleton-card--character">\n            \x3c!-- Header with larger image --\x3e\n            <div class="skeleton-header">\n                <div class="skeleton-element skeleton-image skeleton-image--large"></div>\n                <div class="skeleton-title">\n                    <div class="skeleton-element skeleton-name"></div>\n                    <div class="skeleton-element skeleton-subtitle"></div>\n                </div>\n            </div>\n            \n            \x3c!-- Stats grid --\x3e\n            <div class="skeleton-stats">\n                <div class="skeleton-stat-row">\n                    <div class="skeleton-element skeleton-stat-label"></div>\n                    <div class="skeleton-element skeleton-stat-value"></div>\n                </div>\n                <div class="skeleton-stat-row">\n                    <div class="skeleton-element skeleton-stat-label"></div>\n                    <div class="skeleton-element skeleton-stat-value"></div>\n                </div>\n                <div class="skeleton-stat-row">\n                    <div class="skeleton-element skeleton-stat-label"></div>\n                    <div class="skeleton-element skeleton-stat-value"></div>\n                </div>\n            </div>\n            \n            \x3c!-- Description --\x3e\n            <div class="skeleton-element skeleton-text"></div>\n            \n            \x3c!-- Button --\x3e\n            <div class="skeleton-element skeleton-button"></div>\n        </div>\n    ';
}
function Tr() {
    return '\n        <div class="skeleton-card skeleton-card--shrine">\n            \x3c!-- Header --\x3e\n            <div class="skeleton-header skeleton-header--centered">\n                <div class="skeleton-element skeleton-image skeleton-image--shrine"></div>\n                <div class="skeleton-element skeleton-name skeleton-name--centered"></div>\n            </div>\n            \n            \x3c!-- Effect description --\x3e\n            <div class="skeleton-element skeleton-text"></div>\n            <div class="skeleton-element skeleton-text short"></div>\n            \n            \x3c!-- Button --\x3e\n            <div class="skeleton-element skeleton-button"></div>\n        </div>\n    ';
}
function Ar() {
    return '\n        <div class="skeleton-card skeleton-card--weapon">\n            \x3c!-- Header --\x3e\n            <div class="skeleton-header">\n                <div class="skeleton-element skeleton-image"></div>\n                <div class="skeleton-title">\n                    <div class="skeleton-element skeleton-name"></div>\n                    <div class="skeleton-badges">\n                        <div class="skeleton-element skeleton-badge"></div>\n                    </div>\n                </div>\n            </div>\n            \n            \x3c!-- Weapon stats --\x3e\n            <div class="skeleton-weapon-stats">\n                <div class="skeleton-element skeleton-stat-bar"></div>\n                <div class="skeleton-element skeleton-stat-bar skeleton-stat-bar--short"></div>\n            </div>\n            \n            \x3c!-- Description --\x3e\n            <div class="skeleton-element skeleton-text"></div>\n            <div class="skeleton-element skeleton-text short"></div>\n            \n            \x3c!-- Meta tags --\x3e\n            <div class="skeleton-meta">\n                <div class="skeleton-element skeleton-tag"></div>\n                <div class="skeleton-element skeleton-tag"></div>\n            </div>\n            \n            \x3c!-- Button --\x3e\n            <div class="skeleton-element skeleton-button"></div>\n        </div>\n    ';
}
function Ir(e, t, n = 6) {
    const a = ho(e);
    if (!a) return;
    a.dataset.hadContent = a.innerHTML.length > 0 ? 'true' : 'false';
    const i = (function (e) {
            switch (e) {
                case 'items':
                case 'tomes':
                    return () => $r(!0);
                case 'weapons':
                    return Ar;
                case 'characters':
                    return Mr;
                case 'shrines':
                    return Tr;
                default:
                    return () => $r(!1);
            }
        })(t),
        o = Array(n)
            .fill(null)
            .map(() => i())
            .join('');
    ((a.innerHTML = `<div class="skeleton-container">${o}</div>`),
        a.setAttribute('aria-busy', 'true'),
        a.setAttribute('aria-label', 'Loading content'));
}
function Lr(e) {
    const t = ho(e);
    if (!t) return;
    const n = t.querySelector('.skeleton-container');
    (n && n.remove(), t.removeAttribute('aria-busy'), t.removeAttribute('aria-label'));
}
function zr(e) {
    const t = {
        items: { id: 'itemsContainer', count: 8 },
        weapons: { id: 'weaponsContainer', count: 6 },
        tomes: { id: 'tomesContainer', count: 6 },
        characters: { id: 'charactersContainer', count: 6 },
        shrines: { id: 'shrinesContainer', count: 4 },
    }[e];
    t && Ir(t.id, e, t.count);
}
'undefined' != typeof window &&
    Object.assign(window, {
        showSkeletonLoading: function (e, t = 6, n = !1) {
            const a = ho(e);
            if (!a) return;
            a.dataset.hadContent = a.innerHTML.length > 0 ? 'true' : 'false';
            const i = Array(t)
                .fill(null)
                .map(() => $r(n))
                .join('');
            ((a.innerHTML = `<div class="skeleton-container">${i}</div>`),
                a.setAttribute('aria-busy', 'true'),
                a.setAttribute('aria-label', 'Loading content'));
        },
        showTabSkeletonLoading: Ir,
        hideSkeletonLoading: Lr,
        showTabSkeleton: zr,
        hideTabSkeleton: function (e) {
            const t = {
                items: 'itemsContainer',
                weapons: 'weaponsContainer',
                tomes: 'tomesContainer',
                characters: 'charactersContainer',
                shrines: 'shrinesContainer',
            }[e];
            t && Lr(t);
        },
    });
const Dr = new Map();
async function Fr() {
    (await n(() => import('./compare-BOHXXp8r.js'), []),
        zi.debug({ operation: 'tab_loader.loaded', data: { module: 'compare' } }));
}
async function Or() {
    (await n(() => import('./charts-DLj1O0Ua.js'), []),
        zi.debug({ operation: 'tab_loader.loaded', data: { module: 'charts' } }));
}
const Rr = {
    'build-planner': [
        async function () {
            (await n(() => import('./build-planner-B3C08AMw.js'), []),
                zi.debug({ operation: 'tab_loader.loaded', data: { module: 'build-planner' } }));
        },
    ],
    calculator: [
        async function () {
            (await n(() => import('./calculator-NgllIFLr.js'), []),
                zi.debug({ operation: 'tab_loader.loaded', data: { module: 'calculator' } }));
        },
    ],
    advisor: [
        async function () {
            (await n(() => import('./scan-build-9a7G2FoA.js'), __vite__mapDeps([3, 1])),
                await n(() => import('./advisor-COp3LDoi.js'), []));
            const { getState: e } = await n(
                    async () => {
                        const { getState: e } = await Promise.resolve().then(() => Do);
                        return { getState: e };
                    },
                    void 0
                ),
                t = e('allData'),
                a = window;
            ('function' == typeof a.initScanBuild && t && Object.keys(t).length > 0 && a.initScanBuild(t),
                zi.debug({ operation: 'tab_loader.loaded', data: { module: 'advisor' } }));
        },
    ],
    changelog: [
        async function () {
            (await n(() => import('./changelog-C90nu2gf.js'), []),
                zi.debug({ operation: 'tab_loader.loaded', data: { module: 'changelog' } }));
        },
    ],
    items: [Or, Fr],
    tomes: [Or],
};
async function Pr(e) {
    const t = e.name || e.toString().slice(0, 50),
        n = Dr.get(t);
    if (n?.loaded) return;
    if (n?.loading) return n.loading;
    const a = e();
    Dr.set(t, { loaded: !1, loading: a, error: null });
    try {
        (await a, Dr.set(t, { loaded: !0, loading: null, error: null }));
    } catch (i) {
        throw (Dr.set(t, { loaded: !1, loading: null, error: i }), i);
    }
}
function Nr() {
    ('undefined' != typeof requestIdleCallback ? requestIdleCallback : e => setTimeout(e, 1e3))(() => {
        Pr(Fr).catch(() => {});
    });
}
const Br = 'megabonk-current-tab',
    jr = [
        'items',
        'weapons',
        'tomes',
        'characters',
        'shrines',
        'build-planner',
        'calculator',
        'advisor',
        'changelog',
        'about',
    ];
let qr = 0;
let Hr = !1;
function Zr(e) {
    (document.querySelectorAll('.tab-btn').forEach(t => {
        const n = t.getAttribute('data-tab') === e;
        (t.classList.toggle('active', n), t.setAttribute('aria-selected', n ? 'true' : 'false'));
    }),
        document.querySelectorAll('.tab-content').forEach(e => {
            e.classList.remove('active');
        }));
    const t = document.getElementById(`${e}-tab`);
    (t && t.classList.add('active'),
        ir(e),
        (function (e) {
            if (e && !Zo.includes(e))
                try {
                    const t = Uo()[e];
                    if (
                        !t ||
                        !(function (e) {
                            if (!e || 'object' != typeof e) return !1;
                            const t = e;
                            return !(
                                (void 0 !== t.search && 'string' != typeof t.search) ||
                                (void 0 !== t.favoritesOnly && 'boolean' != typeof t.favoritesOnly) ||
                                (void 0 !== t.tierFilter && 'string' != typeof t.tierFilter) ||
                                (void 0 !== t.sortBy && 'string' != typeof t.sortBy) ||
                                (void 0 !== t.rarityFilter && 'string' != typeof t.rarityFilter) ||
                                (void 0 !== t.stackingFilter && 'string' != typeof t.stackingFilter)
                            );
                        })(t)
                    )
                        return;
                    const n = ho('searchInput');
                    lo(n) && 'string' == typeof t.search && (n.value = t.search);
                    const a = ho('favoritesOnly');
                    lo(a) && 'boolean' == typeof t.favoritesOnly && (a.checked = t.favoritesOnly);
                    const i = ho('tierFilter');
                    uo(i) && 'string' == typeof t.tierFilter && (i.value = t.tierFilter);
                    const o = ho('sortBy');
                    if ((uo(o) && 'string' == typeof t.sortBy && (o.value = t.sortBy), 'items' === e)) {
                        const e = ho('rarityFilter');
                        uo(e) && 'string' == typeof t.rarityFilter && (e.value = t.rarityFilter);
                        const n = ho('stackingFilter');
                        uo(n) && 'string' == typeof t.stackingFilter && (n.value = t.stackingFilter);
                    }
                } catch (t) {}
        })(e));
}
async function Ur(e) {
    zr(e);
    try {
        await (async function (e) {
            const t = Rr[e];
            if (!t || 0 === t.length) return;
            const n = performance.now(),
                a = t.map(e => Pr(e));
            try {
                await Promise.all(a);
                const i = Math.round(performance.now() - n);
                i > 50 &&
                    zi.debug({
                        operation: 'tab_loader.complete',
                        durationMs: i,
                        data: { tabName: e, moduleCount: t.length },
                    });
            } catch (i) {
                throw (
                    zi.error({
                        operation: 'tab_loader.error',
                        error: { name: i.name, message: i.message, module: 'tab-loader' },
                        data: { tabName: e },
                    }),
                    i
                );
            }
        })(e);
    } catch (t) {
        zi.error({
            operation: 'tab.module_load_failed',
            error: { name: t.name, message: t.message, module: 'events-tabs' },
            data: { tabName: e },
        });
    }
    await Cr(e);
}
async function Vr(e) {
    if (
        (function (e) {
            return jr.includes(e)
                ? !(
                      Date.now() - qr < 100 ||
                      (Hr &&
                          (zi.info({
                              operation: 'tab.switch.skipped',
                              data: { reason: 'switch_in_progress', requestedTab: e },
                          }),
                          1))
                  )
                : (zi.warn({
                      operation: 'tab.switch',
                      error: { name: 'InvalidTabError', message: `Invalid tab name: ${e}` },
                  }),
                  !1);
        })(e)
    ) {
        ((Hr = !0), (qr = Date.now()));
        try {
            const t = Io('currentTab');
            if (
                t === e &&
                (document.querySelector('#itemsContainer .item-card') ||
                    document.querySelector('#weaponsContainer .item-card') ||
                    document.querySelector('#tomesContainer .item-card'))
            )
                return;
            (await (async function (e) {
                e && Vo(e);
                try {
                    const { destroyAllCharts: e } = await n(async () => {
                        const { destroyAllCharts: e } = await import('./charts-DLj1O0Ua.js');
                        return { destroyAllCharts: e };
                    }, []);
                    e();
                } catch {}
            })(t),
                (function (e, t) {
                    (Lo('currentTab', e), localStorage.setItem(Br, e), zi.setContext('currentTab', e));
                    let n = 0;
                    if ('undefined' != typeof allData && allData) {
                        const t = {
                            items: allData.items?.items,
                            weapons: allData.weapons?.weapons,
                            tomes: allData.tomes?.tomes,
                            characters: allData.characters?.characters,
                            shrines: allData.shrines?.shrines,
                        }[e];
                        Array.isArray(t) && (n = t.length);
                    }
                    zi.info({ operation: 'tab.switch', data: { fromTab: t, toTab: e, itemCount: n } });
                })(e, t),
                Zr(e),
                await Ur(e));
        } finally {
            Hr = !1;
        }
    }
}
(Io('currentTab'), Er('switchTab', Vr), 'undefined' != typeof window && (window.switchTab = Vr));
const Wr = 'megabonk-recently-viewed',
    Jr = ['items', 'weapons', 'tomes', 'characters', 'shrines'];
let Kr = [];
function Gr() {
    try {
        localStorage.setItem(Wr, JSON.stringify(Kr));
    } catch (e) {
        zi.warn({
            operation: 'recently-viewed.save',
            error: { name: 'StorageError', message: 'Failed to save recently viewed', module: 'recently-viewed' },
        });
    }
}
function Yr(e, t) {
    !(function (e, t) {
        Jr.includes(e) &&
            ((Kr = Kr.filter(n => !(n.type === e && n.id === t))),
            Kr.unshift({ type: e, id: t, timestamp: Date.now() }),
            Kr.length > 10 && (Kr = Kr.slice(0, 10)),
            Gr());
    })(e, t);
}
function Xr() {
    (!(function () {
        try {
            const e = localStorage.getItem(Wr);
            if (e) {
                Kr = JSON.parse(e);
                const t = Date.now() - 6048e5;
                ((Kr = Kr.filter(e => e.timestamp > t)), Gr());
            }
        } catch (e) {
            (zi.warn({
                operation: 'recently-viewed.load',
                error: { name: 'StorageError', message: 'Failed to load recently viewed', module: 'recently-viewed' },
            }),
                (Kr = []));
        }
    })(),
        zi.info({ operation: 'recently-viewed.init', data: { count: Kr.length } }));
}
function Qr(e) {
    return e && 'object' == typeof e && 'base_effect' in e;
}
function es(e) {
    return e && 'object' == typeof e && 'attack_pattern' in e;
}
function ts(e) {
    return e && 'object' == typeof e && 'stat_affected' in e;
}
function ns(e) {
    return e && 'object' == typeof e && 'passive_ability' in e;
}
const as = { maxResults: 5, minScore: 0.2 },
    is = [
        'damage',
        'crit',
        'attack speed',
        'hp',
        'health',
        'armor',
        'defence',
        'dodge',
        'knockback',
        'pierce',
        'burn',
        'freeze',
        'poison',
        'lifesteal',
        'area',
        'range',
        'projectile',
        'explosion',
        'chain',
        'bounce',
    ];
function os(e, t) {
    if (e.id === t.id) return { score: 0, reasons: [] };
    let n = 0;
    const a = [],
        i = e.tier === t.tier,
        o = e.rarity === t.rarity;
    if (!i && !o) {
        const n = (e.base_effect || '').toLowerCase(),
            a = (t.base_effect || '').toLowerCase();
        if (!is.some(e => n.includes(e) && a.includes(e)) && !e.synergies?.some(e => t.synergies?.includes(e)))
            return { score: 0, reasons: [] };
    }
    if (
        (i && ((n += 0.25), a.push(`Same tier (${e.tier})`)),
        o && ((n += 0.15), a.push('Same rarity')),
        e.one_and_done === t.one_and_done && ((n += 0.1), e.one_and_done && a.push('Both one-and-done')),
        e.stacks_well === t.stacks_well && e.stacks_well && ((n += 0.1), a.push('Both stack well')),
        e.synergies?.length && t.synergies?.length)
    ) {
        const i = e.synergies.filter(e => e.length > 0 && t.synergies?.includes(e));
        i.length > 0 && ((n += Math.min(0.15 * i.length, 0.3)), a.push('Shared synergies'));
    }
    const r = (e.base_effect || '').toLowerCase(),
        s = (t.base_effect || '').toLowerCase(),
        c = is.filter(e => r.includes(e) && s.includes(e));
    return (
        c.length > 0 && ((n += Math.min(0.1 * c.length, 0.3)), a.push(`Similar effects (${c[0] ?? 'shared'})`)),
        e.scaling_formula_type && e.scaling_formula_type === t.scaling_formula_type && (n += 0.1),
        { score: n, reasons: a }
    );
}
function rs(e, t) {
    if (e.id === t.id) return { score: 0, reasons: [] };
    const n = e.tier === t.tier,
        a = e.playstyle === t.playstyle;
    if (!n && !a) {
        const n = e.best_for?.some(e => t.best_for?.includes(e));
        if (!n) return { score: 0, reasons: [] };
    }
    let i = 0;
    const o = [];
    (n && ((i += 0.3), o.push(`Same tier (${e.tier})`)), a && ((i += 0.25), o.push('Same playstyle')));
    const r = (e.attack_pattern || '').toLowerCase(),
        s = (t.attack_pattern || '').toLowerCase();
    if (
        (['melee', 'ranged', 'projectile', 'aoe', 'single target', 'multi-hit'].filter(
            e => r.includes(e) && s.includes(e)
        ).length > 0 && ((i += 0.2), o.push('Similar attack style')),
        e.best_for && t.best_for)
    ) {
        const n = e.best_for.filter(e => e.length > 0 && t.best_for?.includes(e));
        n.length > 0 && ((i += Math.min(0.15 * n.length, 0.25)), o.push('Similar use cases'));
    }
    return { score: i, reasons: o };
}
function ss(e, t) {
    if (e.id === t.id) return { score: 0, reasons: [] };
    const n = e.tier === t.tier,
        a = e.stat_affected === t.stat_affected,
        i = Math.abs((e.priority || 0) - (t.priority || 0));
    if (!n && !a && i > 2) return { score: 0, reasons: [] };
    let o = 0;
    const r = [];
    (n && ((o += 0.25), r.push(`Same tier (${e.tier})`)),
        i <= 1 && ((o += 0.2), r.push('Similar priority')),
        a && e.stat_affected && ((o += 0.35), r.push(`Same stat (${e.stat_affected})`)));
    const s = {
        offensive: ['damage', 'crit', 'attack speed'],
        defensive: ['hp', 'armor', 'dodge'],
        utility: ['movement', 'cooldown', 'experience'],
    };
    for (const [c, l] of Object.entries(s)) {
        const n = (e.stat_affected || '').toLowerCase(),
            a = (t.stat_affected || '').toLowerCase(),
            i = l.some(e => n.includes(e)),
            s = l.some(e => a.includes(e));
        if (i && s && e.stat_affected !== t.stat_affected) {
            ((o += 0.15), r.push(`Both ${c}`));
            break;
        }
    }
    return { score: o, reasons: r };
}
function cs(e, t) {
    if (e.id === t.id) return { score: 0, reasons: [] };
    const n = e.tier === t.tier,
        a = e.playstyle === t.playstyle;
    if (!n && !a) {
        const n = e.synergies_items?.some(e => t.synergies_items?.includes(e));
        if (!n) return { score: 0, reasons: [] };
    }
    let i = 0;
    const o = [];
    if (
        (n && ((i += 0.25), o.push(`Same tier (${e.tier})`)),
        a && ((i += 0.35), o.push('Same playstyle')),
        e.synergies_items && t.synergies_items)
    ) {
        const n = e.synergies_items.filter(e => e.length > 0 && t.synergies_items?.includes(e));
        n.length > 0 && ((i += Math.min(0.1 * n.length, 0.2)), o.push('Similar item synergies'));
    }
    const r = (e.passive_description || '').toLowerCase(),
        s = (t.passive_description || '').toLowerCase();
    return (
        ['damage', 'crit', 'hp', 'speed', 'armor', 'lifesteal'].filter(e => r.includes(e) && s.includes(e)).length >
            0 && ((i += 0.15), o.push('Similar passive')),
        { score: i, reasons: o }
    );
}
function ls(e, t) {
    const n = (function (e, t, n = {}) {
        const { maxResults: a, minScore: i } = { ...as, ...n };
        let o,
            r = [];
        switch (e) {
            case 'items': {
                const e = pc.items?.items;
                ((o = e ? e.find(e => e.id === t) : void 0), (r = (e || []).map(e => ({ entity: e, type: 'items' }))));
                break;
            }
            case 'weapons': {
                const e = pc.weapons?.weapons;
                ((o = e ? e.find(e => e.id === t) : void 0),
                    (r = (e || []).map(e => ({ entity: e, type: 'weapons' }))));
                break;
            }
            case 'tomes': {
                const e = pc.tomes?.tomes;
                ((o = e ? e.find(e => e.id === t) : void 0), (r = (e || []).map(e => ({ entity: e, type: 'tomes' }))));
                break;
            }
            case 'characters': {
                const e = pc.characters?.characters;
                ((o = e ? e.find(e => e.id === t) : void 0),
                    (r = (e || []).map(e => ({ entity: e, type: 'characters' }))));
                break;
            }
            default:
                return [];
        }
        if (!o)
            return (
                zi.warn({ operation: 'similar-items.find', data: { type: e, id: t, reason: 'source_not_found' } }),
                []
            );
        const s = [];
        for (const c of r) {
            let t;
            switch (e) {
                case 'items':
                    if (!Qr(o) || !Qr(c.entity)) continue;
                    t = os(o, c.entity);
                    break;
                case 'weapons':
                    if (!es(o) || !es(c.entity)) continue;
                    t = rs(o, c.entity);
                    break;
                case 'tomes':
                    if (!ts(o) || !ts(c.entity)) continue;
                    t = ss(o, c.entity);
                    break;
                case 'characters':
                    if (!ns(o) || !ns(c.entity)) continue;
                    t = cs(o, c.entity);
                    break;
                default:
                    continue;
            }
            t.score >= i && s.push({ entity: c.entity, type: c.type, score: t.score, reasons: t.reasons });
        }
        return s.sort((e, t) => t.score - e.score).slice(0, a);
    })(e, t);
    if (0 === n.length) return '';
    return `\n        <div class="similar-items-section">\n            <h3>💡 Items Like This</h3>\n            <div class="similar-items-grid">\n                ${n
        .map(e => {
            const t = bo(e.entity, e.entity.name || 'Unknown', 'similar-item-image'),
                n = e.reasons[0] || 'Similar',
                a = So(e.entity.name || 'Unknown');
            return `\n            <div class="similar-item-card" data-type="${e.type}" data-id="${e.entity.id}" \n                 role="button" tabindex="0" aria-label="View ${a}: ${So(n)}">\n                ${t || '<span class="similar-item-icon">📦</span>'}\n                <div class="similar-item-name">${a}</div>\n                <div class="similar-item-reason">${So(n)}</div>\n            </div>\n        `;
        })
        .join('')}\n            </div>\n        </div>\n    `;
}
const ds = [
    'Damage Multiplier',
    'Attack Speed Bonus',
    'Total Proc Chance',
    'Explosion Chance',
    'Lightning Chance',
    'Dragonfire Chance',
    'Movement Speed',
    'Number of Lives',
    'Enemies Cursed',
    'Freeze Chance',
    'Poison Chance',
    'Bloodmark Chance',
    'Megacrit Chance',
    'Attack Speed',
    'Crit Chance',
    'Stack Count',
    'Current HP%',
    'Max HP%',
    'Overheal',
    'Lifesteal',
    'Base HP',
    'Max HP',
    'Internal',
    'Stacks',
    'Radius',
    'Damage',
    'Evasion',
    'Poison',
    'Speed',
    'Kills',
    'Regen',
    'Base',
    'HP',
];
function us(e) {
    return e
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
function hs(e, t) {
    return `<span class="formula-fraction"><span class="formula-num">${ms(us(e.trim()))}</span><span class="formula-den">${ms(us(t.trim()))}</span></span>`;
}
function ms(e) {
    let t = e;
    const n = [],
        a = [...ds].sort((e, t) => t.length - e.length);
    for (const i of a) {
        const e = us(i),
            a = new RegExp(`\\b${e}\\b`, 'g');
        t = t.replace(a, () => {
            const t = `__VAR_${n.length}__`;
            return (n.push(`<span class="formula-var">${e}</span>`), t);
        });
    }
    for (let i = 0; i < n.length; i++) t = t.replace(`__VAR_${i}__`, n[i] ?? '');
    return t;
}
function ps(e) {
    if (!e) return '';
    if (!/[=×÷+\-*/]/.test(e)) return `<span class="formula-text">${us(e)}</span>`;
    let t = us(e);
    ((t = e),
        (t = (function (e) {
            let t = e;
            return (
                (t = t.replace(/(\w+(?:\s*[%×*]?\s*\w+)*)\s*\/\s*\(([^)]+)\)/g, (e, t, n) => hs(t, `(${n})`))),
                (t = t.replace(/(\d+(?:\.\d+)?|\w+)\s*\/\s*(\d+(?:\.\d+)?)/g, (e, t, n) =>
                    /^[a-zA-Z]+\/[a-zA-Z]+$/.test(e) ? e : hs(t, n)
                )),
                t
            );
        })(t)));
    let n = us(e);
    ((n = n.replace(/(\s)=(\s)/g, '$1<span class="formula-eq">=</span>$2')),
        (n = n.replace(/^=(\s)/, '<span class="formula-eq">=</span>$1')),
        (n = n.replace(/×/g, '<span class="formula-op">×</span>')),
        (n = ms(n)));
    let a = e;
    if (
        ((a = a.replace(/(\w+(?:\s*[%×*]?\s*\w+)*)\s*\/\s*\(([^)]+)\)/g, (e, t, n) => hs(t, `(${n})`))),
        (a = a.replace(/(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/g, (e, t, n) => hs(t, n))),
        a !== e)
    ) {
        let e = a;
        return (
            (e = e.replace(/(\s)=(\s)/g, '$1<span class="formula-eq">=</span>$2')),
            (e = e.replace(/×/g, '<span class="formula-op">×</span>')),
            (e = ms(e)),
            `<span class="formula-container">${e}</span>`
        );
    }
    return `<span class="formula-container">${n}</span>`;
}
function fs(e) {
    if (!e) return '';
    return `<div class="formula-display">${ps(e)}</div>`;
}
function gs(e) {
    const t = e.scaling_per_stack && !e.one_and_done && 'flat' !== e.graph_type,
        n = e.scaling_tracks && Object.keys(e.scaling_tracks).length > 0;
    let a = '';
    if (n) {
        a = `\n            <div class="scaling-tracks-container">\n                <div class="scaling-tabs" role="tablist" aria-label="Scaling tracks">${Object.keys(
            e.scaling_tracks
        )
            .map(
                (t, n) =>
                    `<button class="scaling-tab ${0 === n ? 'active' : ''}" data-track="${t}" data-item-id="${e.id}" role="tab" aria-selected="${0 === n ? 'true' : 'false'}" aria-controls="modal-chart-${e.id}">${e.scaling_tracks[t]?.stat || t}</button>`
            )
            .join(
                ''
            )}</div>\n                <div class="modal-graph-container" role="tabpanel">\n                    <canvas id="modal-chart-${e.id}" class="scaling-chart" aria-label="Scaling chart for ${So(e.name)}"></canvas>\n                </div>\n            </div>\n        `;
    } else
        t &&
            (a = `\n            <div class="modal-graph-container">\n                <canvas id="modal-chart-${e.id}" class="scaling-chart" aria-label="Scaling chart for ${So(e.name)}"></canvas>\n            </div>\n        `);
    const i = e.hidden_mechanics?.length
            ? `\n        <div class="hidden-mechanics">\n            <h4><span class="hidden-mechanics-icon">⚡</span> Hidden Mechanics</h4>\n            <ul>\n                ${e.hidden_mechanics.map(e => `<li>${So(e)}</li>`).join('')}\n            </ul>\n        </div>\n    `
            : '',
        o =
            'hyperbolic' === e.scaling_formula_type
                ? '\n        <div class="hyperbolic-warning">\n            <span class="warning-icon">⚠</span>\n            <span>Hyperbolic Scaling: Displayed values have diminishing returns</span>\n        </div>\n    '
                : '',
        r = `\n        ${wo(e, e.name, 'item')}\n        <div class="item-badges">\n            <span class="badge rarity-${So(e.rarity || '')}">${So(e.rarity || '')}</span>\n            <span class="badge tier-${So(e.tier || '')}">${So(e.tier || '')} Tier</span>\n        </div>\n        ${e.one_and_done ? '\n            <div class="one-and-done-warning">\n                <span class="warning-icon">!</span>\n                <span>One-and-Done: Additional copies provide no benefit</span>\n            </div>\n        ' : ''}\n        ${o}\n        ${e.max_stacks || (e.stack_cap && e.stack_cap <= 100) ? `\n            <div class="stack-info">\n                <strong>Stack Limit:</strong> ${e.max_stacks || e.stack_cap} stacks\n            </div>\n        ` : ''}\n        <div class="item-effect" style="margin-top: 1rem;">${So(e.base_effect || '')}</div>\n        <p>${So(e.detailed_description || '')}</p>\n        ${i}\n        ${a}\n        ${e.formula ? `<div class="item-formula"><strong>Formula:</strong> ${fs(e.formula)}</div>` : ''}\n        ${e.synergies?.length ? `<div class="synergies-section"><h3>Synergies</h3><div class="synergy-list">${e.synergies.map(e => `<span class="synergy-tag">${So(e)}</span>`).join('')}</div></div>` : ''}\n        ${e.anti_synergies?.length ? `<div class="anti-synergies-section"><h3>Anti-Synergies</h3><div class="antisynergy-list">${e.anti_synergies.map(e => `<span class="antisynergy-tag">${So(e)}</span>`).join('')}</div></div>` : ''}\n    `,
        s = $s();
    let c = 0;
    const l = async () => {
        if (s !== Cs()) return;
        const a = ho('itemModal');
        if (!a || !a.classList.contains('active')) return;
        if (!document.getElementById(`modal-chart-${e.id}`)) return (c++, void (c < 50 && requestAnimationFrame(l)));
        const i = await xs();
        if (!i) return;
        if (s !== Cs()) return;
        const { getEffectiveStackCap: o, createScalingChart: r } = i;
        if (n && e.scaling_tracks) {
            const t = Object.keys(e.scaling_tracks);
            if (0 === t.length) return;
            const n = t[0],
                a = n ? e.scaling_tracks[n] : void 0,
                i = o(e),
                s = {
                    scalingFormulaType: e.scaling_formula_type || 'linear',
                    hyperbolicConstant: e.hyperbolic_constant || 1,
                    maxStacks: e.max_stacks || 0,
                };
            (a && r(`modal-chart-${e.id}`, a.values, a.stat, e.scaling_type || '', !0, void 0, i, s),
                (function (e) {
                    const t = document.querySelector('.scaling-tabs');
                    if (!t) return;
                    const n = async n => {
                            const a = n.target.closest(`.scaling-tab[data-item-id="${e.id}"]`);
                            if (!a) return;
                            (t.querySelectorAll(`.scaling-tab[data-item-id="${e.id}"]`).forEach(e => {
                                (e.classList.remove('active'), e.setAttribute('aria-selected', 'false'));
                            }),
                                a.classList.add('active'),
                                a.setAttribute('aria-selected', 'true'));
                            const i = await xs();
                            if (!i) return;
                            const { getEffectiveStackCap: o, createScalingChart: r } = i,
                                s = a.dataset.track;
                            if (!s)
                                return void zi.warn({
                                    operation: 'chart.init',
                                    data: { context: 'tab_switch', reason: 'missing_data_track_attribute' },
                                });
                            const c = e.scaling_tracks?.[s];
                            if (!c) return;
                            const l = o(e),
                                d = {
                                    scalingFormulaType: e.scaling_formula_type || 'linear',
                                    hyperbolicConstant: e.hyperbolic_constant || 1,
                                    maxStacks: e.max_stacks || 0,
                                };
                            r(`modal-chart-${e.id}`, c.values, c.stat, e.scaling_type || '', !0, void 0, l, d);
                        },
                        a = Es.get(t);
                    a && t.removeEventListener('click', a);
                    (Es.set(t, n), t.addEventListener('click', n));
                })(e));
        } else if (t) {
            const t = o(e),
                n = {
                    scalingFormulaType: e.scaling_formula_type || 'linear',
                    hyperbolicConstant: e.hyperbolic_constant || 1,
                    maxStacks: e.max_stacks || 0,
                };
            r(
                `modal-chart-${e.id}`,
                e.scaling_per_stack,
                e.name,
                e.scaling_type || '',
                !0,
                e.secondary_scaling || void 0,
                t,
                n
            );
        }
    };
    return (setTimeout(() => requestAnimationFrame(l), 350), r);
}
function ys(e) {
    const t = wo(e, e.name, 'weapon'),
        n =
            Array.isArray(e.upgradeable_stats) && e.upgradeable_stats.length
                ? `<div class="tag-list">${e.upgradeable_stats.map(e => `<span class="meta-tag">${So(e)}</span>`).join('')}</div>`
                : '<span class="text-muted">None</span>',
        a =
            e.synergies_items?.length || e.synergies_tomes?.length || e.synergies_characters?.length
                ? `\n        <div class="synergies-section">\n            <h3>Synergies</h3>\n            ${e.synergies_items?.length ? `\n                <div class="synergy-group">\n                    <h4>Items</h4>\n                    <div class="synergy-list">${e.synergies_items.map(e => `<span class="synergy-tag">${So(e)}</span>`).join('')}</div>\n                </div>\n            ` : ''}\n            ${e.synergies_tomes?.length ? `\n                <div class="synergy-group">\n                    <h4>Tomes</h4>\n                    <div class="synergy-list">${e.synergies_tomes.map(e => `<span class="synergy-tag">${So(e)}</span>`).join('')}</div>\n                </div>\n            ` : ''}\n            ${e.synergies_characters?.length ? `\n                <div class="synergy-group">\n                    <h4>Characters</h4>\n                    <div class="synergy-list">${e.synergies_characters.map(e => `<span class="synergy-tag">${So(e)}</span>`).join('')}</div>\n                </div>\n            ` : ''}\n        </div>\n    `
                : '',
        i =
            e.pros?.length || e.cons?.length
                ? `\n        <div class="strengths-weaknesses">\n            <div class="strengths">\n                <h4>Pros</h4>\n                <ul>${e.pros?.map(e => `<li>${So(e)}</li>`).join('') || '<li>None listed</li>'}</ul>\n            </div>\n            <div class="weaknesses">\n                <h4>Cons</h4>\n                <ul>${e.cons?.map(e => `<li>${So(e)}</li>`).join('') || '<li>None listed</li>'}</ul>\n            </div>\n        </div>\n    `
                : '';
    return `\n        ${t}\n        <div class="item-badges">\n            <span class="badge tier-${So(e.tier || '')}">${So(e.tier || '')} Tier</span>\n            ${e.playstyle ? `<span class="badge">${So(e.playstyle)}</span>` : ''}\n        </div>\n        <div class="weapon-stats-section">\n            <div><strong>Base Damage:</strong> ${So(String(e.base_damage || ''))}${e.base_projectile_count ? ` × ${So(String(e.base_projectile_count))} projectiles` : ''}</div>\n            <div><strong>Attack Pattern:</strong> ${So(e.attack_pattern || '')}</div>\n        </div>\n        <p class="weapon-description">${So(e.description || '')}</p>\n        ${e.best_for?.length ? `\n            <div class="weapon-section">\n                <h3>Best For</h3>\n                <div class="tag-list">${e.best_for.map(e => `<span class="meta-tag">${So(e)}</span>`).join('')}</div>\n            </div>\n        ` : ''}\n        <div class="weapon-section">\n            <h3>Upgradeable Stats</h3>\n            ${n}\n        </div>\n        ${i}\n        ${a}\n        ${e.build_tips ? `\n            <div class="build-tips">\n                <h3>Build Tips</h3>\n                <p>${So(e.build_tips)}</p>\n            </div>\n        ` : ''}\n        ${e.unlock_requirement ? `\n            <div class="unlock-requirement">\n                <strong>Unlock:</strong> ${So(e.unlock_requirement)}\n            </div>\n        ` : ''}\n    `;
}
function vs(e) {
    return `\n        ${wo(e, e.name, 'character')}\n        <div class="item-badges">\n            <span class="badge tier-${So(e.tier || '')}">${So(e.tier || '')} Tier</span>\n            <span class="badge">${So(e.playstyle || '')}</span>\n        </div>\n        <div class="character-passive">\n            <strong>${So(e.passive_ability || '')}</strong>\n            <p>${So(e.passive_description || '')}</p>\n        </div>\n        <div class="character-meta">\n            <div><strong>Starting Weapon:</strong> ${So(e.starting_weapon || '')}</div>\n            <div><strong>Base HP:</strong> ${So(String(e.base_hp || ''))} | <strong>Base Damage:</strong> ${So(String(e.base_damage || ''))}</div>\n            ${e.unlock_requirement ? `<div><strong>Unlock:</strong> ${So(e.unlock_requirement)}</div>` : ''}\n        </div>\n        ${e.best_for?.length ? `\n            <div class="character-section">\n                <h3>Best For</h3>\n                <div class="tag-list">${e.best_for.map(e => `<span class="meta-tag">${So(e)}</span>`).join('')}</div>\n            </div>\n        ` : ''}\n        <div class="strengths-weaknesses">\n            <div class="strengths">\n                <h4>Strengths</h4>\n                <ul>${e.strengths?.map(e => `<li>${So(e)}</li>`).join('') || '<li>None listed</li>'}</ul>\n            </div>\n            <div class="weaknesses">\n                <h4>Weaknesses</h4>\n                <ul>${e.weaknesses?.map(e => `<li>${So(e)}</li>`).join('') || '<li>None listed</li>'}</ul>\n            </div>\n        </div>\n        <div class="synergies-section">\n            <h3>Synergies</h3>\n            ${e.synergies_weapons?.length ? `\n                <div class="synergy-group">\n                    <h4>Weapons</h4>\n                    <div class="synergy-list">${e.synergies_weapons.map(e => `<span class="synergy-tag">${So(e)}</span>`).join('')}</div>\n                </div>\n            ` : ''}\n            ${e.synergies_items?.length ? `\n                <div class="synergy-group">\n                    <h4>Items</h4>\n                    <div class="synergy-list">${e.synergies_items.map(e => `<span class="synergy-tag">${So(e)}</span>`).join('')}</div>\n                </div>\n            ` : ''}\n            ${e.synergies_tomes?.length ? `\n                <div class="synergy-group">\n                    <h4>Tomes</h4>\n                    <div class="synergy-list">${e.synergies_tomes.map(e => `<span class="synergy-tag">${So(e)}</span>`).join('')}</div>\n                </div>\n            ` : ''}\n        </div>\n        ${e.build_tips ? `\n            <div class="build-tips">\n                <h3>Build Tips</h3>\n                <p>${So(e.build_tips)}</p>\n            </div>\n        ` : ''}\n    `;
}
async function bs(e) {
    const t = $s(),
        n = await xs();
    if (!n)
        return `\n            <div class="item-badges">\n                <span class="badge tier-${So(e.tier || '')}">${So(e.tier || '')} Tier</span>\n                <span class="badge" style="background: var(--bg-dark);">Priority: ${So(String(e.priority || ''))}</span>\n            </div>\n            <p>${So(e.description || '')}</p>\n            <p class="error-message">Charts unavailable</p>\n        `;
    if (t !== Cs()) return '';
    const { calculateTomeProgression: a, createScalingChart: i } = n,
        o = a(e),
        r = o
            ? `\n        <div class="modal-graph-container">\n            <canvas id="modal-tome-chart-${So(e.id)}" class="scaling-chart"></canvas>\n        </div>\n    `
            : '',
        s = `\n        <div class="item-badges">\n            <span class="badge tier-${So(e.tier || '')}">${So(e.tier || '')} Tier</span>\n            <span class="badge" style="background: var(--bg-dark);">Priority: ${So(String(e.priority || ''))}</span>\n        </div>\n        <div class="tome-effect" style="margin-top: 1rem;">\n            <strong>Stat:</strong> ${So(e.stat_affected || '')}\n        </div>\n        <p>${So(e.description || '')}</p>\n        ${r}\n        <div class="item-formula"><strong>Per Level:</strong> ${fs(String(e.value_per_level))}</div>\n        ${e.notes ? `<div class="item-notes">${So(e.notes)}</div>` : ''}\n        <div class="item-notes"><strong>Recommended for:</strong> ${Array.isArray(e.recommended_for) ? So(e.recommended_for.join(', ')) : 'General use'}</div>\n    `;
    return (
        o &&
            setTimeout(() => {
                requestAnimationFrame(() => {
                    if (t !== Cs()) return;
                    document.getElementById(`modal-tome-chart-${e.id}`) &&
                        i(`modal-tome-chart-${e.id}`, o, e.name, e.stat_affected || '', !0);
                });
            }, 350),
        s
    );
}
function ws(e) {
    return `\n        <div class="shrine-modal-header">\n            <span class="shrine-icon-modal">${So(e.icon || '')}</span>\n            <div class="item-badges">\n                ${e.type ? `<span class="badge">${So(e.type.replace('_', ' '))}</span>` : ''}\n                ${void 0 !== e.reusable ? (e.reusable ? '<span class="badge">Reusable</span>' : '<span class="badge">One-time</span>') : ''}\n            </div>\n        </div>\n        <div class="shrine-description-full">\n            <p>${So(e.description || '')}</p>\n        </div>\n        ${e.reward ? `<div class="shrine-detail-section">\n            <strong>Reward</strong>\n            <p>${So(e.reward)}</p>\n        </div>` : ''}\n        ${e.activation ? `\n            <div class="shrine-detail-section">\n                <strong>Activation</strong>\n                <p>${So(e.activation)}</p>\n            </div>\n        ` : ''}\n        ${e.spawn_count ? `\n            <div class="shrine-detail-section">\n                <strong>Spawn Rate</strong>\n                <p>${So(String(e.spawn_count))}</p>\n            </div>\n        ` : ''}\n        ${e.best_for?.length ? `\n            <div class="shrine-detail-section">\n                <strong>Best For</strong>\n                <div class="tag-list">${e.best_for.map(e => `<span class="meta-tag">${So(e)}</span>`).join('')}</div>\n            </div>\n        ` : ''}\n        ${e.synergies_items?.length ? `\n            <div class="synergies-section">\n                <h3>Item Synergies</h3>\n                <div class="synergy-list">${e.synergies_items.map(e => `<span class="synergy-tag">${So(e)}</span>`).join('')}</div>\n            </div>\n        ` : ''}\n        ${e.strategy ? `\n            <div class="shrine-strategy">\n                <strong>Strategy</strong>\n                <p>${So(e.strategy)}</p>\n            </div>\n        ` : ''}\n        ${e.notes ? `\n            <div class="item-notes" style="margin-top: 1rem;">\n                <em>${So(e.notes)}</em>\n            </div>\n        ` : ''}\n    `;
}
let _s = null,
    ks = null;
async function xs() {
    if (_s) return _s;
    try {
        return ((_s = await n(() => import('./charts-DLj1O0Ua.js'), [])), _s);
    } catch {
        return null;
    }
}
const Es = new WeakMap();
let Ss = 0;
function Cs() {
    return Ss;
}
function $s() {
    return (Ss++, Ss);
}
let Ms = !1,
    Ts = [],
    As = null,
    Is = null,
    Ls = null;
function zs(e) {
    if (!Ms) return;
    const t = ho('itemModal');
    if (t && t.classList.contains('active'))
        return 'Escape' === e.key
            ? (e.preventDefault(), void Rs())
            : void (
                  'Tab' === e.key &&
                  (e.shiftKey
                      ? document.activeElement === As && (e.preventDefault(), Is?.focus())
                      : document.activeElement === Is && (e.preventDefault(), As?.focus()))
              );
    Fs();
}
function Ds(e) {
    if (
        ((Ts = Array.from(
            e.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
        )),
        Ts.length > 0)
    ) {
        ((As = Ts[0]), (Is = Ts[Ts.length - 1]));
        const t = e.querySelector('#modal-title, h2');
        t ? ((t.tabIndex = -1), t.focus()) : As?.focus();
    }
    ((Ms = !0),
        document.addEventListener('keydown', zs),
        Ls && Ls.disconnect(),
        (Ls = new MutationObserver(t => {
            for (const n of t) {
                if ('childList' === n.type)
                    for (const t of n.removedNodes)
                        if (t === e || (t instanceof Element && t.contains(e))) return void Fs();
                if ('attributes' === n.type && n.target === e) {
                    const t = e;
                    if ('none' === t.style.display || !t.classList.contains('active')) return void Fs();
                }
            }
        })),
        e.parentNode && Ls.observe(e.parentNode, { childList: !0 }),
        Ls.observe(e, { attributes: !0, attributeFilter: ['style', 'class'] }));
}
function Fs() {
    ((Ms = !1),
        document.removeEventListener('keydown', zs),
        (Ts = []),
        (As = null),
        (Is = null),
        Ls && (Ls.disconnect(), (Ls = null)));
}
async function Os(t, a) {
    let i;
    switch (t) {
        case 'items': {
            const e = pc.items?.items;
            i = e ? e.find(e => e.id === a) : void 0;
            break;
        }
        case 'weapons': {
            const e = pc.weapons?.weapons;
            i = e ? e.find(e => e.id === a) : void 0;
            break;
        }
        case 'tomes': {
            const e = pc.tomes?.tomes;
            i = e ? e.find(e => e.id === a) : void 0;
            break;
        }
        case 'characters': {
            const e = pc.characters?.characters;
            i = e ? e.find(e => e.id === a) : void 0;
            break;
        }
        case 'shrines': {
            const e = pc.shrines?.shrines;
            i = e ? e.find(e => e.id === a) : void 0;
            break;
        }
    }
    if (!i) return void e.error(`Could not find ${t} with ID: ${a}`);
    const o = ho('itemModal'),
        r = ho('modalBody');
    if (!o || !r) return;
    let s = `<h2 id="modal-title">${i.name}</h2>`;
    ('items' === t
        ? (s += gs(i))
        : 'weapons' === t
          ? (s += ys(i))
          : 'tomes' === t
            ? (s += await bs(i))
            : 'characters' === t
              ? (s += vs(i))
              : 'shrines' === t && (s += ws(i)),
        'shrines' !== t && (s += ls(t, a)),
        (r.innerHTML = s),
        ks && (clearTimeout(ks), (ks = null)),
        (o.style.display = 'block'),
        Yr(t, a),
        requestAnimationFrame(() => {
            (o.classList.add('active'),
                document.body.classList.add('modal-open'),
                Ds(o),
                r.querySelectorAll('.similar-item-card').forEach(e => {
                    const t = () => {
                        const t = e.dataset.type,
                            a = e.dataset.id;
                        t &&
                            a &&
                            n(
                                async () => {
                                    const { openDetailModal: e } = await Promise.resolve().then(() => Ps);
                                    return { openDetailModal: e };
                                },
                                void 0
                            ).then(({ openDetailModal: e }) => {
                                e(t, a);
                            });
                    };
                    (e.addEventListener('click', t),
                        e.addEventListener('keydown', e => {
                            const n = e;
                            ('Enter' !== n.key && ' ' !== n.key) || (n.preventDefault(), t());
                        }));
                }));
        }));
}
function Rs() {
    const e = ho('itemModal');
    e &&
        (Fs(),
        e.classList.remove('active'),
        document.body.classList.remove('modal-open'),
        (ks = setTimeout(() => {
            ((e.style.display = 'none'), (ks = null));
        }, 300)));
}
const Ps = Object.freeze(
    Object.defineProperty(
        {
            __proto__: null,
            closeModal: Rs,
            openDetailModal: Os,
            renderCharacterModal: vs,
            renderItemModal: gs,
            renderShrineModal: ws,
            renderTomeModal: bs,
            renderWeaponModal: ys,
        },
        Symbol.toStringTag,
        { value: 'Module' }
    )
);
let Ns = null,
    Bs = null,
    js = null,
    qs = 0;
let Hs = null;
function Zs() {
    return (
        null === Hs &&
            (Hs = (function () {
                if ('undefined' == typeof AbortController) return !1;
                try {
                    const e = new AbortController(),
                        t = () => {},
                        n = document.createElement('div');
                    return (n.addEventListener('test', t, { signal: e.signal }), n.removeEventListener('test', t), !0);
                } catch {
                    return !1;
                }
            })()),
        Hs
    );
}
function Us(e) {
    const t = (function () {
        if (Zs()) return (Ns || (Ns = new AbortController()), Ns.signal);
    })();
    return t ? (e ? { ...e, signal: t } : { signal: t }) : e;
}
function Vs() {
    (Bs && (Bs(), (Bs = null)), js && (js(), (js = null)));
}
function Ws(e) {
    const t = e.target;
    if (!('searchInput' === t.id && Qo() && tr(e)))
        if ('Escape' !== e.key) {
            if ((e.ctrlKey && 'k' === e.key) || '/' === e.key) {
                if ('INPUT' === t.tagName || 'TEXTAREA' === t.tagName) return;
                e.preventDefault();
                const n = ho('searchInput');
                return void (n && (n.focus(), n.select()));
            }
            if (('ArrowLeft' !== e.key && 'ArrowRight' !== e.key) || !t.classList.contains('tab-btn'))
                if (!(e.key >= '1' && e.key <= '9') || e.ctrlKey || e.altKey || e.metaKey) {
                    if (('Enter' !== e.key && ' ' !== e.key) || !t.classList.contains('breakpoint-card'))
                        return ('Enter' !== e.key && ' ' !== e.key) || !t.classList.contains('suggestion-card')
                            ? void (
                                  ('Enter' !== e.key && ' ' !== e.key) ||
                                  !t.classList.contains('clickable-card') ||
                                  (e.preventDefault(), Js(t))
                              )
                            : (e.preventDefault(),
                              void n(
                                  async () => {
                                      const { handleEmptyStateClick: e } = await Promise.resolve().then(() => br);
                                      return { handleEmptyStateClick: e };
                                  },
                                  void 0
                              )
                                  .then(({ handleEmptyStateClick: e }) => {
                                      e(t);
                                  })
                                  .catch(e =>
                                      zi.warn({
                                          operation: 'import.empty-states',
                                          error: { name: 'ImportError', message: e.message },
                                      })
                                  ));
                    !(function (e, t) {
                        e.preventDefault();
                        const a = t.dataset.item,
                            i = t.dataset.target;
                        if (a && i) {
                            const e = parseInt(i, 10);
                            isNaN(e) ||
                                n(async () => {
                                    const { quickCalc: e } = await import('./calculator-NgllIFLr.js');
                                    return { quickCalc: e };
                                }, [])
                                    .then(({ quickCalc: t }) => t(a, e))
                                    .catch(e => {
                                        zi.warn({
                                            operation: 'import.calculator',
                                            error: { name: 'ImportError', message: e.message },
                                        });
                                    });
                        }
                    })(e, t);
                } else
                    'INPUT' !== t.tagName &&
                        'TEXTAREA' !== t.tagName &&
                        (function (e) {
                            const t = {
                                1: 'items',
                                2: 'weapons',
                                3: 'tomes',
                                4: 'characters',
                                5: 'shrines',
                                6: 'build-planner',
                                7: 'calculator',
                                8: 'advisor',
                                9: 'changelog',
                            }[e.key];
                            t && (e.preventDefault(), Vr(t));
                        })(e);
            else
                !(function (e, t) {
                    e.preventDefault();
                    const n = Array.from(document.querySelectorAll('.tab-btn'));
                    if (0 === n.length) return;
                    const a = n.indexOf(t);
                    if (-1 === a) return;
                    const i = n['ArrowRight' === e.key ? (a + 1) % n.length : (a - 1 + n.length) % n.length];
                    if (i) {
                        i.focus();
                        const e = i.getAttribute('data-tab');
                        e && Vr(e);
                    }
                })(e, t);
        } else
            Qo()
                ? er()
                : (Rs(),
                  n(async () => {
                      const { closeCompareModal: e } = await import('./compare-BOHXXp8r.js');
                      return { closeCompareModal: e };
                  }, [])
                      .then(({ closeCompareModal: e }) => e())
                      .catch(e => {
                          zi.warn({ operation: 'import.compare', error: { name: 'ImportError', message: e.message } });
                          const t = ho('compareModal');
                          t && ((t.style.display = 'none'), t.classList.remove('active'));
                      }));
}
function Js(e) {
    const t = e.closest('.item-card');
    if (!t) return;
    const n = t.dataset.entityType,
        a = t.dataset.entityId;
    if (n && a) {
        Os({ item: 'items', weapon: 'weapons', tome: 'tomes', character: 'characters', shrine: 'shrines' }[n] || n, a);
    }
}
function Ks(t) {
    const a = t.target;
    if (a instanceof Element)
        if (a.classList.contains('view-details-btn'))
            !(function (e) {
                const t = e.dataset.type,
                    n = e.dataset.id;
                t && n && Os(t, n);
            })(a);
        else {
            if (window.matchMedia('(max-width: 480px)').matches && a.closest('.item-card')) {
                if (!a.closest('.favorite-btn, .compare-checkbox-label, .expandable-text, a, button'))
                    return void (function (e) {
                        const t = e.closest('.item-card');
                        if (!t) return;
                        const n = t.dataset.entityType,
                            a = t.dataset.entityId;
                        n &&
                            a &&
                            Os(
                                {
                                    item: 'items',
                                    weapon: 'weapons',
                                    tome: 'tomes',
                                    character: 'characters',
                                    shrine: 'shrines',
                                }[n] || n,
                                a
                            );
                    })(a);
            }
            if (
                !a.closest('.item-card') ||
                a.closest('.favorite-btn') ||
                a.closest('.compare-checkbox-label') ||
                a.closest('.expandable-text') ||
                a.classList.contains('view-details-btn')
            )
                if (!a.closest('.compare-checkbox-label') || a.classList.contains('compare-checkbox')) {
                    if (a.classList.contains('expandable-text') || a.closest('.expandable-text')) {
                        const e = a.classList.contains('expandable-text') ? a : a.closest('.expandable-text');
                        return void (
                            e &&
                            (function (e) {
                                if (!e.dataset.fullText) return;
                                const t = 'true' === e.dataset.truncated,
                                    n = e.dataset.fullText,
                                    a = document.createElement('span'),
                                    i = document.createElement('span');
                                if (((i.className = 'expand-indicator'), t))
                                    ((a.textContent = n),
                                        (i.textContent = 'Click to collapse'),
                                        (e.innerHTML = ''),
                                        e.appendChild(a),
                                        e.appendChild(i),
                                        (e.dataset.truncated = 'false'),
                                        e.classList.add('expanded'));
                                else {
                                    const t = n.length > 120 ? n.substring(0, 120) + '...' : n;
                                    ((a.textContent = t),
                                        (i.textContent = 'Click to expand'),
                                        (e.innerHTML = ''),
                                        e.appendChild(a),
                                        e.appendChild(i),
                                        (e.dataset.truncated = 'true'),
                                        e.classList.remove('expanded'));
                                }
                            })(e)
                        );
                    }
                    if (a.classList.contains('remove-compare-btn') || a.closest('.remove-compare-btn'))
                        !(function (e) {
                            const t = e.classList.contains('remove-compare-btn') ? e : e.closest('.remove-compare-btn'),
                                a = t?.dataset.removeId;
                            a &&
                                n(async () => {
                                    const { toggleCompareItem: e, updateCompareDisplay: t } =
                                        await import('./compare-BOHXXp8r.js');
                                    return { toggleCompareItem: e, updateCompareDisplay: t };
                                }, [])
                                    .then(({ toggleCompareItem: e, updateCompareDisplay: t }) => {
                                        (e(a), t());
                                    })
                                    .catch(e =>
                                        zi.warn({
                                            operation: 'import.compare',
                                            error: { name: 'ImportError', message: e.message },
                                        })
                                    );
                        })(a);
                    else if (a.classList.contains('btn-secondary') && a.textContent?.includes('Clear Filters')) cr();
                    else if (a.classList.contains('changelog-expand-btn'))
                        n(async () => {
                            const { toggleChangelogExpand: e } = await import('./changelog-C90nu2gf.js');
                            return { toggleChangelogExpand: e };
                        }, [])
                            .then(({ toggleChangelogExpand: e }) => e(a))
                            .catch(e =>
                                zi.warn({
                                    operation: 'import.changelog',
                                    error: { name: 'ImportError', message: e.message },
                                })
                            );
                    else {
                        if (a.classList.contains('entity-link')) {
                            t.preventDefault();
                            const e = a,
                                n = e.dataset.entityType,
                                i = e.dataset.entityId;
                            return void (n && i && Os(n, i));
                        }
                        a.closest('.breakpoint-card')
                            ? (function (e) {
                                  const t = e.closest('.breakpoint-card'),
                                      a = t?.dataset.item,
                                      i = t?.dataset.target;
                                  if (a && i) {
                                      const e = parseInt(i, 10);
                                      isNaN(e) ||
                                          n(async () => {
                                              const { quickCalc: e } = await import('./calculator-NgllIFLr.js');
                                              return { quickCalc: e };
                                          }, [])
                                              .then(({ quickCalc: t }) => t(a, e))
                                              .catch(e =>
                                                  zi.warn({
                                                      operation: 'import.calculator',
                                                      error: { name: 'ImportError', message: e.message },
                                                  })
                                              );
                                  }
                              })(a)
                            : a.classList.contains('favorite-btn') || a.closest('.favorite-btn')
                              ? (function (t) {
                                    const n = t.classList.contains('favorite-btn') ? t : t.closest('.favorite-btn'),
                                        a = n?.dataset.tab,
                                        i = n?.dataset.id;
                                    if (
                                        n &&
                                        a &&
                                        ('items' === (o = a) ||
                                            'weapons' === o ||
                                            'tomes' === o ||
                                            'characters' === o ||
                                            'shrines' === o) &&
                                        i
                                    ) {
                                        const t = No(a, i);
                                        (n.classList.toggle('favorited', t),
                                            (n.textContent = t ? '⭐' : '☆'),
                                            (n.title = t ? 'Remove from favorites' : 'Add to favorites'),
                                            n.setAttribute(
                                                'aria-label',
                                                t ? 'Remove from favorites' : 'Add to favorites'
                                            ),
                                            void 0 !== e &&
                                                e.success(t ? 'Added to favorites' : 'Removed from favorites'));
                                    }
                                    var o;
                                })(a)
                              : a.closest('.search-result-card')
                                ? (async function (e) {
                                      const t = e.closest('.search-result-card'),
                                          n = t?.dataset.tabType,
                                          a = t?.dataset.entityId;
                                      if (!n || !a) return;
                                      await Vr(n);
                                      const i = ho('searchInput');
                                      (i && (i.value = ''), await Os(n, a));
                                  })(a)
                                : (a.classList.contains('empty-state-action') || a.closest('.suggestion-card')) &&
                                  n(
                                      async () => {
                                          const { handleEmptyStateClick: e } = await Promise.resolve().then(() => br);
                                          return { handleEmptyStateClick: e };
                                      },
                                      void 0
                                  )
                                      .then(({ handleEmptyStateClick: e }) => {
                                          e(a);
                                      })
                                      .catch(e =>
                                          zi.warn({
                                              operation: 'import.empty-states',
                                              error: { name: 'ImportError', message: e.message },
                                          })
                                      );
                    }
                } else
                    !(function (e, t) {
                        const a = t.closest('.compare-checkbox-label'),
                            i = a?.querySelector('.compare-checkbox');
                        if (!i) return;
                        const o = Date.now();
                        if (o - parseInt(i.dataset.lastToggle || '0', 10) < 100) return;
                        i.dataset.lastToggle = o.toString();
                        const r = i.dataset.id || i.value;
                        r &&
                            (e.preventDefault(),
                            (i.checked = !i.checked),
                            n(async () => {
                                const { toggleCompareItem: e } = await import('./compare-BOHXXp8r.js');
                                return { toggleCompareItem: e };
                            }, [])
                                .then(({ toggleCompareItem: e }) => e(r))
                                .catch(e =>
                                    zi.warn({
                                        operation: 'import.compare',
                                        error: { name: 'ImportError', message: e.message },
                                    })
                                ));
                    })(t, a);
            else Js(a);
        }
}
function Gs(e) {
    const t = e.target;
    if (t.classList.contains('tome-checkbox') || t.classList.contains('item-checkbox'))
        n(async () => {
            const { updateBuildAnalysis: e } = await import('./build-planner-B3C08AMw.js');
            return { updateBuildAnalysis: e };
        }, [])
            .then(({ updateBuildAnalysis: e }) => e())
            .catch(e =>
                zi.warn({ operation: 'import.build-planner', error: { name: 'ImportError', message: e.message } })
            );
    else {
        if (t.closest('#filters') && 'SELECT' === t.tagName) {
            const e = Io('currentTab');
            return void (e && (Cr(e), Vo(e)));
        }
        if ('favoritesOnly' === t.id) {
            const e = Io('currentTab');
            return void (e && (Cr(e), Vo(e)));
        }
    }
}
function Ys() {
    (document.addEventListener('keydown', Ws, Us()),
        document.addEventListener('click', Ks, Us()),
        document.addEventListener('change', Gs, Us()),
        window.addEventListener(
            'pagehide',
            () => (
                Vs(),
                void (
                    Ns &&
                    (Ns.abort(),
                    (Ns = null),
                    zi.info({ operation: 'events.cleanup', data: { message: 'All event listeners cleaned up' } }))
                )
            ),
            Us()
        ));
}
function Xs() {
    (document.querySelectorAll('.tab-btn').forEach(e => {
        e.addEventListener(
            'click',
            () => {
                const t = e.getAttribute('data-tab');
                t && Vr(t);
            },
            Us()
        );
    }),
        (function () {
            const e = document.querySelector('.tabs .container'),
                t = document.querySelector('.tab-buttons');
            if (!e || !t) return;
            Vs();
            const n = () => {
                const n = t.scrollLeft > 5,
                    a = t.scrollLeft < t.scrollWidth - t.clientWidth - 5;
                (e.classList.toggle('can-scroll-left', n), e.classList.toggle('can-scroll-right', a));
            };
            let a = !1;
            const i = () => {
                    a ||
                        ((a = !0),
                        requestAnimationFrame(() => {
                            (n(), (a = !1));
                        }));
                },
                o = Mo(n, 100);
            (t.addEventListener('scroll', i, Us({ passive: !0 })),
                window.addEventListener('resize', o, Us()),
                (Bs = () => t.removeEventListener('scroll', i)),
                (js = () => window.removeEventListener('resize', o)),
                setTimeout(n, 100));
        })(),
        (function (e) {
            const t = ho('searchInput');
            t &&
                (t.addEventListener('input', Mo(sr, 300), e()),
                t.addEventListener(
                    'focus',
                    () => {
                        t.value.trim().length >= 2 ? sr() : qo(t, sr);
                    },
                    e()
                ));
        })(Us),
        (function () {
            document.querySelectorAll('.close').forEach(e => {
                e.addEventListener('click', Rs, Us());
            });
            const e = ho('closeCompare');
            e &&
                e.addEventListener(
                    'click',
                    () => {
                        n(async () => {
                            const { closeCompareModal: e } = await import('./compare-BOHXXp8r.js');
                            return { closeCompareModal: e };
                        }, [])
                            .then(({ closeCompareModal: e }) => e())
                            .catch(e =>
                                zi.warn({
                                    operation: 'import.compare',
                                    error: { name: 'ImportError', message: e.message },
                                })
                            );
                    },
                    Us()
                );
            const t = e => {
                const t = Date.now();
                if (t - qs < 300) return;
                const a = e.target,
                    i = ho('itemModal'),
                    o = ho('compareModal');
                if (i && i.classList.contains('active')) {
                    const e = i.querySelector('.modal-content');
                    if (a === i || (i.contains(a) && !e?.contains(a))) return ((qs = t), void Rs());
                }
                if (o && o.classList.contains('active')) {
                    const e = o.querySelector('.modal-content');
                    (a === o || (o.contains(a) && !e?.contains(a))) &&
                        ((qs = t),
                        n(async () => {
                            const { closeCompareModal: e } = await import('./compare-BOHXXp8r.js');
                            return { closeCompareModal: e };
                        }, [])
                            .then(({ closeCompareModal: e }) => e())
                            .catch(e =>
                                zi.warn({
                                    operation: 'import.compare',
                                    error: { name: 'ImportError', message: e.message },
                                })
                            ));
                }
            };
            (window.addEventListener('click', t, Us()), window.addEventListener('touchend', t, Us()));
        })(),
        (function () {
            const e = ho('compare-btn');
            e &&
                e.addEventListener(
                    'click',
                    () => {
                        n(async () => {
                            const { openCompareModal: e } = await import('./compare-BOHXXp8r.js');
                            return { openCompareModal: e };
                        }, [])
                            .then(({ openCompareModal: e }) => e())
                            .catch(e =>
                                zi.warn({
                                    operation: 'import.compare',
                                    error: { name: 'ImportError', message: e.message },
                                })
                            );
                    },
                    Us()
                );
        })(),
        (function () {
            const e = ho('filter-toggle-btn'),
                t = ho('filters');
            e &&
                t &&
                e.addEventListener(
                    'click',
                    () => {
                        const n = t.classList.toggle('filters-expanded');
                        (e.classList.toggle('active', n), e.setAttribute('aria-expanded', String(n)));
                    },
                    Us()
                );
        })(),
        (function () {
            const e = document.querySelector('.controls');
            if (!e) return;
            const t = window.matchMedia('(max-width: 768px)');
            if (!t.matches) return;
            let n = window.scrollY,
                a = !1;
            (window.addEventListener(
                'scroll',
                () => {
                    a ||
                        ((a = !0),
                        requestAnimationFrame(() => {
                            const t = window.scrollY,
                                i = t - n;
                            (t <= 0
                                ? e.classList.remove('controls-hidden')
                                : i > 10
                                  ? e.classList.add('controls-hidden')
                                  : i < -10 && e.classList.remove('controls-hidden'),
                                (n = t),
                                (a = !1));
                        }));
                },
                Us({ passive: !0 })
            ),
                t.addEventListener('change', t => {
                    t.matches || e.classList.remove('controls-hidden');
                }));
        })(),
        Ys(),
        (function () {
            const e = ho(Ko);
            e &&
                (e.addEventListener('click', e => {
                    const t = e.target.closest('.search-dropdown-item');
                    if (t) {
                        const e = t.dataset.index;
                        if (void 0 !== e) {
                            const t = parseInt(e, 10),
                                n = Yo[t];
                            !isNaN(t) && t >= 0 && t < Yo.length && n && nr(n);
                        }
                    }
                }),
                document.addEventListener('click', e => {
                    const t = e.target,
                        n = ho('searchInput'),
                        a = ho(Ko);
                    !Xo || t === n || a?.contains(t) || t.closest('.search-box') || er();
                }));
        })());
}
const Qs = 'megabonk_last_sync',
    ec = 'offline-indicator';
function tc() {
    try {
        const e = Date.now();
        (localStorage.setItem(Qs, e.toString()),
            zi.debug({ operation: 'offline.sync_recorded', data: { timestamp: e } }));
    } catch (e) {
        zi.debug({
            operation: 'offline.sync_record_failed',
            error: { message: e.message, name: 'StorageError', module: 'offline-ui' },
        });
    }
}
function nc() {
    try {
        const e = localStorage.getItem(Qs);
        return e ? parseInt(e, 10) : null;
    } catch {
        return null;
    }
}
function ac(t) {
    const n = ho(ec);
    if (n)
        if (t) {
            const t = nc();
            let a = "You're offline - using cached data";
            if (t) {
                a = `You're offline - using data from ${(function (e) {
                    const t = Date.now() - e,
                        n = Math.floor(t / 1e3),
                        a = Math.floor(n / 60),
                        i = Math.floor(a / 60),
                        o = Math.floor(i / 24);
                    return o > 0
                        ? 1 === o
                            ? '1 day ago'
                            : `${o} days ago`
                        : i > 0
                          ? 1 === i
                              ? '1 hour ago'
                              : `${i} hours ago`
                          : a > 0
                            ? 1 === a
                                ? '1 minute ago'
                                : `${a} minutes ago`
                            : 'just now';
                })(t)}`;
            }
            n.innerHTML = `\n            <span class="offline-icon">📡</span>\n            <span class="offline-message">${a}</span>\n            <button class="offline-retry-btn" aria-label="Retry connection">Retry</button>\n        `;
            const i = n.querySelector('.offline-retry-btn');
            (i &&
                i.addEventListener('click', () => {
                    navigator.onLine
                        ? (ac(!1),
                          e.success('Back online!'),
                          'function' == typeof window.loadAllData && window.loadAllData())
                        : e.info('Still offline. Please check your connection.');
                }),
                (n.style.display = 'flex'));
        } else n.style.display = 'none';
}
function ic() {
    !(function () {
        const e = ho(ec);
        if (e) return e;
        const t = document.createElement('div');
        ((t.id = ec),
            (t.className = 'offline-indicator'),
            t.setAttribute('role', 'status'),
            t.setAttribute('aria-live', 'polite'),
            (t.style.display = 'none'),
            document.body.prepend(t));
    })();
    (window.addEventListener('online', () => {
        (ac(!1), zi.info({ operation: 'app.online', data: { previousState: 'offline' } }), tc());
    }),
        window.addEventListener('offline', () => {
            (ac(!0), zi.info({ operation: 'app.offline', data: { previousState: 'online' } }));
        }),
        navigator.onLine || ac(!0));
}
function oc() {
    const e = document.getElementById('loading-overlay');
    e && (e.style.display = 'none');
}
function rc(e) {
    return document.getElementById(e);
}
function sc() {
    return Io('allData');
}
function cc(e, t) {
    if (!e || 'object' != typeof e) return !1;
    if ('changelog' === t) {
        const t = e;
        return !(!t.patches || !Array.isArray(t.patches));
    }
    return oo(e, t).valid;
}
async function lc(e, t = 3e4) {
    const n = new AbortController(),
        a = setTimeout(() => n.abort(), t);
    try {
        const t = await fetch(e, { signal: n.signal });
        return (clearTimeout(a), t);
    } catch (i) {
        clearTimeout(a);
        const t = (function (e, t) {
                const n = e.message.toLowerCase();
                return 'AbortError' === e.name || n.includes('timeout')
                    ? { type: 'timeout', retriable: !0, message: `Request timed out: ${t}` }
                    : n.includes('network') || n.includes('failed to fetch')
                      ? { type: 'network', retriable: !0, message: `Network error: ${t}` }
                      : n.includes('cors')
                        ? { type: 'cors', retriable: !1, message: `CORS error: ${t}` }
                        : n.includes('json')
                          ? { type: 'parse', retriable: !1, message: `JSON parse error: ${t}` }
                          : { type: 'unknown', retriable: !0, message: e.message };
            })(i, e),
            n = new Error(t.message);
        throw ((n.type = t.type), (n.retriable = t.retriable), n);
    }
}
async function dc(e, t = 4, n = 2e3) {
    let a;
    for (let o = 0; o <= t; o++) {
        try {
            const t = await lc(e);
            if (t.ok) return t;
            const n = t.status,
                i = n >= 500 || 429 === n;
            if (((a = new Error(`HTTP ${n}: ${t.statusText}`)), (a.type = 'http'), (a.retriable = i), !i)) break;
        } catch (i) {
            if (((a = i), !1 === a.retriable)) break;
        }
        if (o < t) {
            const i = n * Math.pow(2, o);
            (zi.debug({
                operation: 'data.fetch_retry',
                data: { url: e, attempt: o + 1, maxRetries: t, delayMs: i, errorType: a?.type },
            }),
                await new Promise(e => setTimeout(e, i)));
        }
    }
    throw new Error(`Failed to fetch ${e} after ${t + 1} attempts: ${a?.message}`);
}
async function uc() {
    !(function () {
        const e = document.getElementById('loading-overlay');
        e && (e.style.display = 'flex');
    })();
    const t = performance.now();
    try {
        const i = await Promise.all([
                dc('./data/items.json'),
                dc('./data/weapons.json'),
                dc('./data/tomes.json'),
                dc('./data/characters.json'),
                dc('./data/shrines.json'),
                dc('./data/stats.json'),
                dc('./data/changelog.json'),
            ]),
            [o, r, s, c, l, d, u] = await Promise.all(
                i.map(async e => {
                    if (!e.ok) throw new Error(`Failed to load ${e.url}: ${e.status} ${e.statusText}`);
                    return e.json();
                })
            ),
            h = [
                { data: o, type: 'items' },
                { data: r, type: 'weapons' },
                { data: s, type: 'tomes' },
                { data: c, type: 'characters' },
                { data: l, type: 'shrines' },
                { data: d, type: 'stats' },
                { data: u, type: 'changelog' },
            ];
        for (const { data: e, type: t } of h)
            if (!cc(e, t)) throw new Error(`Data validation failed for ${t}. Data may be corrupted.`);
        const m = { items: o, weapons: r, tomes: s, characters: c, shrines: l, stats: d, changelog: u };
        (Lo('allData', m),
            n(async () => {
                const { invalidateBuildStatsCache: e } = await import('./build-planner-B3C08AMw.js');
                return { invalidateBuildStatsCache: e };
            }, [])
                .then(({ invalidateBuildStatsCache: e }) => e())
                .catch(e => {
                    zi.debug({
                        operation: 'data.cache_invalidation',
                        data: { module: 'build-planner', reason: 'module_not_loaded', error: e.message },
                    });
                }));
        const p = so(m);
        ((a = p).valid
            ? zi.info({
                  operation: 'data.validate',
                  success: !0,
                  data: { valid: !0, errorCount: 0, warningCount: a.warnings.length },
              })
            : zi.error({
                  operation: 'data.validate',
                  success: !1,
                  data: {
                      valid: !1,
                      errorCount: a.errors.length,
                      warningCount: a.warnings.length,
                      errors: a.errors.slice(0, 10),
                  },
              }),
            a.warnings.length > 0 &&
                zi.warn({
                    operation: 'data.validate',
                    data: { warningCount: a.warnings.length, warnings: a.warnings.slice(0, 10) },
                }));
        const f = Math.round(performance.now() - t);
        (zi.info({
            operation: 'data.load',
            durationMs: f,
            success: !0,
            data: {
                filesLoaded: ['items', 'weapons', 'tomes', 'characters', 'shrines', 'stats', 'changelog'],
                itemCounts: {
                    items: o?.items?.length || 0,
                    weapons: r?.weapons?.length || 0,
                    tomes: s?.tomes?.length || 0,
                    characters: c?.characters?.length || 0,
                    shrines: l?.shrines?.length || 0,
                },
                validationResults: { valid: p.valid, errorCount: p.errors.length, warningCount: p.warnings.length },
                version: o?.version || 'unknown',
            },
        }),
            !p.valid &&
                p.errors.length > 10 &&
                e.warning('Some game data may be incomplete. Check console for details.'));
        const g = rc('version'),
            y = rc('last-updated');
        (g && (g.textContent = `Version: ${o?.version || 'Unknown'}`),
            y && (y.textContent = `Last Updated: ${o?.last_updated || 'Unknown'}`),
            oc(),
            tc());
        const v = window;
        'function' == typeof v.switchTab &&
            v.switchTab(
                (function () {
                    const e = localStorage.getItem(Br);
                    return e && jr.includes(e) ? e : 'items';
                })()
            );
        const b = window;
        'function' == typeof b.loadBuildFromURL && b.loadBuildFromURL();
        const w = window;
        'function' == typeof w.initAdvisor && w.initAdvisor(m);
        const _ = window;
        'function' == typeof _.initScanBuild && _.initScanBuild(m);
    } catch (i) {
        const n = Math.round(performance.now() - t),
            a = i;
        (zi.error({
            operation: 'data.load',
            durationMs: n,
            success: !1,
            error: { name: a.name, message: a.message, stack: a.stack, module: 'data-service', retriable: !0 },
        }),
            oc(),
            (function (t) {
                e.error(t);
                const n = document.getElementById('main-content');
                if (n) {
                    const e = document.createElement('div');
                    ((e.className = 'error-message'), (e.textContent = t), (n.innerHTML = ''), n.appendChild(e));
                }
            })(`Could not load game data. ${a.message || 'Please check your connection and try again.'}`));
    }
    var a;
}
function hc(e) {
    return mc(sc(), e);
}
function mc(e, t) {
    switch (t) {
        case 'items':
            return e.items?.items || [];
        case 'weapons':
            return e.weapons?.weapons || [];
        case 'tomes':
            return e.tomes?.tomes || [];
        case 'characters':
            return e.characters?.characters || [];
        case 'shrines':
            return e.shrines?.shrines || [];
        case 'changelog':
            return e.changelog?.patches || [];
        default:
            return [];
    }
}
'undefined' != typeof window &&
    Object.assign(window, { recordDataSync: tc, getLastSyncTime: nc, updateOfflineIndicator: ac });
const pc = new Proxy(
        {},
        {
            get: (e, t) => sc()[t],
            set() {
                throw new Error('allData is read-only. Use setState("allData", data) to update.');
            },
        }
    ),
    fc = Object.freeze(
        Object.defineProperty(
            {
                __proto__: null,
                allData: pc,
                getAllData: function () {
                    return Io('allData');
                },
                getDataForTab: hc,
                getDataForTabFromData: mc,
                loadAllData: uc,
            },
            Symbol.toStringTag,
            { value: 'Module' }
        )
    );
const gc = new (class {
    constructor() {
        ((this.cache = new Map()), (this.initialized = !1));
    }
    init() {
        this.initialized ||
            (this.cache.set('searchInput', document.getElementById('searchInput')),
            this.cache.set('favoritesOnly', document.getElementById('favoritesOnly')),
            this.cache.set('filters', document.getElementById('filters')),
            this.cache.set('itemCount', document.getElementById('item-count')),
            this.cache.set('mainContent', document.getElementById('main-content')),
            this.cache.set('modalOverlay', document.getElementById('modal-overlay')),
            this.cache.set('compareButton', document.getElementById('compare-button')),
            this.cache.set('compareCount', document.querySelector('.compare-count')),
            this.cache.set('tabButtons', document.querySelectorAll('.tab-btn')),
            this.cache.set('itemsContainer', document.getElementById('itemsContainer')),
            this.cache.set('weaponsContainer', document.getElementById('weaponsContainer')),
            this.cache.set('tomesContainer', document.getElementById('tomesContainer')),
            this.cache.set('charactersContainer', document.getElementById('charactersContainer')),
            this.cache.set('shrinesContainer', document.getElementById('shrinesContainer')),
            (this.initialized = !0));
    }
    get(e) {
        return (this.initialized || this.init(), this.cache.get(e) || null);
    }
    set(e, t) {
        this.cache.set(e, t);
    }
    invalidate(e) {
        this.cache.delete(e);
    }
    invalidateAll() {
        (this.cache.clear(), (this.initialized = !1));
    }
    refresh(e, t, n = !0) {
        const a = n ? document.getElementById(t) : document.querySelector(t);
        a ? this.cache.set(e, a) : this.cache.delete(e);
    }
})();
let yc = [],
    vc = 50;
function bc(e = 6e4) {
    const t = Date.now() - e;
    return yc.filter(e => e.timestamp >= t);
}
function wc(e, t) {
    !(function (e, t, n, a) {
        const i = { type: e, timestamp: Date.now(), message: t, data: n, category: a };
        (yc.push(i), yc.length > vc && (yc = yc.slice(-50)));
    })('error', `Error: ${e.message}`, { name: e.name, message: e.message, stack: e.stack, context: t }, 'error');
}
function _c() {
    try {
        const e = Io('currentTab'),
            t = Io('filteredData'),
            n = Io('currentBuild'),
            a = Io('compareItems');
        return {
            timestamp: Date.now(),
            currentTab: e,
            filteredDataCount: t?.length ?? 0,
            currentBuild: n
                ? {
                      hasCharacter: !!n.character,
                      hasWeapon: !!n.weapon,
                      tomesCount: n.tomes?.length ?? 0,
                      itemsCount: n.items?.length ?? 0,
                  }
                : null,
            compareItemsCount: a?.length ?? 0,
            windowSize: {
                width: 'undefined' != typeof window ? window.innerWidth : 0,
                height: 'undefined' != typeof window ? window.innerHeight : 0,
            },
            userAgent: 'undefined' != typeof navigator ? navigator.userAgent : 'unknown',
            online: 'undefined' == typeof navigator || navigator.onLine,
            url: 'undefined' != typeof window ? window.location.href : 'unknown',
        };
    } catch (e) {
        return { timestamp: Date.now(), error: 'Failed to capture state snapshot', message: e.message };
    }
}
const kc = new Map();
function xc(e, t) {
    kc.set(e, { fallback: t, errorCount: 0, lastError: null });
}
async function Ec(t, n, a = {}) {
    const { required: i = !1, gracefulDegradation: o = !0 } = a,
        r = (function (t, n, a = {}) {
            const { fallback: i = null, silent: o = !1, maxRetries: r = 0, onError: s = null } = a;
            return async function (...a) {
                const c = kc.get(t);
                let l = 0;
                for (; l <= r; )
                    try {
                        return await n(...a);
                    } catch (d) {
                        const n = d;
                        wc(n, t);
                        const a = _c(),
                            p = bc(6e4);
                        if (
                            (zi.error({
                                operation: 'error.boundary',
                                error: { name: n.name, message: n.message, stack: n.stack, module: t },
                                data: {
                                    retries: l,
                                    maxRetries: r,
                                    phase: 'caught',
                                    stateSnapshot: a,
                                    breadcrumbCount: p.length,
                                },
                            }),
                            c && (c.errorCount++, (c.lastError = n)),
                            s)
                        )
                            try {
                                await s(n, l);
                            } catch (u) {
                                const e = u;
                                zi.error({
                                    operation: 'error.boundary',
                                    error: { name: e.name, message: e.message, stack: e.stack, module: t },
                                    data: { phase: 'handler_failed' },
                                });
                            }
                        if (l < r) {
                            l++;
                            const e = Math.min(1e3 * Math.pow(2, l), 1e4);
                            await new Promise(t => setTimeout(t, e));
                            continue;
                        }
                        if (!o)
                            try {
                                e.error(`An error occurred in ${t}. Some features may not work correctly.`);
                            } catch {}
                        if (i)
                            try {
                                return await i(n);
                            } catch (h) {
                                const e = h;
                                throw (
                                    zi.error({
                                        operation: 'error.boundary',
                                        error: { name: e.name, message: e.message, stack: e.stack, module: t },
                                        data: {
                                            phase: 'fallback_failed',
                                            recoveryAttempted: !0,
                                            recoverySucceeded: !1,
                                        },
                                    }),
                                    e
                                );
                            }
                        if (c && c.fallback)
                            try {
                                return await c.fallback(n);
                            } catch (m) {
                                const e = m;
                                zi.error({
                                    operation: 'error.boundary',
                                    error: { name: e.name, message: e.message, stack: e.stack, module: t },
                                    data: {
                                        phase: 'boundary_fallback_failed',
                                        recoveryAttempted: !0,
                                        recoverySucceeded: !1,
                                    },
                                });
                            }
                        throw n;
                    }
            };
        })(t, n, {
            silent: !1,
            maxRetries: 0,
            fallback: o
                ? async e => (
                      zi.warn({
                          operation: 'module.degraded',
                          error: { name: e.name, message: e.message, stack: e.stack, module: t },
                          data: { moduleName: t, gracefulDegradation: !0 },
                      }),
                      { degraded: !0, error: e }
                  )
                : null,
            onError: async n => {
                if (
                    (zi.error({
                        operation: 'module.init.failed',
                        error: { name: n.name, message: n.message, stack: n.stack, module: t, retriable: !0 },
                        data: { moduleName: t, required: i },
                    }),
                    i)
                )
                    try {
                        e.error(`Critical error: ${t} failed to load. Please refresh the page.`);
                    } catch {}
            },
        });
    return await r();
}
let Sc = null;
const Cc = Object.freeze([
    {
        category: 'Navigation',
        shortcuts: [
            { keys: ['1'], description: 'Switch to Items tab' },
            { keys: ['2'], description: 'Switch to Weapons tab' },
            { keys: ['3'], description: 'Switch to Tomes tab' },
            { keys: ['4'], description: 'Switch to Characters tab' },
            { keys: ['5'], description: 'Switch to Shrines tab' },
            { keys: ['6'], description: 'Switch to Build Planner tab' },
            { keys: ['7'], description: 'Switch to Calculator tab' },
            { keys: ['8'], description: 'Switch to Changelog tab' },
        ],
    },
    {
        category: 'Search & Filter',
        shortcuts: [
            { keys: ['/'], description: 'Focus search box' },
            { keys: ['Ctrl', 'F'], description: 'Focus search box (alternative)' },
            { keys: ['Escape'], description: 'Clear search and focus' },
            { keys: ['Ctrl', 'K'], description: 'Clear all filters' },
        ],
    },
    {
        category: 'View',
        shortcuts: [
            { keys: ['G'], description: 'Toggle grid view' },
            { keys: ['L'], description: 'Toggle list view' },
            { keys: ['C'], description: 'Toggle compare mode' },
            { keys: ['T'], description: 'Toggle dark/light theme' },
        ],
    },
    {
        category: 'Modal',
        shortcuts: [
            { keys: ['Escape'], description: 'Close modal/dialog' },
            { keys: ['Enter'], description: 'Confirm action in modal' },
        ],
    },
    {
        category: 'Help',
        shortcuts: [
            { keys: ['?'], description: 'Show keyboard shortcuts' },
            { keys: ['Shift', '?'], description: 'Show keyboard shortcuts' },
        ],
    },
]);
function $c() {
    (Sc && (document.removeEventListener('keydown', Sc), (Sc = null)),
        (Sc = e => {
            const t = e.target;
            if (!(t && t.matches && t.matches('input, textarea, select'))) {
                if ('?' === e.key || (e.shiftKey && '?' === e.key))
                    return (
                        e.preventDefault(),
                        void (function () {
                            const e = document.getElementById('shortcuts-modal');
                            if (e) return void e.remove();
                            const t = document.createElement('div');
                            ((t.id = 'shortcuts-modal'), (t.className = 'modal shortcuts-modal'));
                            const n = Cc.map(
                                e =>
                                    `\n        <div class="shortcuts-category">\n            <h3 class="shortcuts-category-title">${e.category}</h3>\n            <div class="shortcuts-list">\n                ${e.shortcuts.map(e => `\n                    <div class="shortcut-item">\n                        <div class="shortcut-keys">\n                            ${e.keys.map(e => `<kbd class="shortcut-key">${e}</kbd>`).join('<span class="key-separator">+</span>')}\n                        </div>\n                        <div class="shortcut-description">${e.description}</div>\n                    </div>\n                `).join('')}\n            </div>\n        </div>\n    `
                            ).join('');
                            ((t.innerHTML = `\n        <div class="modal-content shortcuts-modal-content">\n            <button class="modal-close" id="shortcuts-modal-close">&times;</button>\n            <div class="modal-header">\n                <h2>⌨️ Keyboard Shortcuts</h2>\n                <p class="modal-subtitle">Navigate faster with keyboard shortcuts</p>\n            </div>\n            <div class="modal-body shortcuts-modal-body">\n                ${n}\n            </div>\n            <div class="modal-footer">\n                <p class="shortcuts-tip">\n                    💡 Tip: Press <kbd>?</kbd> anytime to toggle this help\n                </p>\n            </div>\n        </div>\n    `),
                                document.body.appendChild(t),
                                (t.style.display = 'block'));
                            const a = new AbortController(),
                                { signal: i } = a,
                                o = () => {
                                    (a.abort(),
                                        t.classList.remove('active'),
                                        document.body.classList.remove('modal-open'),
                                        setTimeout(() => {
                                            t.remove();
                                        }, 300));
                                },
                                r = document.getElementById('shortcuts-modal-close');
                            (r && r.addEventListener('click', o, { signal: i }),
                                t.addEventListener(
                                    'click',
                                    e => {
                                        e.target === t && o();
                                    },
                                    { signal: i }
                                ),
                                document.addEventListener(
                                    'keydown',
                                    e => {
                                        'Escape' === e.key && o();
                                    },
                                    { signal: i }
                                ),
                                requestAnimationFrame(() => {
                                    (t.classList.add('active'), document.body.classList.add('modal-open'));
                                }));
                        })()
                    );
                if (e.key >= '1' && e.key <= '9' && !e.ctrlKey && !e.metaKey) {
                    e.preventDefault();
                    const t = [
                            'items',
                            'weapons',
                            'tomes',
                            'characters',
                            'shrines',
                            'build-planner',
                            'calculator',
                            'advisor',
                            'changelog',
                        ],
                        n = parseInt(e.key) - 1,
                        a = document.querySelector(`[data-tab="${t[n]}"]`);
                    return void (a && a.click());
                }
                if ('/' === e.key || (e.ctrlKey && 'f' === e.key)) {
                    e.preventDefault();
                    const t = document.getElementById('searchInput');
                    return void (t && (t.focus(), t.select()));
                }
                if (e.ctrlKey && 'k' === e.key) {
                    e.preventDefault();
                    const t = document.querySelector('[onclick="clearFilters()"]');
                    return void (t && t.click());
                }
                if ('Escape' === e.key) {
                    const t = document.getElementById('searchInput');
                    return void (
                        t &&
                        t.value &&
                        (e.preventDefault(),
                        (t.value = ''),
                        t.dispatchEvent(new Event('input', { bubbles: !0 })),
                        t.blur())
                    );
                }
                if ('g' === e.key.toLowerCase()) {
                    e.preventDefault();
                    const t = document.querySelector('[data-view="grid"]');
                    return void (t && t.click());
                }
                if ('l' === e.key.toLowerCase()) {
                    e.preventDefault();
                    const t = document.querySelector('[data-view="list"]');
                    return void (t && t.click());
                }
                if ('c' === e.key.toLowerCase()) {
                    e.preventDefault();
                    const t = document.getElementById('compare-mode-toggle');
                    return void (t && t.click());
                }
                if ('t' === e.key.toLowerCase()) {
                    e.preventDefault();
                    const t = document.getElementById('theme-toggle');
                    return void (t && t.click());
                }
            }
        }),
        document.addEventListener('keydown', Sc));
}
const Mc = Object.freeze({ DARK: 'dark', LIGHT: 'light' }),
    Tc = 'megabonk-theme',
    Ac = Object.freeze({
        '--rarity-common': '#4a7c4a',
        '--rarity-uncommon': '#2a8ca0',
        '--rarity-rare': '#9c2db0',
        '--rarity-epic': '#6b3cc6',
        '--rarity-legendary': '#c08000',
        '--bg-primary': '#ffffff',
        '--bg-elevated': '#f5f5f5',
        '--bg-subtle': '#e5e5e5',
        '--text-primary': '#1a1a1a',
        '--text-secondary': '#666666',
        '--accent': '#d62f4a',
        '--accent-hover': '#c91d38',
        '--chart-line': '#d62f4a',
        '--chart-fill': 'rgba(214, 47, 74, 0.1)',
        '--chart-grid': 'rgba(0, 0, 0, 0.1)',
        '--chart-text': '#666666',
        '--tier-ss': '#ffd700',
        '--tier-s': '#22c55e',
        '--tier-a': '#3b82f6',
        '--tier-b': '#f59e0b',
        '--tier-c': '#ef4444',
    }),
    Ic = Object.freeze({
        '--rarity-common': '#6b9b6b',
        '--rarity-uncommon': '#5bb8d0',
        '--rarity-rare': '#c94de0',
        '--rarity-epic': '#8b5cf6',
        '--rarity-legendary': '#f0a800',
        '--bg-primary': '#0f0f14',
        '--bg-elevated': '#1a1a24',
        '--bg-subtle': '#252530',
        '--text-primary': '#ffffff',
        '--text-secondary': '#8b8b9b',
        '--accent': '#e94560',
        '--accent-hover': '#ff6b8a',
        '--chart-line': '#e94560',
        '--chart-fill': 'rgba(233, 69, 96, 0.2)',
        '--chart-grid': 'rgba(255, 255, 255, 0.1)',
        '--chart-text': '#8b8b9b',
        '--tier-ss': '#ffd700',
        '--tier-s': '#22c55e',
        '--tier-a': '#3b82f6',
        '--tier-b': '#f59e0b',
        '--tier-c': '#ef4444',
    });
const Lc = new (class {
    constructor() {
        this.currentTheme = this.getStoredTheme() || this.getSystemTheme();
    }
    getStoredTheme() {
        try {
            const e = localStorage.getItem(Tc);
            return 'dark' === e || 'light' === e ? e : null;
        } catch (e) {
            return null;
        }
    }
    getSystemTheme() {
        return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? Mc.DARK : Mc.LIGHT;
    }
    applyTheme(e) {
        const t = document.documentElement,
            n = e === Mc.LIGHT ? Ac : Ic;
        (Object.entries(n).forEach(([e, n]) => {
            t.style.setProperty(e, n);
        }),
            t.setAttribute('data-theme', e),
            (this.currentTheme = e));
        try {
            localStorage.setItem(Tc, e);
        } catch (a) {
            zi.warn({
                operation: 'theme.storage',
                error: { name: 'StorageError', message: 'Failed to store theme preference', module: 'theme-manager' },
            });
        }
    }
    toggleTheme() {
        const e = this.currentTheme === Mc.DARK ? Mc.LIGHT : Mc.DARK;
        return (this.applyTheme(e), e);
    }
    setTheme(e) {
        (e !== Mc.DARK && e !== Mc.LIGHT) || this.applyTheme(e);
    }
    getTheme() {
        return this.currentTheme;
    }
    init() {
        (this.applyTheme(this.currentTheme),
            window.matchMedia &&
                window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
                    if (!this.getStoredTheme()) {
                        const t = e.matches ? Mc.DARK : Mc.LIGHT;
                        this.applyTheme(t);
                    }
                }),
            this.createThemeToggleButton());
    }
    createThemeToggleButton() {
        if (document.getElementById('theme-toggle')) return;
        const e = document.createElement('button');
        ((e.id = 'theme-toggle'),
            (e.className = 'theme-toggle'),
            e.setAttribute('aria-label', 'Toggle theme'),
            e.setAttribute('title', 'Toggle dark/light theme (T)'));
        const t = () => {
            e.innerHTML = this.currentTheme === Mc.DARK ? '☀️' : '🌙';
        };
        (t(),
            e.addEventListener('click', () => {
                (this.toggleTheme(), t());
            }),
            document.body.appendChild(e));
    }
})();
let zc = -1;
const Dc = e => {
        addEventListener(
            'pageshow',
            t => {
                t.persisted && ((zc = t.timeStamp), e(t));
            },
            !0
        );
    },
    Fc = (e, t, n, a) => {
        let i, o;
        return r => {
            var s, c;
            t.value >= 0 &&
                (r || a) &&
                ((o = t.value - (i ?? 0)),
                (o || void 0 === i) &&
                    ((i = t.value),
                    (t.delta = o),
                    (t.rating = (s = t.value) > (c = n)[1] ? 'poor' : s > c[0] ? 'needs-improvement' : 'good'),
                    e(t)));
        };
    },
    Oc = e => {
        requestAnimationFrame(() => requestAnimationFrame(() => e()));
    },
    Rc = () => {
        const e = performance.getEntriesByType('navigation')[0];
        if (e && e.responseStart > 0 && e.responseStart < performance.now()) return e;
    },
    Pc = () => {
        const e = Rc();
        return e?.activationStart ?? 0;
    },
    Nc = (e, t = -1) => {
        const n = Rc();
        let a = 'navigate';
        return (
            zc >= 0
                ? (a = 'back-forward-cache')
                : n &&
                  (document.prerendering || Pc() > 0
                      ? (a = 'prerender')
                      : document.wasDiscarded
                        ? (a = 'restore')
                        : n.type && (a = n.type.replace(/_/g, '-'))),
            {
                name: e,
                value: t,
                rating: 'good',
                delta: 0,
                entries: [],
                id: `v5-${Date.now()}-${Math.floor(8999999999999 * Math.random()) + 1e12}`,
                navigationType: a,
            }
        );
    },
    Bc = new WeakMap();
function jc(e, t) {
    return (Bc.get(e) || Bc.set(e, new t()), Bc.get(e));
}
class qc {
    t;
    i = 0;
    o = [];
    h(e) {
        if (e.hadRecentInput) return;
        const t = this.o[0],
            n = this.o.at(-1);
        (this.i && t && n && e.startTime - n.startTime < 1e3 && e.startTime - t.startTime < 5e3
            ? ((this.i += e.value), this.o.push(e))
            : ((this.i = e.value), (this.o = [e])),
            this.t?.(e));
    }
}
const Hc = (e, t, n = {}) => {
        try {
            if (PerformanceObserver.supportedEntryTypes.includes(e)) {
                const a = new PerformanceObserver(e => {
                    Promise.resolve().then(() => {
                        t(e.getEntries());
                    });
                });
                return (a.observe({ type: e, buffered: !0, ...n }), a);
            }
        } catch {}
    },
    Zc = e => {
        let t = !1;
        return () => {
            t || (e(), (t = !0));
        };
    };
let Uc = -1;
const Vc = new Set(),
    Wc = () => ('hidden' !== document.visibilityState || document.prerendering ? 1 / 0 : 0),
    Jc = e => {
        if ('hidden' === document.visibilityState) {
            if ('visibilitychange' === e.type) for (const e of Vc) e();
            isFinite(Uc) ||
                ((Uc = 'visibilitychange' === e.type ? e.timeStamp : 0),
                removeEventListener('prerenderingchange', Jc, !0));
        }
    },
    Kc = () => {
        if (Uc < 0) {
            const e = Pc(),
                t = document.prerendering
                    ? void 0
                    : globalThis.performance
                          .getEntriesByType('visibility-state')
                          .filter(t => 'hidden' === t.name && t.startTime > e)[0]?.startTime;
            ((Uc = t ?? Wc()),
                addEventListener('visibilitychange', Jc, !0),
                addEventListener('prerenderingchange', Jc, !0),
                Dc(() => {
                    setTimeout(() => {
                        Uc = Wc();
                    });
                }));
        }
        return {
            get firstHiddenTime() {
                return Uc;
            },
            onHidden(e) {
                Vc.add(e);
            },
        };
    },
    Gc = e => {
        document.prerendering ? addEventListener('prerenderingchange', () => e(), !0) : e();
    },
    Yc = [1800, 3e3],
    Xc = (e, t = {}) => {
        Gc(() => {
            const n = Kc();
            let a,
                i = Nc('FCP');
            const o = Hc('paint', e => {
                for (const t of e)
                    'first-contentful-paint' === t.name &&
                        (o.disconnect(),
                        t.startTime < n.firstHiddenTime &&
                            ((i.value = Math.max(t.startTime - Pc(), 0)), i.entries.push(t), a(!0)));
            });
            o &&
                ((a = Fc(e, i, Yc, t.reportAllChanges)),
                Dc(n => {
                    ((i = Nc('FCP')),
                        (a = Fc(e, i, Yc, t.reportAllChanges)),
                        Oc(() => {
                            ((i.value = performance.now() - n.timeStamp), a(!0));
                        }));
                }));
        });
    },
    Qc = [0.1, 0.25];
let el = 0,
    tl = 1 / 0,
    nl = 0;
const al = e => {
    for (const t of e)
        t.interactionId &&
            ((tl = Math.min(tl, t.interactionId)),
            (nl = Math.max(nl, t.interactionId)),
            (el = nl ? (nl - tl) / 7 + 1 : 0));
};
let il;
const ol = () => (il ? el : (performance.interactionCount ?? 0));
let rl = 0;
class sl {
    u = [];
    l = new Map();
    m;
    p;
    v() {
        ((rl = ol()), (this.u.length = 0), this.l.clear());
    }
    L() {
        const e = Math.min(this.u.length - 1, Math.floor((ol() - rl) / 50));
        return this.u[e];
    }
    h(e) {
        if ((this.m?.(e), !e.interactionId && 'first-input' !== e.entryType)) return;
        const t = this.u.at(-1);
        let n = this.l.get(e.interactionId);
        if (n || this.u.length < 10 || e.duration > t.P) {
            if (
                (n
                    ? e.duration > n.P
                        ? ((n.entries = [e]), (n.P = e.duration))
                        : e.duration === n.P && e.startTime === n.entries[0].startTime && n.entries.push(e)
                    : ((n = { id: e.interactionId, entries: [e], P: e.duration }), this.l.set(n.id, n), this.u.push(n)),
                this.u.sort((e, t) => t.P - e.P),
                this.u.length > 10)
            ) {
                const e = this.u.splice(10);
                for (const t of e) this.l.delete(t.id);
            }
            this.p?.(n);
        }
    }
}
const cl = e => {
        const t = globalThis.requestIdleCallback || setTimeout;
        'hidden' === document.visibilityState
            ? e()
            : ((e = Zc(e)),
              addEventListener('visibilitychange', e, { once: !0, capture: !0 }),
              t(() => {
                  (e(), removeEventListener('visibilitychange', e, { capture: !0 }));
              }));
    },
    ll = [200, 500],
    dl = (e, t = {}) => {
        if (!globalThis.PerformanceEventTiming || !('interactionId' in PerformanceEventTiming.prototype)) return;
        const n = Kc();
        Gc(() => {
            'interactionCount' in performance ||
                il ||
                (il = Hc('event', al, { type: 'event', buffered: !0, durationThreshold: 0 }));
            let a,
                i = Nc('INP');
            const o = jc(t, sl),
                r = e => {
                    cl(() => {
                        for (const n of e) o.h(n);
                        const t = o.L();
                        t && t.P !== i.value && ((i.value = t.P), (i.entries = t.entries), a());
                    });
                },
                s = Hc('event', r, { durationThreshold: t.durationThreshold ?? 40 });
            ((a = Fc(e, i, ll, t.reportAllChanges)),
                s &&
                    (s.observe({ type: 'first-input', buffered: !0 }),
                    n.onHidden(() => {
                        (r(s.takeRecords()), a(!0));
                    }),
                    Dc(() => {
                        (o.v(), (i = Nc('INP')), (a = Fc(e, i, ll, t.reportAllChanges)));
                    })));
        });
    };
class ul {
    m;
    h(e) {
        this.m?.(e);
    }
}
const hl = [2500, 4e3],
    ml = [800, 1800],
    pl = e => {
        document.prerendering
            ? Gc(() => pl(e))
            : 'complete' !== document.readyState
              ? addEventListener('load', () => pl(e), !0)
              : setTimeout(e);
    },
    fl = { CLS: null, FCP: null, LCP: null, TTFB: null, INP: null };
function gl(e) {
    const { name: t, value: n, rating: a, delta: i, id: o } = e,
        r = (function (e, t) {
            return 'CLS' === e ? t.toFixed(3) : `${Math.round(t)}ms`;
        })(t, n);
    fl[t] = { value: n, rating: a, formattedValue: r, delta: i, id: o };
}
function yl(e) {
    (gl(e),
        (function (e) {
            'undefined' != typeof gtag &&
                gtag('event', e.name, {
                    value: Math.round('CLS' === e.name ? 1e3 * e.value : e.value),
                    metric_id: e.id,
                    metric_value: e.value,
                    metric_delta: e.delta,
                    metric_rating: e.rating,
                });
        })(e));
}
function vl() {
    try {
        (((e, t = {}) => {
            const n = Kc();
            Xc(
                Zc(() => {
                    let a,
                        i = Nc('CLS', 0);
                    const o = jc(t, qc),
                        r = e => {
                            for (const t of e) o.h(t);
                            o.i > i.value && ((i.value = o.i), (i.entries = o.o), a());
                        },
                        s = Hc('layout-shift', r);
                    s &&
                        ((a = Fc(e, i, Qc, t.reportAllChanges)),
                        n.onHidden(() => {
                            (r(s.takeRecords()), a(!0));
                        }),
                        Dc(() => {
                            ((o.i = 0), (i = Nc('CLS', 0)), (a = Fc(e, i, Qc, t.reportAllChanges)), Oc(() => a()));
                        }),
                        setTimeout(a));
                })
            );
        })(yl),
            Xc(yl),
            ((e, t = {}) => {
                Gc(() => {
                    const n = Kc();
                    let a,
                        i = Nc('LCP');
                    const o = jc(t, ul),
                        r = e => {
                            t.reportAllChanges || (e = e.slice(-1));
                            for (const t of e)
                                (o.h(t),
                                    t.startTime < n.firstHiddenTime &&
                                        ((i.value = Math.max(t.startTime - Pc(), 0)), (i.entries = [t]), a()));
                        },
                        s = Hc('largest-contentful-paint', r);
                    if (s) {
                        a = Fc(e, i, hl, t.reportAllChanges);
                        const n = Zc(() => {
                                (r(s.takeRecords()), s.disconnect(), a(!0));
                            }),
                            o = e => {
                                e.isTrusted && (cl(n), removeEventListener(e.type, o, { capture: !0 }));
                            };
                        for (const e of ['keydown', 'click', 'visibilitychange'])
                            addEventListener(e, o, { capture: !0 });
                        Dc(n => {
                            ((i = Nc('LCP')),
                                (a = Fc(e, i, hl, t.reportAllChanges)),
                                Oc(() => {
                                    ((i.value = performance.now() - n.timeStamp), a(!0));
                                }));
                        });
                    }
                });
            })(yl),
            ((e, t = {}) => {
                let n = Nc('TTFB'),
                    a = Fc(e, n, ml, t.reportAllChanges);
                pl(() => {
                    const i = Rc();
                    i &&
                        ((n.value = Math.max(i.responseStart - Pc(), 0)),
                        (n.entries = [i]),
                        a(!0),
                        Dc(() => {
                            ((n = Nc('TTFB', 0)), (a = Fc(e, n, ml, t.reportAllChanges)), a(!0));
                        }));
                });
            })(yl),
            dl(yl),
            zi.info({ operation: 'webvitals.init', data: { status: 'initialized' } }),
            window.addEventListener('load', () => {
                setTimeout(() => {
                    bl();
                }, 3e3);
            }));
    } catch (e) {
        const t = e;
        zi.error({ operation: 'webvitals.init', error: { name: t.name, message: t.message } });
    }
}
function bl() {
    const e = Object.entries(fl).filter(([e, t]) => null !== t);
    if (0 === e.length) return;
    e.forEach(([e, t]) => {
        'good' === t.rating || t.rating;
    });
    const t = e.filter(([e, t]) => 'good' === t.rating).length,
        n = e.length;
    Math.round((t / n) * 100);
}
const wl = [
        { tab: 'build-planner', label: 'Build', icon: '🛠️' },
        { tab: 'advisor', label: 'Advisor', icon: '🤖' },
        { tab: 'characters', label: 'Characters', icon: '👤' },
        { tab: 'calculator', label: 'Calculator', icon: '🧮' },
        { tab: 'changelog', label: 'Changelog', icon: '📋' },
        { tab: 'about', label: 'About', icon: 'ℹ️' },
    ],
    _l = wl.map(e => e.tab);
let kl = !1,
    xl = null,
    El = [];
function Sl(e) {
    const t = ho('more-menu');
    if (!t) return;
    t.querySelectorAll('.more-menu-item').forEach(t => {
        const n = t,
            a = n.dataset.tab === e;
        (n.classList.toggle('current', a), n.setAttribute('aria-current', a ? 'page' : 'false'));
    });
}
function Cl(e) {
    if ('Tab' !== e.key || !kl) return;
    if (
        ((El = (function () {
            const e = ho('more-menu');
            return e
                ? Array.from(e.querySelectorAll('button:not([disabled]), [tabindex]:not([tabindex="-1"])')).filter(
                      e => null !== e.offsetParent
                  )
                : [];
        })()),
        0 === El.length)
    )
        return;
    const t = El[0],
        n = El[El.length - 1];
    e.shiftKey
        ? document.activeElement === t && (e.preventDefault(), n?.focus())
        : document.activeElement === n && (e.preventDefault(), t?.focus());
}
function $l(e) {
    if (!kl) return;
    const t = ho('more-menu');
    if (t)
        switch (e.key) {
            case 'Escape':
                (e.preventDefault(), Tl());
                break;
            case 'ArrowDown':
            case 'ArrowRight': {
                e.preventDefault();
                const n = Array.from(t.querySelectorAll('.more-menu-item')),
                    a = n.findIndex(e => e === document.activeElement),
                    i = a < n.length - 1 ? a + 1 : 0;
                n[i]?.focus();
                break;
            }
            case 'ArrowUp':
            case 'ArrowLeft': {
                e.preventDefault();
                const n = Array.from(t.querySelectorAll('.more-menu-item')),
                    a = n.findIndex(e => e === document.activeElement),
                    i = a > 0 ? a - 1 : n.length - 1;
                n[i]?.focus();
                break;
            }
            case 'Home': {
                e.preventDefault();
                const n = t.querySelectorAll('.more-menu-item');
                n[0]?.focus();
                break;
            }
            case 'End': {
                e.preventDefault();
                const n = t.querySelectorAll('.more-menu-item');
                n[n.length - 1]?.focus();
                break;
            }
        }
}
function Ml() {
    xl = document.activeElement;
    let e = ho('more-menu');
    if (e) {
        const e = Io('currentTab');
        e && Sl(e);
    } else
        ((e = (function () {
            const e = document.createElement('div');
            ((e.id = 'more-menu'),
                (e.className = 'more-menu'),
                e.setAttribute('role', 'dialog'),
                e.setAttribute('aria-modal', 'true'),
                e.setAttribute('aria-label', 'Additional navigation tabs'));
            const t = Io('currentTab');
            return (
                (e.innerHTML = `\n        <div class="more-menu-backdrop" aria-hidden="true"></div>\n        <div class="more-menu-drawer" role="document">\n            <div class="more-menu-handle" aria-hidden="true"></div>\n            <div class="more-menu-header">\n                <span class="more-menu-title" id="more-menu-title">More Options</span>\n                <button class="more-menu-close" aria-label="Close menu" type="button">\n                    <span aria-hidden="true">×</span>\n                </button>\n            </div>\n            <div class="more-menu-items" role="menu" aria-labelledby="more-menu-title">\n                ${wl.map(({ tab: e, label: n, icon: a }) => `\n                    <button \n                        class="more-menu-item${t === e ? ' current' : ''}" \n                        data-tab="${e}" \n                        role="menuitem"\n                        tabindex="0"\n                        aria-current="${t === e ? 'page' : 'false'}"\n                    >\n                        <span class="menu-icon" aria-hidden="true">${a}</span>\n                        <span class="menu-label">${n}</span>\n                    </button>\n                `).join('')}\n            </div>\n        </div>\n    `),
                e
            );
        })()),
            document.body.appendChild(e),
            (function (e) {
                const t = e.querySelector('.more-menu-backdrop');
                t?.addEventListener('click', Tl);
                const n = e.querySelector('.more-menu-close');
                n?.addEventListener('click', Tl);
                const a = e.querySelector('.more-menu-items');
                (a?.addEventListener('click', e => {
                    const t = e.target.closest('.more-menu-item');
                    if (t) {
                        const e = t.dataset.tab;
                        e && (Al(e), Tl());
                    }
                }),
                    a?.addEventListener('keydown', e => {
                        const t = e;
                        if ('Enter' === t.key || ' ' === t.key) {
                            const e = t.target;
                            if (e.classList.contains('more-menu-item')) {
                                t.preventDefault();
                                const n = e.dataset.tab;
                                n && (Al(n), Tl());
                            }
                        }
                    }));
            })(e));
    ((kl = !0),
        e.classList.add('active'),
        document.body.classList.add('more-menu-open'),
        document.addEventListener('keydown', $l),
        document.addEventListener('keydown', Cl),
        requestAnimationFrame(() => {
            const t = e.querySelector('.more-menu-item');
            t?.focus();
        }),
        zi.debug({ operation: 'mobile-nav.more-menu', data: { action: 'open' } }));
}
function Tl() {
    const e = ho('more-menu');
    e &&
        ((kl = !1),
        e.classList.remove('active'),
        document.body.classList.remove('more-menu-open'),
        document.removeEventListener('keydown', $l),
        document.removeEventListener('keydown', Cl),
        xl && (xl.focus(), (xl = null)),
        zi.debug({ operation: 'mobile-nav.more-menu', data: { action: 'close' } }));
}
function Al(e) {
    const t = mo(`.tab-btn[data-tab="${e}"]`);
    t ? t.click() : Lo('currentTab', e);
}
function Il(e) {
    const t = po('.mobile-bottom-nav .nav-item'),
        n = _l.includes(e),
        a = n ? wl.find(t => t.tab === e) : null;
    (t.forEach(t => {
        const i = t,
            o = i.dataset.tab;
        if ('more' === o) {
            const e = i.querySelector('.nav-icon'),
                t = i.querySelector('span:not(.nav-icon)');
            (n && a
                ? (e && (e.textContent = a.icon),
                  t && (t.textContent = a.label),
                  i.classList.add('active'),
                  i.setAttribute('aria-label', `${a.label} (tap for more options)`))
                : (e && (e.textContent = '≡'),
                  t && (t.textContent = 'More'),
                  i.classList.remove('active'),
                  i.setAttribute('aria-label', 'More tabs')),
                i.setAttribute('aria-expanded', 'false'));
        } else o === e ? i.classList.add('active') : i.classList.remove('active');
    }),
        Sl(e));
}
function Ll(e) {
    const t = e.target.closest('.nav-item');
    if (!t) return;
    const n = t.dataset.tab;
    'more' === n ? (kl ? Tl() : Ml()) : n && (kl && Tl(), Al(n));
}
const zl = {
    items: [
        { id: 'favoritesOnly', label: '⭐ Favorites Only', type: 'checkbox' },
        {
            id: 'rarityFilter',
            label: 'Rarity',
            type: 'select',
            options: [
                { value: 'all', label: 'All Rarities' },
                { value: 'common', label: 'Common' },
                { value: 'uncommon', label: 'Uncommon' },
                { value: 'rare', label: 'Rare' },
                { value: 'epic', label: 'Epic' },
                { value: 'legendary', label: 'Legendary' },
            ],
        },
        {
            id: 'tierFilter',
            label: 'Tier',
            type: 'select',
            options: [
                { value: 'all', label: 'All Tiers' },
                { value: 'SS', label: 'SS Tier' },
                { value: 'S', label: 'S Tier' },
                { value: 'A', label: 'A Tier' },
                { value: 'B', label: 'B Tier' },
                { value: 'C', label: 'C Tier' },
            ],
        },
        {
            id: 'stackingFilter',
            label: 'Stacking',
            type: 'select',
            options: [
                { value: 'all', label: 'All' },
                { value: 'stacks_well', label: 'Stacks Well' },
                { value: 'one_and_done', label: 'One-and-Done' },
            ],
        },
        {
            id: 'sortBy',
            label: 'Sort By',
            type: 'select',
            options: [
                { value: 'name', label: 'Name' },
                { value: 'tier', label: 'Tier' },
                { value: 'rarity', label: 'Rarity' },
            ],
        },
    ],
    weapons: [
        { id: 'favoritesOnly', label: '⭐ Favorites Only', type: 'checkbox' },
        {
            id: 'tierFilter',
            label: 'Tier',
            type: 'select',
            options: [
                { value: 'all', label: 'All Tiers' },
                { value: 'SS', label: 'SS Tier' },
                { value: 'S', label: 'S Tier' },
                { value: 'A', label: 'A Tier' },
                { value: 'B', label: 'B Tier' },
                { value: 'C', label: 'C Tier' },
            ],
        },
        {
            id: 'sortBy',
            label: 'Sort By',
            type: 'select',
            options: [
                { value: 'name', label: 'Name' },
                { value: 'tier', label: 'Tier' },
            ],
        },
    ],
    tomes: [
        { id: 'favoritesOnly', label: '⭐ Favorites Only', type: 'checkbox' },
        {
            id: 'tierFilter',
            label: 'Tier',
            type: 'select',
            options: [
                { value: 'all', label: 'All Tiers' },
                { value: 'SS', label: 'SS Tier' },
                { value: 'S', label: 'S Tier' },
                { value: 'A', label: 'A Tier' },
                { value: 'B', label: 'B Tier' },
                { value: 'C', label: 'C Tier' },
            ],
        },
        {
            id: 'sortBy',
            label: 'Sort By',
            type: 'select',
            options: [
                { value: 'name', label: 'Name' },
                { value: 'tier', label: 'Tier' },
            ],
        },
    ],
    characters: [
        { id: 'favoritesOnly', label: '⭐ Favorites Only', type: 'checkbox' },
        {
            id: 'tierFilter',
            label: 'Tier',
            type: 'select',
            options: [
                { value: 'all', label: 'All Tiers' },
                { value: 'SS', label: 'SS Tier' },
                { value: 'S', label: 'S Tier' },
                { value: 'A', label: 'A Tier' },
                { value: 'B', label: 'B Tier' },
                { value: 'C', label: 'C Tier' },
            ],
        },
        {
            id: 'sortBy',
            label: 'Sort By',
            type: 'select',
            options: [
                { value: 'name', label: 'Name' },
                { value: 'tier', label: 'Tier' },
            ],
        },
    ],
    shrines: [
        { id: 'favoritesOnly', label: '⭐ Favorites Only', type: 'checkbox' },
        {
            id: 'typeFilter',
            label: 'Type',
            type: 'select',
            options: [
                { value: 'all', label: 'All Types' },
                { value: 'stat_upgrade', label: 'Stat Upgrade' },
                { value: 'combat', label: 'Combat' },
                { value: 'utility', label: 'Utility' },
                { value: 'risk_reward', label: 'Risk/Reward' },
            ],
        },
    ],
    changelog: [
        {
            id: 'categoryFilter',
            label: 'Category',
            type: 'select',
            options: [
                { value: 'all', label: 'All Categories' },
                { value: 'balance', label: 'Balance Changes' },
                { value: 'new_content', label: 'New Content' },
                { value: 'bug_fixes', label: 'Bug Fixes' },
                { value: 'removed', label: 'Removed' },
                { value: 'other', label: 'Other' },
            ],
        },
        {
            id: 'sortBy',
            label: 'Sort By',
            type: 'select',
            options: [
                { value: 'date_desc', label: 'Newest First' },
                { value: 'date_asc', label: 'Oldest First' },
            ],
        },
    ],
};
let Dl = !1,
    Fl = null;
function Ol(e) {
    return e
        .map(e =>
            'checkbox' === e.type
                ? `\n                    <div class="filter-group">\n                        <label class="filter-group-checkbox">\n                            <input type="checkbox" id="sheet-${e.id}" data-filter-id="${e.id}" />\n                            <span class="checkbox-label">${e.label}</span>\n                        </label>\n                    </div>\n                `
                : `\n                    <div class="filter-group">\n                        <label class="filter-group-label" for="sheet-${e.id}">${e.label}</label>\n                        <select id="sheet-${e.id}" data-filter-id="${e.id}">\n                            ${e.options?.map(e => `<option value="${e.value}">${e.label}</option>`).join('')}\n                        </select>\n                    </div>\n                `
        )
        .join('');
}
function Rl() {
    const e = mo('.mobile-filter-btn');
    if (!e) return;
    const t = (function () {
            let e = 0;
            const t = Io('currentTab');
            return (
                (zl[t || ''] || []).forEach(t => {
                    const n = ho(t.id);
                    n &&
                        (n instanceof HTMLInputElement && 'checkbox' === n.type
                            ? n.checked && e++
                            : n instanceof HTMLSelectElement &&
                              'all' !== n.value &&
                              'name' !== n.value &&
                              'date_desc' !== n.value &&
                              e++);
                }),
                e
            );
        })(),
        n = e.querySelector('.filter-badge');
    (n && (n.textContent = t.toString()), e.classList.toggle('has-filters', t > 0));
}
function Pl(e) {
    Dl && 'Escape' === e.key && (e.preventDefault(), jl());
}
function Nl(e) {
    if ('Tab' !== e.key || !Dl) return;
    const t = ho('filter-bottom-sheet');
    if (!t) return;
    const n = Array.from(
        t.querySelectorAll('button:not([disabled]), select, input, [tabindex]:not([tabindex="-1"])')
    ).filter(e => null !== e.offsetParent);
    if (0 === n.length) return;
    const a = n[0],
        i = n[n.length - 1];
    e.shiftKey
        ? document.activeElement === a && (e.preventDefault(), i?.focus())
        : document.activeElement === i && (e.preventDefault(), a?.focus());
}
function Bl() {
    Fl = document.activeElement;
    const e = Io('currentTab') || 'items';
    let t = ho('filter-bottom-sheet');
    if (zl[e]) {
        if (t) {
            const n = t.querySelector('#filter-sheet-content');
            if (n) {
                const t = zl[e] || [];
                n.innerHTML = Ol(t);
            }
        } else
            ((t = (function (e) {
                const t = document.createElement('div');
                ((t.id = 'filter-bottom-sheet'),
                    (t.className = 'filter-bottom-sheet'),
                    t.setAttribute('role', 'dialog'),
                    t.setAttribute('aria-modal', 'true'),
                    t.setAttribute('aria-label', 'Filter options'));
                const n = zl[e] || [];
                return (
                    (t.innerHTML = `\n        <div class="filter-sheet-backdrop" aria-hidden="true"></div>\n        <div class="filter-sheet-drawer" role="document">\n            <div class="filter-sheet-handle" aria-hidden="true"></div>\n            <div class="filter-sheet-header">\n                <span class="filter-sheet-title" id="filter-sheet-title">Filters</span>\n                <div class="filter-sheet-actions">\n                    <button class="filter-sheet-clear" type="button">Clear All</button>\n                    <button class="filter-sheet-close" aria-label="Close filters" type="button">\n                        <span aria-hidden="true">×</span>\n                    </button>\n                </div>\n            </div>\n            <div class="filter-sheet-content" id="filter-sheet-content">\n                ${Ol(n)}\n            </div>\n            <div class="filter-sheet-apply">\n                <button type="button" id="filter-sheet-apply-btn">Apply Filters</button>\n            </div>\n        </div>\n    `),
                    t
                );
            })(e)),
                document.body.appendChild(t),
                (function (e) {
                    const t = e.querySelector('.filter-sheet-backdrop');
                    t?.addEventListener('click', jl);
                    const n = e.querySelector('.filter-sheet-close');
                    n?.addEventListener('click', jl);
                    const a = e.querySelector('.filter-sheet-clear');
                    a?.addEventListener('click', () => {
                        !(function () {
                            const e = ho('filter-bottom-sheet');
                            if (!e) return;
                            e.querySelectorAll('[data-filter-id]').forEach(e => {
                                e instanceof HTMLInputElement && 'checkbox' === e.type
                                    ? (e.checked = !1)
                                    : e instanceof HTMLSelectElement && (e.value = 'all');
                            });
                        })();
                    });
                    const i = e.querySelector('#filter-sheet-apply-btn');
                    i?.addEventListener('click', () => {
                        (!(function () {
                            const e = ho('filter-bottom-sheet');
                            if (!e) return;
                            e.querySelectorAll('[data-filter-id]').forEach(e => {
                                const t = e.dataset.filterId;
                                if (!t) return;
                                const n = ho(t);
                                n &&
                                    (e instanceof HTMLInputElement && 'checkbox' === e.type
                                        ? (n.checked = e.checked)
                                        : e instanceof HTMLSelectElement &&
                                          n instanceof HTMLSelectElement &&
                                          (n.value = e.value),
                                    n.dispatchEvent(new Event('change', { bubbles: !0 })));
                            });
                            const t = Io('currentTab');
                            t && Vo(t);
                        })(),
                            jl(),
                            Rl());
                    });
                })(t));
        (!(function () {
            const e = ho('filter-bottom-sheet');
            if (!e) return;
            e.querySelectorAll('[data-filter-id]').forEach(e => {
                const t = e.dataset.filterId;
                if (!t) return;
                const n = ho(t);
                n &&
                    (e instanceof HTMLInputElement && 'checkbox' === e.type
                        ? (e.checked = n.checked)
                        : e instanceof HTMLSelectElement && n instanceof HTMLSelectElement && (e.value = n.value));
            });
        })(),
            (Dl = !0),
            t.classList.add('active'),
            document.body.classList.add('filter-sheet-open'),
            document.addEventListener('keydown', Pl),
            document.addEventListener('keydown', Nl),
            requestAnimationFrame(() => {
                const e = t.querySelector('select, input');
                e?.focus();
            }),
            zi.debug({ operation: 'mobile-filters.sheet', data: { action: 'open', tab: e } }));
    } else zi.debug({ operation: 'mobile-filters.show', data: { tab: e, reason: 'no_filters_for_tab' } });
}
function jl() {
    const e = ho('filter-bottom-sheet');
    e &&
        ((Dl = !1),
        e.classList.remove('active'),
        document.body.classList.remove('filter-sheet-open'),
        document.removeEventListener('keydown', Pl),
        document.removeEventListener('keydown', Nl),
        Fl && (Fl.focus(), (Fl = null)),
        zi.debug({ operation: 'mobile-filters.sheet', data: { action: 'close' } }));
}
function ql() {
    const e = document.createElement('button');
    return (
        (e.className = 'mobile-filter-btn'),
        (e.type = 'button'),
        e.setAttribute('aria-label', 'Open filters'),
        e.setAttribute('aria-haspopup', 'dialog'),
        e.setAttribute('aria-expanded', 'false'),
        (e.innerHTML =
            '\n        <span class="filter-icon" aria-hidden="true">⚙️</span>\n        <span>Filters</span>\n        <span class="filter-badge" aria-hidden="true">0</span>\n    '),
        e.addEventListener('click', () => {
            (Dl ? jl() : Bl(), e.setAttribute('aria-expanded', Dl ? 'true' : 'false'));
        }),
        e
    );
}
function Hl() {
    (!(function () {
        const e = mo('.controls .container');
        if (!e) return;
        if (mo('.mobile-filter-btn')) return;
        const t = ql(),
            n = e.querySelector('.search-box');
        n ? n.after(t) : e.appendChild(t);
    })(),
        zo('currentTab', () => {
            setTimeout(() => {
                Rl();
            }, 100);
        }));
    const e = ho('filters');
    (e &&
        e.addEventListener('change', () => {
            Rl();
        }),
        Rl(),
        zi.info({ operation: 'mobile-filters.init', data: { status: 'initialized' } }));
}
function Zl() {
    return 'undefined' != typeof window && window.localStorage ? window.localStorage : null;
}
let Ul = 'true' === Zl()?.getItem('megabonk_cv_debug'),
    Vl = {
        showRegionBounds: !0,
        showSlotGrid: !0,
        showConfidenceLabels: !0,
        showDetectionBoxes: !0,
        showVarianceHeatmap: !1,
        showDominantColors: !1,
        regionColors: {
            items: '#00ff88',
            weapons: '#ff6b6b',
            tomes: '#4ecdc4',
            character: '#f7dc6f',
            unknown: '#95a5a6',
        },
        fontSize: 12,
        lineWidth: 2,
    };
const Wl = [],
    Jl = {
        totalDetections: 0,
        successfulMatches: 0,
        falsePositives: 0,
        averageConfidence: 0,
        averageProcessingTime: 0,
        regionDetectionAccuracy: 0,
        templateCacheHits: 0,
        templateCacheMisses: 0,
    };
function Kl(e) {
    ((Ul = e),
        Zl()?.setItem('megabonk_cv_debug', String(e)),
        Ql('config', 'Debug mode ' + (e ? 'enabled' : 'disabled'), void 0, 'info'));
}
function Gl() {
    return Ul;
}
function Yl(e) {
    ((Vl = { ...Vl, ...e }), Ql('config', 'Debug options updated', e, 'info'));
}
function Xl() {
    return { ...Vl };
}
function Ql(e, t, n, a = 'debug') {
    const i = { timestamp: Date.now(), category: e, message: t, data: n, level: a };
    if ((Wl.push(i), Wl.length > 500 && Wl.shift(), Ul)) {
    }
}
function ed() {
    return [...Wl];
}
function td() {
    ((Wl.length = 0), Ql('system', 'Logs cleared', void 0, 'info'));
}
function nd() {
    return JSON.stringify(Wl, null, 2);
}
function ad() {
    return { ...Jl };
}
function id() {
    (Object.assign(Jl, {
        totalDetections: 0,
        successfulMatches: 0,
        falsePositives: 0,
        averageConfidence: 0,
        averageProcessingTime: 0,
        regionDetectionAccuracy: 0,
        templateCacheHits: 0,
        templateCacheMisses: 0,
    }),
        Ql('stats', 'Statistics reset', void 0, 'info'));
}
function od(e = 'Initializing...') {
    const t = (function (e, t = {}) {
        const n = document.createElement(e);
        if ((t.className && (n.className = t.className), t.id && (n.id = t.id), t.attributes))
            for (const [a, i] of Object.entries(t.attributes)) n.setAttribute(a, i);
        if (t.dataset) for (const [a, i] of Object.entries(t.dataset)) n.dataset[a] = i;
        if (
            (void 0 !== t.textContent
                ? (n.textContent = t.textContent)
                : void 0 !== t.innerHTML && (n.innerHTML = t.innerHTML),
            t.children)
        )
            for (const a of t.children) n.appendChild(a);
        return n;
    })('div', {
        className: 'scan-progress-overlay',
        innerHTML: `\n            <div class="scan-progress-content">\n                <div class="scan-progress-spinner"></div>\n                <div class="scan-progress-text">${e}</div>\n                <div class="scan-progress-bar">\n                    <div class="scan-progress-fill" style="width: 0%"></div>\n                </div>\n            </div>\n        `,
    });
    return {
        element: t,
        update: (e, n) => {
            const a = t.querySelector('.scan-progress-text'),
                i = t.querySelector('.scan-progress-fill');
            (a && (a.textContent = n), i && (i.style.width = `${Math.min(100, Math.max(0, e))}%`));
        },
        remove: () => {
            t.remove();
        },
    };
}
function rd() {
    const e = [];
    let t = null;
    const n = () => (t || (t = new AbortController()), t);
    return {
        add: (t, n, a, i) => {
            (t.addEventListener(n, a, i), e.push(() => t.removeEventListener(n, a, i)));
        },
        addWithSignal: (e, t, a, i) => {
            const o = n();
            e.addEventListener(t, a, { ...i, signal: o.signal });
        },
        removeAll: () => {
            for (; e.length > 0; ) {
                const t = e.pop();
                try {
                    t?.();
                } catch {}
            }
            t && (t.abort(), (t = null));
        },
        getSignal: () => n().signal,
    };
}
function sd(e, t, n = !0) {
    !(function (e, t, n = 'application/json') {
        const a = new Blob([e], { type: n }),
            i = URL.createObjectURL(a),
            o = document.createElement('a');
        ((o.href = i),
            (o.download = t),
            document.body.appendChild(o),
            o.click(),
            document.body.removeChild(o),
            URL.revokeObjectURL(i));
    })(n ? JSON.stringify(e, null, 2) : JSON.stringify(e), t.endsWith('.json') ? t : `${t}.json`, 'application/json');
}
'undefined' != typeof window &&
    'undefined' != typeof window &&
    ((window.cvDebug = {
        enable: () => Kl(!0),
        disable: () => Kl(!1),
        getLogs: () => ed(),
        getStats: () => ad(),
        clearLogs: () => td(),
        resetStats: () => id(),
        exportLogs: () => nd(),
        setOptions: e => Yl(e),
        getOptions: () => Xl(),
    }),
    Ql('system', 'Debug commands registered. Access via window.cvDebug', void 0, 'info'));
let cd = !1,
    ld = 'all',
    dd = null,
    ud = null;
const hd = rd();
function md() {
    !(function () {
        null !== ud && (clearInterval(ud), (ud = null));
        (hd.removeAll(), (cd = !1), (dd = null));
    })();
    const e = document.getElementById('debug-panel'),
        t = document.getElementById('debug-expand-btn'),
        n = document.getElementById('scan-debug-mode'),
        a = document.getElementById('debug-panel-content');
    e && t && n && a
        ? ((n.checked = Gl()),
          n.checked && e.classList.add('active'),
          hd.add(n, 'change', () => {
              (Kl(n.checked), e.classList.toggle('active', n.checked));
          }),
          hd.add(t, 'click', t => {
              (t.stopPropagation(),
                  (function (e, t) {
                      ((cd = !cd),
                          e.classList.toggle('expanded', cd),
                          (t.style.display = cd ? 'block' : 'none'),
                          cd && (pd(), fd()));
                  })(e, a));
          }),
          (function () {
              const e = Xl(),
                  t = {
                      'debug-show-regions': 'showRegionBounds',
                      'debug-show-slots': 'showSlotGrid',
                      'debug-show-labels': 'showConfidenceLabels',
                      'debug-show-detections': 'showDetectionBoxes',
                      'debug-show-heatmap': 'showVarianceHeatmap',
                      'debug-show-colors': 'showDominantColors',
                  };
              Object.entries(t).forEach(([t, n]) => {
                  const a = document.getElementById(t);
                  a &&
                      ((a.checked = e[n]),
                      hd.add(a, 'change', () => {
                          Yl({ [n]: a.checked });
                      }));
              });
          })(),
          (function () {
              const e = document.getElementById('debug-log-filter');
              e &&
                  hd.add(e, 'change', () => {
                      ((ld = e.value), fd());
                  });
          })(),
          (function () {
              const e = document.getElementById('debug-export-logs');
              e &&
                  hd.add(e, 'click', () => {
                      const e = nd();
                      sd(JSON.parse(e), `megabonk-debug-logs-${Date.now()}`);
                  });
              const t = document.getElementById('debug-clear-logs');
              t &&
                  hd.add(t, 'click', () => {
                      (td(), fd());
                  });
              const n = document.getElementById('debug-reset-stats');
              n &&
                  hd.add(n, 'click', () => {
                      (id(), pd());
                  });
              const a = document.getElementById('debug-download-overlay');
              a &&
                  hd.add(a, 'click', () => {
                      dd &&
                          (function (e, t = 'debug-overlay.png') {
                              const n = document.createElement('a');
                              ((n.href = e),
                                  (n.download = t),
                                  document.body.appendChild(n),
                                  n.click(),
                                  document.body.removeChild(n),
                                  Ql('export', `Downloaded debug image: ${t}`, void 0, 'info'));
                          })(dd, `debug-overlay-${Date.now()}.png`);
                  });
          })(),
          (ud = window.setInterval(() => {
              cd && (pd(), fd());
          }, 1e3)))
        : zi.warn({
              operation: 'debug_ui.init',
              data: { reason: 'missing_elements', hasPanel: !!e, hasExpandBtn: !!t, hasCheckbox: !!n, hasContent: !!a },
          });
}
function pd() {
    const e = ad(),
        t = document.getElementById('debug-stat-total'),
        n = document.getElementById('debug-stat-confidence'),
        a = document.getElementById('debug-stat-time'),
        i = document.getElementById('debug-stat-cache');
    if (
        (t && (t.textContent = String(e.totalDetections)),
        n && (n.textContent = e.averageConfidence > 0 ? `${(100 * e.averageConfidence).toFixed(1)}%` : '-'),
        a && (a.textContent = e.averageProcessingTime > 0 ? `${e.averageProcessingTime.toFixed(0)}ms` : '-'),
        i)
    ) {
        const t = e.templateCacheHits + e.templateCacheMisses;
        i.textContent = t > 0 ? `${e.templateCacheHits}/${t}` : '0/0';
    }
}
function fd() {
    const e = document.getElementById('debug-log-viewer');
    if (!e) return;
    let t = ed();
    'all' !== ld && (t = t.filter(e => e.level === ld));
    const n = t.slice(-50).reverse();
    0 !== n.length
        ? (e.innerHTML = n
              .map(e =>
                  (function (e) {
                      const t = new Date(e.timestamp).toLocaleTimeString('en-US', {
                          hour12: !1,
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                      });
                      return `\n        <div class="debug-log-entry ${gd(e.level)}">\n            <span class="debug-log-time">${t}</span>\n            <span class="debug-log-category">${gd(e.category)}</span>\n            <span class="debug-log-message">${gd(e.message)}</span>\n        </div>\n    `;
                  })(e)
              )
              .join(''))
        : (e.innerHTML = '<p class="debug-log-empty">No logs yet. Run a detection to see logs.</p>');
}
function gd(e) {
    const t = document.createElement('div');
    return ((t.textContent = e), t.innerHTML);
}
function yd(e) {
    dd = e;
    const t = document.getElementById('debug-download-overlay');
    t && (t.disabled = !e);
}
const vd = 120,
    bd = { startY: 0, currentY: 0, isPulling: !1, isRefreshing: !1, indicator: null };
function wd() {
    return window.scrollY <= 0;
}
function _d(e, t = !1) {
    if (!bd.indicator) return;
    const n = Math.min(e / vd, 1),
        a = Math.min(e, 150);
    (bd.indicator.style.setProperty('--pull-distance', `${a}px`),
        bd.indicator.style.setProperty('--pull-progress', `${n}`));
    const i = bd.indicator.querySelector('.pull-refresh-text');
    (i && (i.textContent = t ? 'Refreshing...' : e >= vd ? 'Release to refresh' : 'Pull to refresh'),
        bd.indicator.classList.toggle('active', e > 0),
        bd.indicator.classList.toggle('threshold-reached', e >= vd),
        bd.indicator.classList.toggle('refreshing', t));
}
function kd() {
    bd.indicator &&
        (bd.indicator.classList.add('resetting'),
        _d(0, !1),
        setTimeout(() => {
            bd.indicator?.classList.remove('active', 'threshold-reached', 'refreshing', 'resetting');
        }, 300));
}
function xd(e) {
    if (!wd() || bd.isRefreshing) return;
    const t = e.touches[0];
    t && ((bd.startY = t.clientY), (bd.isPulling = !0));
}
function Ed(e) {
    if (!bd.isPulling || bd.isRefreshing) return;
    if (!wd()) return void (bd.isPulling = !1);
    const t = e.touches[0];
    if (!t) return;
    bd.currentY = t.clientY;
    let n = bd.currentY - bd.startY;
    if (n < 0) return ((n = 0), void (bd.isPulling = !1));
    if (n > vd) {
        n = vd + 0.3 * (n - vd);
    }
    (n > 10 && e.preventDefault(), _d(n));
}
async function Sd() {
    if (!bd.isPulling) return;
    bd.isPulling = !1;
    (bd.currentY - bd.startY >= vd && !bd.isRefreshing
        ? await (async function () {
              ((bd.isRefreshing = !0),
                  _d(vd, !0),
                  zi.info({ operation: 'pull-refresh.triggered', data: { source: 'touch-gesture' } }));
              const t = performance.now();
              try {
                  await uc();
                  const n = Math.round(performance.now() - t);
                  (zi.info({ operation: 'pull-refresh.complete', durationMs: n, success: !0 }),
                      e.success('Data refreshed!'));
              } catch (n) {
                  const t = n;
                  (zi.error({
                      operation: 'pull-refresh.failed',
                      error: { name: t.name, message: t.message, module: 'pull-refresh' },
                  }),
                      e.error('Failed to refresh data'));
              } finally {
                  ((bd.isRefreshing = !1), kd());
              }
          })()
        : kd(),
        (bd.startY = 0),
        (bd.currentY = 0));
}
function Cd() {
    'ontouchstart' in window || navigator.maxTouchPoints > 0
        ? ((bd.indicator = (function () {
              const e = document.createElement('div');
              return (
                  (e.className = 'pull-refresh-indicator'),
                  (e.innerHTML =
                      '\n        <div class="pull-refresh-content">\n            <div class="pull-refresh-spinner"></div>\n            <span class="pull-refresh-text">Pull to refresh</span>\n        </div>\n    '),
                  document.body.prepend(e),
                  e
              );
          })()),
          document.addEventListener('touchstart', xd, { passive: !0 }),
          document.addEventListener('touchmove', Ed, { passive: !1 }),
          document.addEventListener('touchend', Sd, { passive: !0 }),
          zi.info({ operation: 'pull-refresh.init', data: { enabled: !0 } }))
        : zi.debug({ operation: 'pull-refresh.skip', data: { reason: 'not_touch_device' } });
}
'undefined' != typeof window &&
    Object.assign(window, {
        initPullRefresh: Cd,
        cleanupPullRefresh: function () {
            (document.removeEventListener('touchstart', xd),
                document.removeEventListener('touchmove', Ed),
                document.removeEventListener('touchend', Sd),
                bd.indicator && (bd.indicator.remove(), (bd.indicator = null)),
                (bd.isPulling = !1),
                (bd.isRefreshing = !1));
        },
    });
function $d(e, t, n) {
    return new Promise((a, i) => {
        const o = setTimeout(() => {
            i(new Error(`${n} timed out after ${t}ms`));
        }, t);
        e.then(e => {
            (clearTimeout(o), a(e));
        }).catch(e => {
            (clearTimeout(o), i(e));
        });
    });
}
function Md(e) {
    return new Promise(t => setTimeout(t, e));
}
let Td = null,
    Ad = null,
    Id = null;
async function Ld() {
    if (Ad) return Ad;
    if (Id && (await Id, Ad)) return Ad;
    const e = await (async function () {
        return (
            Td ||
                (zi.info({ operation: 'ocr.lazy_load', data: { module: 'tesseract.js', phase: 'start' } }),
                (Td = await n(() => import('./index-B231jng3.js').then(e => e.i), [])),
                zi.info({ operation: 'ocr.lazy_load', data: { module: 'tesseract.js', phase: 'complete' } })),
            Td
        );
    })();
    if (Ad) return Ad;
    Id = (async () => {
        if (!Ad) {
            zi.info({ operation: 'ocr.worker_init', data: { phase: 'start' } });
            try {
                const t = await e.createWorker('eng', 1, {
                    logger: e => {
                        ('loading tesseract core' !== e.status && 'initializing api' !== e.status) ||
                            zi.debug({
                                operation: 'ocr.worker_progress',
                                data: { status: e.status, progress: e.progress },
                            });
                    },
                });
                (Ad ? await t.terminate() : (Ad = t),
                    zi.info({ operation: 'ocr.worker_init', data: { phase: 'complete' } }));
            } catch (t) {
                throw (
                    zi.error({
                        operation: 'ocr.worker_init',
                        error: { name: t.name, message: t.message, module: 'ocr' },
                    }),
                    t
                );
            }
        }
    })();
    try {
        await Id;
    } finally {
        Id = null;
    }
    if (!Ad) throw new Error('Failed to initialize OCR worker');
    return Ad;
}
async function zd() {
    if (Ad) {
        zi.info({ operation: 'ocr.worker_terminate', data: { phase: 'start' } });
        try {
            (await Ad.terminate(),
                (Ad = null),
                (Id = null),
                zi.info({ operation: 'ocr.worker_terminate', data: { phase: 'complete' } }));
        } catch (e) {
            (zi.warn({ operation: 'ocr.worker_terminate', error: { name: e.name, message: e.message, module: 'ocr' } }),
                (Ad = null),
                (Id = null));
        }
    }
}
function Dd(e) {
    return Array.isArray ? Array.isArray(e) : '[object Array]' === jd(e);
}
function Fd(e) {
    return 'string' == typeof e;
}
function Od(e) {
    return 'number' == typeof e;
}
function Rd(e) {
    return (
        !0 === e ||
        !1 === e ||
        ((function (e) {
            return Pd(e) && null !== e;
        })(e) &&
            '[object Boolean]' == jd(e))
    );
}
function Pd(e) {
    return 'object' == typeof e;
}
function Nd(e) {
    return null != e;
}
function Bd(e) {
    return !e.trim().length;
}
function jd(e) {
    return null == e ? (void 0 === e ? '[object Undefined]' : '[object Null]') : Object.prototype.toString.call(e);
}
const qd = Object.prototype.hasOwnProperty;
class Hd {
    constructor(e) {
        ((this._keys = []), (this._keyMap = {}));
        let t = 0;
        (e.forEach(e => {
            let n = Zd(e);
            (this._keys.push(n), (this._keyMap[n.id] = n), (t += n.weight));
        }),
            this._keys.forEach(e => {
                e.weight /= t;
            }));
    }
    get(e) {
        return this._keyMap[e];
    }
    keys() {
        return this._keys;
    }
    toJSON() {
        return JSON.stringify(this._keys);
    }
}
function Zd(e) {
    let t = null,
        n = null,
        a = null,
        i = 1,
        o = null;
    if (Fd(e) || Dd(e)) ((a = e), (t = Ud(e)), (n = Vd(e)));
    else {
        if (!qd.call(e, 'name')) throw new Error((e => `Missing ${e} property in key`)('name'));
        const r = e.name;
        if (((a = r), qd.call(e, 'weight') && ((i = e.weight), i <= 0)))
            throw new Error((e => `Property 'weight' in key '${e}' must be a positive integer`)(r));
        ((t = Ud(r)), (n = Vd(r)), (o = e.getFn));
    }
    return { path: t, id: n, weight: i, src: a, getFn: o };
}
function Ud(e) {
    return Dd(e) ? e : e.split('.');
}
function Vd(e) {
    return Dd(e) ? e.join('.') : e;
}
var Wd = {
    isCaseSensitive: !1,
    ignoreDiacritics: !1,
    includeScore: !1,
    keys: [],
    shouldSort: !0,
    sortFn: (e, t) => (e.score === t.score ? (e.idx < t.idx ? -1 : 1) : e.score < t.score ? -1 : 1),
    includeMatches: !1,
    findAllMatches: !1,
    minMatchCharLength: 1,
    location: 0,
    threshold: 0.6,
    distance: 100,
    ...{
        useExtendedSearch: !1,
        getFn: function (e, t) {
            let n = [],
                a = !1;
            const i = (e, t, o) => {
                if (Nd(e))
                    if (t[o]) {
                        const r = e[t[o]];
                        if (!Nd(r)) return;
                        if (o === t.length - 1 && (Fd(r) || Od(r) || Rd(r)))
                            n.push(
                                (function (e) {
                                    return null == e
                                        ? ''
                                        : (function (e) {
                                              if ('string' == typeof e) return e;
                                              let t = e + '';
                                              return '0' == t && 1 / e == -1 / 0 ? '-0' : t;
                                          })(e);
                                })(r)
                            );
                        else if (Dd(r)) {
                            a = !0;
                            for (let e = 0, n = r.length; e < n; e += 1) i(r[e], t, o + 1);
                        } else t.length && i(r, t, o + 1);
                    } else n.push(e);
            };
            return (i(e, Fd(t) ? t.split('.') : t, 0), a ? n : n[0]);
        },
        ignoreLocation: !1,
        ignoreFieldNorm: !1,
        fieldNormWeight: 1,
    },
};
const Jd = /[^ ]+/g;
class Kd {
    constructor({ getFn: e = Wd.getFn, fieldNormWeight: t = Wd.fieldNormWeight } = {}) {
        ((this.norm = (function (e = 1, t = 3) {
            const n = new Map(),
                a = Math.pow(10, t);
            return {
                get(t) {
                    const i = t.match(Jd).length;
                    if (n.has(i)) return n.get(i);
                    const o = 1 / Math.pow(i, 0.5 * e),
                        r = parseFloat(Math.round(o * a) / a);
                    return (n.set(i, r), r);
                },
                clear() {
                    n.clear();
                },
            };
        })(t, 3)),
            (this.getFn = e),
            (this.isCreated = !1),
            this.setIndexRecords());
    }
    setSources(e = []) {
        this.docs = e;
    }
    setIndexRecords(e = []) {
        this.records = e;
    }
    setKeys(e = []) {
        ((this.keys = e),
            (this._keysMap = {}),
            e.forEach((e, t) => {
                this._keysMap[e.id] = t;
            }));
    }
    create() {
        !this.isCreated &&
            this.docs.length &&
            ((this.isCreated = !0),
            Fd(this.docs[0])
                ? this.docs.forEach((e, t) => {
                      this._addString(e, t);
                  })
                : this.docs.forEach((e, t) => {
                      this._addObject(e, t);
                  }),
            this.norm.clear());
    }
    add(e) {
        const t = this.size();
        Fd(e) ? this._addString(e, t) : this._addObject(e, t);
    }
    removeAt(e) {
        this.records.splice(e, 1);
        for (let t = e, n = this.size(); t < n; t += 1) this.records[t].i -= 1;
    }
    getValueForItemAtKeyId(e, t) {
        return e[this._keysMap[t]];
    }
    size() {
        return this.records.length;
    }
    _addString(e, t) {
        if (!Nd(e) || Bd(e)) return;
        let n = { v: e, i: t, n: this.norm.get(e) };
        this.records.push(n);
    }
    _addObject(e, t) {
        let n = { i: t, $: {} };
        (this.keys.forEach((t, a) => {
            let i = t.getFn ? t.getFn(e) : this.getFn(e, t.path);
            if (Nd(i))
                if (Dd(i)) {
                    let e = [];
                    const t = [{ nestedArrIndex: -1, value: i }];
                    for (; t.length; ) {
                        const { nestedArrIndex: n, value: a } = t.pop();
                        if (Nd(a))
                            if (Fd(a) && !Bd(a)) {
                                let t = { v: a, i: n, n: this.norm.get(a) };
                                e.push(t);
                            } else
                                Dd(a) &&
                                    a.forEach((e, n) => {
                                        t.push({ nestedArrIndex: n, value: e });
                                    });
                    }
                    n.$[a] = e;
                } else if (Fd(i) && !Bd(i)) {
                    let e = { v: i, n: this.norm.get(i) };
                    n.$[a] = e;
                }
        }),
            this.records.push(n));
    }
    toJSON() {
        return { keys: this.keys, records: this.records };
    }
}
function Gd(e, t, { getFn: n = Wd.getFn, fieldNormWeight: a = Wd.fieldNormWeight } = {}) {
    const i = new Kd({ getFn: n, fieldNormWeight: a });
    return (i.setKeys(e.map(Zd)), i.setSources(t), i.create(), i);
}
function Yd(
    e,
    {
        errors: t = 0,
        currentLocation: n = 0,
        expectedLocation: a = 0,
        distance: i = Wd.distance,
        ignoreLocation: o = Wd.ignoreLocation,
    } = {}
) {
    const r = t / e.length;
    if (o) return r;
    const s = Math.abs(a - n);
    return i ? r + s / i : s ? 1 : r;
}
const Xd = 32;
function Qd(
    e,
    t,
    n,
    {
        location: a = Wd.location,
        distance: i = Wd.distance,
        threshold: o = Wd.threshold,
        findAllMatches: r = Wd.findAllMatches,
        minMatchCharLength: s = Wd.minMatchCharLength,
        includeMatches: c = Wd.includeMatches,
        ignoreLocation: l = Wd.ignoreLocation,
    } = {}
) {
    if (t.length > Xd) throw new Error(`Pattern length exceeds max of ${Xd}.`);
    const d = t.length,
        u = e.length,
        h = Math.max(0, Math.min(a, u));
    let m = o,
        p = h;
    const f = s > 1 || c,
        g = f ? Array(u) : [];
    let y;
    for (; (y = e.indexOf(t, p)) > -1; ) {
        let e = Yd(t, { currentLocation: y, expectedLocation: h, distance: i, ignoreLocation: l });
        if (((m = Math.min(e, m)), (p = y + d), f)) {
            let e = 0;
            for (; e < d; ) ((g[y + e] = 1), (e += 1));
        }
    }
    p = -1;
    let v = [],
        b = 1,
        w = d + u;
    const _ = 1 << (d - 1);
    for (let x = 0; x < d; x += 1) {
        let a = 0,
            o = w;
        for (; a < o; ) {
            (Yd(t, { errors: x, currentLocation: h + o, expectedLocation: h, distance: i, ignoreLocation: l }) <= m
                ? (a = o)
                : (w = o),
                (o = Math.floor((w - a) / 2 + a)));
        }
        w = o;
        let s = Math.max(1, h - o + 1),
            c = r ? u : Math.min(h + o, u) + d,
            y = Array(c + 2);
        y[c + 1] = (1 << x) - 1;
        for (let r = c; r >= s; r -= 1) {
            let a = r - 1,
                o = n[e.charAt(a)];
            if (
                (f && (g[a] = +!!o),
                (y[r] = ((y[r + 1] << 1) | 1) & o),
                x && (y[r] |= ((v[r + 1] | v[r]) << 1) | 1 | v[r + 1]),
                y[r] & _ &&
                    ((b = Yd(t, {
                        errors: x,
                        currentLocation: a,
                        expectedLocation: h,
                        distance: i,
                        ignoreLocation: l,
                    })),
                    b <= m))
            ) {
                if (((m = b), (p = a), p <= h)) break;
                s = Math.max(1, 2 * h - p);
            }
        }
        if (Yd(t, { errors: x + 1, currentLocation: h, expectedLocation: h, distance: i, ignoreLocation: l }) > m)
            break;
        v = y;
    }
    const k = { isMatch: p >= 0, score: Math.max(0.001, b) };
    if (f) {
        const e = (function (e = [], t = Wd.minMatchCharLength) {
            let n = [],
                a = -1,
                i = -1,
                o = 0;
            for (let r = e.length; o < r; o += 1) {
                let r = e[o];
                r && -1 === a ? (a = o) : r || -1 === a || ((i = o - 1), i - a + 1 >= t && n.push([a, i]), (a = -1));
            }
            return (e[o - 1] && o - a >= t && n.push([a, o - 1]), n);
        })(g, s);
        e.length ? c && (k.indices = e) : (k.isMatch = !1);
    }
    return k;
}
function eu(e) {
    let t = {};
    for (let n = 0, a = e.length; n < a; n += 1) {
        const i = e.charAt(n);
        t[i] = (t[i] || 0) | (1 << (a - n - 1));
    }
    return t;
}
const tu = String.prototype.normalize
    ? e =>
          e
              .normalize('NFD')
              .replace(
                  /[\u0300-\u036F\u0483-\u0489\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED\u0711\u0730-\u074A\u07A6-\u07B0\u07EB-\u07F3\u07FD\u0816-\u0819\u081B-\u0823\u0825-\u0827\u0829-\u082D\u0859-\u085B\u08D3-\u08E1\u08E3-\u0903\u093A-\u093C\u093E-\u094F\u0951-\u0957\u0962\u0963\u0981-\u0983\u09BC\u09BE-\u09C4\u09C7\u09C8\u09CB-\u09CD\u09D7\u09E2\u09E3\u09FE\u0A01-\u0A03\u0A3C\u0A3E-\u0A42\u0A47\u0A48\u0A4B-\u0A4D\u0A51\u0A70\u0A71\u0A75\u0A81-\u0A83\u0ABC\u0ABE-\u0AC5\u0AC7-\u0AC9\u0ACB-\u0ACD\u0AE2\u0AE3\u0AFA-\u0AFF\u0B01-\u0B03\u0B3C\u0B3E-\u0B44\u0B47\u0B48\u0B4B-\u0B4D\u0B56\u0B57\u0B62\u0B63\u0B82\u0BBE-\u0BC2\u0BC6-\u0BC8\u0BCA-\u0BCD\u0BD7\u0C00-\u0C04\u0C3E-\u0C44\u0C46-\u0C48\u0C4A-\u0C4D\u0C55\u0C56\u0C62\u0C63\u0C81-\u0C83\u0CBC\u0CBE-\u0CC4\u0CC6-\u0CC8\u0CCA-\u0CCD\u0CD5\u0CD6\u0CE2\u0CE3\u0D00-\u0D03\u0D3B\u0D3C\u0D3E-\u0D44\u0D46-\u0D48\u0D4A-\u0D4D\u0D57\u0D62\u0D63\u0D82\u0D83\u0DCA\u0DCF-\u0DD4\u0DD6\u0DD8-\u0DDF\u0DF2\u0DF3\u0E31\u0E34-\u0E3A\u0E47-\u0E4E\u0EB1\u0EB4-\u0EB9\u0EBB\u0EBC\u0EC8-\u0ECD\u0F18\u0F19\u0F35\u0F37\u0F39\u0F3E\u0F3F\u0F71-\u0F84\u0F86\u0F87\u0F8D-\u0F97\u0F99-\u0FBC\u0FC6\u102B-\u103E\u1056-\u1059\u105E-\u1060\u1062-\u1064\u1067-\u106D\u1071-\u1074\u1082-\u108D\u108F\u109A-\u109D\u135D-\u135F\u1712-\u1714\u1732-\u1734\u1752\u1753\u1772\u1773\u17B4-\u17D3\u17DD\u180B-\u180D\u1885\u1886\u18A9\u1920-\u192B\u1930-\u193B\u1A17-\u1A1B\u1A55-\u1A5E\u1A60-\u1A7C\u1A7F\u1AB0-\u1ABE\u1B00-\u1B04\u1B34-\u1B44\u1B6B-\u1B73\u1B80-\u1B82\u1BA1-\u1BAD\u1BE6-\u1BF3\u1C24-\u1C37\u1CD0-\u1CD2\u1CD4-\u1CE8\u1CED\u1CF2-\u1CF4\u1CF7-\u1CF9\u1DC0-\u1DF9\u1DFB-\u1DFF\u20D0-\u20F0\u2CEF-\u2CF1\u2D7F\u2DE0-\u2DFF\u302A-\u302F\u3099\u309A\uA66F-\uA672\uA674-\uA67D\uA69E\uA69F\uA6F0\uA6F1\uA802\uA806\uA80B\uA823-\uA827\uA880\uA881\uA8B4-\uA8C5\uA8E0-\uA8F1\uA8FF\uA926-\uA92D\uA947-\uA953\uA980-\uA983\uA9B3-\uA9C0\uA9E5\uAA29-\uAA36\uAA43\uAA4C\uAA4D\uAA7B-\uAA7D\uAAB0\uAAB2-\uAAB4\uAAB7\uAAB8\uAABE\uAABF\uAAC1\uAAEB-\uAAEF\uAAF5\uAAF6\uABE3-\uABEA\uABEC\uABED\uFB1E\uFE00-\uFE0F\uFE20-\uFE2F]/g,
                  ''
              )
    : e => e;
class nu {
    constructor(
        e,
        {
            location: t = Wd.location,
            threshold: n = Wd.threshold,
            distance: a = Wd.distance,
            includeMatches: i = Wd.includeMatches,
            findAllMatches: o = Wd.findAllMatches,
            minMatchCharLength: r = Wd.minMatchCharLength,
            isCaseSensitive: s = Wd.isCaseSensitive,
            ignoreDiacritics: c = Wd.ignoreDiacritics,
            ignoreLocation: l = Wd.ignoreLocation,
        } = {}
    ) {
        if (
            ((this.options = {
                location: t,
                threshold: n,
                distance: a,
                includeMatches: i,
                findAllMatches: o,
                minMatchCharLength: r,
                isCaseSensitive: s,
                ignoreDiacritics: c,
                ignoreLocation: l,
            }),
            (e = s ? e : e.toLowerCase()),
            (e = c ? tu(e) : e),
            (this.pattern = e),
            (this.chunks = []),
            !this.pattern.length)
        )
            return;
        const d = (e, t) => {
                this.chunks.push({ pattern: e, alphabet: eu(e), startIndex: t });
            },
            u = this.pattern.length;
        if (u > Xd) {
            let e = 0;
            const t = u % Xd,
                n = u - t;
            for (; e < n; ) (d(this.pattern.substr(e, Xd), e), (e += Xd));
            if (t) {
                const e = u - Xd;
                d(this.pattern.substr(e), e);
            }
        } else d(this.pattern, 0);
    }
    searchIn(e) {
        const { isCaseSensitive: t, ignoreDiacritics: n, includeMatches: a } = this.options;
        if (((e = t ? e : e.toLowerCase()), (e = n ? tu(e) : e), this.pattern === e)) {
            let t = { isMatch: !0, score: 0 };
            return (a && (t.indices = [[0, e.length - 1]]), t);
        }
        const {
            location: i,
            distance: o,
            threshold: r,
            findAllMatches: s,
            minMatchCharLength: c,
            ignoreLocation: l,
        } = this.options;
        let d = [],
            u = 0,
            h = !1;
        this.chunks.forEach(({ pattern: t, alphabet: n, startIndex: m }) => {
            const {
                isMatch: p,
                score: f,
                indices: g,
            } = Qd(e, t, n, {
                location: i + m,
                distance: o,
                threshold: r,
                findAllMatches: s,
                minMatchCharLength: c,
                includeMatches: a,
                ignoreLocation: l,
            });
            (p && (h = !0), (u += f), p && g && (d = [...d, ...g]));
        });
        let m = { isMatch: h, score: h ? u / this.chunks.length : 1 };
        return (h && a && (m.indices = d), m);
    }
}
class au {
    constructor(e) {
        this.pattern = e;
    }
    static isMultiMatch(e) {
        return iu(e, this.multiRegex);
    }
    static isSingleMatch(e) {
        return iu(e, this.singleRegex);
    }
    search() {}
}
function iu(e, t) {
    const n = e.match(t);
    return n ? n[1] : null;
}
class ou extends au {
    constructor(
        e,
        {
            location: t = Wd.location,
            threshold: n = Wd.threshold,
            distance: a = Wd.distance,
            includeMatches: i = Wd.includeMatches,
            findAllMatches: o = Wd.findAllMatches,
            minMatchCharLength: r = Wd.minMatchCharLength,
            isCaseSensitive: s = Wd.isCaseSensitive,
            ignoreDiacritics: c = Wd.ignoreDiacritics,
            ignoreLocation: l = Wd.ignoreLocation,
        } = {}
    ) {
        (super(e),
            (this._bitapSearch = new nu(e, {
                location: t,
                threshold: n,
                distance: a,
                includeMatches: i,
                findAllMatches: o,
                minMatchCharLength: r,
                isCaseSensitive: s,
                ignoreDiacritics: c,
                ignoreLocation: l,
            })));
    }
    static get type() {
        return 'fuzzy';
    }
    static get multiRegex() {
        return /^"(.*)"$/;
    }
    static get singleRegex() {
        return /^(.*)$/;
    }
    search(e) {
        return this._bitapSearch.searchIn(e);
    }
}
class ru extends au {
    constructor(e) {
        super(e);
    }
    static get type() {
        return 'include';
    }
    static get multiRegex() {
        return /^'"(.*)"$/;
    }
    static get singleRegex() {
        return /^'(.*)$/;
    }
    search(e) {
        let t,
            n = 0;
        const a = [],
            i = this.pattern.length;
        for (; (t = e.indexOf(this.pattern, n)) > -1; ) ((n = t + i), a.push([t, n - 1]));
        const o = !!a.length;
        return { isMatch: o, score: o ? 0 : 1, indices: a };
    }
}
const su = [
        class extends au {
            constructor(e) {
                super(e);
            }
            static get type() {
                return 'exact';
            }
            static get multiRegex() {
                return /^="(.*)"$/;
            }
            static get singleRegex() {
                return /^=(.*)$/;
            }
            search(e) {
                const t = e === this.pattern;
                return { isMatch: t, score: t ? 0 : 1, indices: [0, this.pattern.length - 1] };
            }
        },
        ru,
        class extends au {
            constructor(e) {
                super(e);
            }
            static get type() {
                return 'prefix-exact';
            }
            static get multiRegex() {
                return /^\^"(.*)"$/;
            }
            static get singleRegex() {
                return /^\^(.*)$/;
            }
            search(e) {
                const t = e.startsWith(this.pattern);
                return { isMatch: t, score: t ? 0 : 1, indices: [0, this.pattern.length - 1] };
            }
        },
        class extends au {
            constructor(e) {
                super(e);
            }
            static get type() {
                return 'inverse-prefix-exact';
            }
            static get multiRegex() {
                return /^!\^"(.*)"$/;
            }
            static get singleRegex() {
                return /^!\^(.*)$/;
            }
            search(e) {
                const t = !e.startsWith(this.pattern);
                return { isMatch: t, score: t ? 0 : 1, indices: [0, e.length - 1] };
            }
        },
        class extends au {
            constructor(e) {
                super(e);
            }
            static get type() {
                return 'inverse-suffix-exact';
            }
            static get multiRegex() {
                return /^!"(.*)"\$$/;
            }
            static get singleRegex() {
                return /^!(.*)\$$/;
            }
            search(e) {
                const t = !e.endsWith(this.pattern);
                return { isMatch: t, score: t ? 0 : 1, indices: [0, e.length - 1] };
            }
        },
        class extends au {
            constructor(e) {
                super(e);
            }
            static get type() {
                return 'suffix-exact';
            }
            static get multiRegex() {
                return /^"(.*)"\$$/;
            }
            static get singleRegex() {
                return /^(.*)\$$/;
            }
            search(e) {
                const t = e.endsWith(this.pattern);
                return { isMatch: t, score: t ? 0 : 1, indices: [e.length - this.pattern.length, e.length - 1] };
            }
        },
        class extends au {
            constructor(e) {
                super(e);
            }
            static get type() {
                return 'inverse-exact';
            }
            static get multiRegex() {
                return /^!"(.*)"$/;
            }
            static get singleRegex() {
                return /^!(.*)$/;
            }
            search(e) {
                const t = -1 === e.indexOf(this.pattern);
                return { isMatch: t, score: t ? 0 : 1, indices: [0, e.length - 1] };
            }
        },
        ou,
    ],
    cu = su.length,
    lu = / +(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)/;
const du = new Set([ou.type, ru.type]);
class uu {
    constructor(
        e,
        {
            isCaseSensitive: t = Wd.isCaseSensitive,
            ignoreDiacritics: n = Wd.ignoreDiacritics,
            includeMatches: a = Wd.includeMatches,
            minMatchCharLength: i = Wd.minMatchCharLength,
            ignoreLocation: o = Wd.ignoreLocation,
            findAllMatches: r = Wd.findAllMatches,
            location: s = Wd.location,
            threshold: c = Wd.threshold,
            distance: l = Wd.distance,
        } = {}
    ) {
        ((this.query = null),
            (this.options = {
                isCaseSensitive: t,
                ignoreDiacritics: n,
                includeMatches: a,
                minMatchCharLength: i,
                findAllMatches: r,
                ignoreLocation: o,
                location: s,
                threshold: c,
                distance: l,
            }),
            (e = t ? e : e.toLowerCase()),
            (e = n ? tu(e) : e),
            (this.pattern = e),
            (this.query = (function (e, t = {}) {
                return e.split('|').map(e => {
                    let n = e
                            .trim()
                            .split(lu)
                            .filter(e => e && !!e.trim()),
                        a = [];
                    for (let i = 0, o = n.length; i < o; i += 1) {
                        const e = n[i];
                        let o = !1,
                            r = -1;
                        for (; !o && ++r < cu; ) {
                            const n = su[r];
                            let i = n.isMultiMatch(e);
                            i && (a.push(new n(i, t)), (o = !0));
                        }
                        if (!o)
                            for (r = -1; ++r < cu; ) {
                                const n = su[r];
                                let i = n.isSingleMatch(e);
                                if (i) {
                                    a.push(new n(i, t));
                                    break;
                                }
                            }
                    }
                    return a;
                });
            })(this.pattern, this.options)));
    }
    static condition(e, t) {
        return t.useExtendedSearch;
    }
    searchIn(e) {
        const t = this.query;
        if (!t) return { isMatch: !1, score: 1 };
        const { includeMatches: n, isCaseSensitive: a, ignoreDiacritics: i } = this.options;
        ((e = a ? e : e.toLowerCase()), (e = i ? tu(e) : e));
        let o = 0,
            r = [],
            s = 0;
        for (let c = 0, l = t.length; c < l; c += 1) {
            const a = t[c];
            ((r.length = 0), (o = 0));
            for (let t = 0, i = a.length; t < i; t += 1) {
                const i = a[t],
                    { isMatch: c, indices: l, score: d } = i.search(e);
                if (!c) {
                    ((s = 0), (o = 0), (r.length = 0));
                    break;
                }
                if (((o += 1), (s += d), n)) {
                    const e = i.constructor.type;
                    du.has(e) ? (r = [...r, ...l]) : r.push(l);
                }
            }
            if (o) {
                let e = { isMatch: !0, score: s / o };
                return (n && (e.indices = r), e);
            }
        }
        return { isMatch: !1, score: 1 };
    }
}
const hu = [];
function mu(e, t) {
    for (let n = 0, a = hu.length; n < a; n += 1) {
        let a = hu[n];
        if (a.condition(e, t)) return new a(e, t);
    }
    return new nu(e, t);
}
const pu = '$and',
    fu = '$or',
    gu = '$path',
    yu = '$val',
    vu = e => !(!e[pu] && !e[fu]),
    bu = e => ({ [pu]: Object.keys(e).map(t => ({ [t]: e[t] })) });
function wu(e, t, { auto: n = !0 } = {}) {
    const a = e => {
        let i = Object.keys(e);
        const o = (e => !!e[gu])(e);
        if (!o && i.length > 1 && !vu(e)) return a(bu(e));
        if ((e => !Dd(e) && Pd(e) && !vu(e))(e)) {
            const a = o ? e[gu] : i[0],
                r = o ? e[yu] : e[a];
            if (!Fd(r)) throw new Error((e => `Invalid value for key ${e}`)(a));
            const s = { keyId: Vd(a), pattern: r };
            return (n && (s.searcher = mu(r, t)), s);
        }
        let r = { children: [], operator: i[0] };
        return (
            i.forEach(t => {
                const n = e[t];
                Dd(n) &&
                    n.forEach(e => {
                        r.children.push(a(e));
                    });
            }),
            r
        );
    };
    return (vu(e) || (e = bu(e)), a(e));
}
function _u(e, t) {
    const n = e.matches;
    ((t.matches = []),
        Nd(n) &&
            n.forEach(e => {
                if (!Nd(e.indices) || !e.indices.length) return;
                const { indices: n, value: a } = e;
                let i = { indices: n, value: a };
                (e.key && (i.key = e.key.src), e.idx > -1 && (i.refIndex = e.idx), t.matches.push(i));
            }));
}
function ku(e, t) {
    t.score = e.score;
}
class xu {
    constructor(e, t = {}, n) {
        ((this.options = { ...Wd, ...t }),
            this.options.useExtendedSearch,
            (this._keyStore = new Hd(this.options.keys)),
            this.setCollection(e, n));
    }
    setCollection(e, t) {
        if (((this._docs = e), t && !(t instanceof Kd))) throw new Error("Incorrect 'index' type");
        this._myIndex =
            t ||
            Gd(this.options.keys, this._docs, {
                getFn: this.options.getFn,
                fieldNormWeight: this.options.fieldNormWeight,
            });
    }
    add(e) {
        Nd(e) && (this._docs.push(e), this._myIndex.add(e));
    }
    remove(e = () => !1) {
        const t = [];
        for (let n = 0, a = this._docs.length; n < a; n += 1) {
            const i = this._docs[n];
            e(i, n) && (this.removeAt(n), (n -= 1), (a -= 1), t.push(i));
        }
        return t;
    }
    removeAt(e) {
        (this._docs.splice(e, 1), this._myIndex.removeAt(e));
    }
    getIndex() {
        return this._myIndex;
    }
    search(e, { limit: t = -1 } = {}) {
        const { includeMatches: n, includeScore: a, shouldSort: i, sortFn: o, ignoreFieldNorm: r } = this.options;
        let s = Fd(e)
            ? Fd(this._docs[0])
                ? this._searchStringList(e)
                : this._searchObjectList(e)
            : this._searchLogical(e);
        return (
            (function (e, { ignoreFieldNorm: t = Wd.ignoreFieldNorm }) {
                e.forEach(e => {
                    let n = 1;
                    (e.matches.forEach(({ key: e, norm: a, score: i }) => {
                        const o = e ? e.weight : null;
                        n *= Math.pow(0 === i && o ? Number.EPSILON : i, (o || 1) * (t ? 1 : a));
                    }),
                        (e.score = n));
                });
            })(s, { ignoreFieldNorm: r }),
            i && s.sort(o),
            Od(t) && t > -1 && (s = s.slice(0, t)),
            (function (e, t, { includeMatches: n = Wd.includeMatches, includeScore: a = Wd.includeScore } = {}) {
                const i = [];
                return (
                    n && i.push(_u),
                    a && i.push(ku),
                    e.map(e => {
                        const { idx: n } = e,
                            a = { item: t[n], refIndex: n };
                        return (
                            i.length &&
                                i.forEach(t => {
                                    t(e, a);
                                }),
                            a
                        );
                    })
                );
            })(s, this._docs, { includeMatches: n, includeScore: a })
        );
    }
    _searchStringList(e) {
        const t = mu(e, this.options),
            { records: n } = this._myIndex,
            a = [];
        return (
            n.forEach(({ v: e, i: n, n: i }) => {
                if (!Nd(e)) return;
                const { isMatch: o, score: r, indices: s } = t.searchIn(e);
                o && a.push({ item: e, idx: n, matches: [{ score: r, value: e, norm: i, indices: s }] });
            }),
            a
        );
    }
    _searchLogical(e) {
        const t = wu(e, this.options),
            n = (e, t, a) => {
                if (!e.children) {
                    const { keyId: n, searcher: i } = e,
                        o = this._findMatches({
                            key: this._keyStore.get(n),
                            value: this._myIndex.getValueForItemAtKeyId(t, n),
                            searcher: i,
                        });
                    return o && o.length ? [{ idx: a, item: t, matches: o }] : [];
                }
                const i = [];
                for (let o = 0, r = e.children.length; o < r; o += 1) {
                    const r = e.children[o],
                        s = n(r, t, a);
                    if (s.length) i.push(...s);
                    else if (e.operator === pu) return [];
                }
                return i;
            },
            a = this._myIndex.records,
            i = {},
            o = [];
        return (
            a.forEach(({ $: e, i: a }) => {
                if (Nd(e)) {
                    let r = n(t, e, a);
                    r.length &&
                        (i[a] || ((i[a] = { idx: a, item: e, matches: [] }), o.push(i[a])),
                        r.forEach(({ matches: e }) => {
                            i[a].matches.push(...e);
                        }));
                }
            }),
            o
        );
    }
    _searchObjectList(e) {
        const t = mu(e, this.options),
            { keys: n, records: a } = this._myIndex,
            i = [];
        return (
            a.forEach(({ $: e, i: a }) => {
                if (!Nd(e)) return;
                let o = [];
                (n.forEach((n, a) => {
                    o.push(...this._findMatches({ key: n, value: e[a], searcher: t }));
                }),
                    o.length && i.push({ idx: a, item: e, matches: o }));
            }),
            i
        );
    }
    _findMatches({ key: e, value: t, searcher: n }) {
        if (!Nd(t)) return [];
        let a = [];
        if (Dd(t))
            t.forEach(({ v: t, i: i, n: o }) => {
                if (!Nd(t)) return;
                const { isMatch: r, score: s, indices: c } = n.searchIn(t);
                r && a.push({ score: s, key: e, value: t, idx: i, norm: o, indices: c });
            });
        else {
            const { v: i, n: o } = t,
                { isMatch: r, score: s, indices: c } = n.searchIn(i);
            r && a.push({ score: s, key: e, value: i, norm: o, indices: c });
        }
        return a;
    }
}
((xu.version = '7.1.0'),
    (xu.createIndex = Gd),
    (xu.parseIndex = function (e, { getFn: t = Wd.getFn, fieldNormWeight: n = Wd.fieldNormWeight } = {}) {
        const { keys: a, records: i } = e,
            o = new Kd({ getFn: t, fieldNormWeight: n });
        return (o.setKeys(a), o.setIndexRecords(i), o);
    }),
    (xu.config = Wd),
    (xu.parseQuery = wu),
    (function (...e) {
        hu.push(...e);
    })(uu));
let Eu = null,
    Su = null,
    Cu = null,
    $u = null;
function Mu(e) {
    const t = { includeScore: !0, threshold: 0.5, keys: ['name'], ignoreLocation: !0 };
    (e.items?.items && (Eu = new xu(e.items.items, t)),
        e.tomes?.tomes && (Su = new xu(e.tomes.tomes, t)),
        e.characters?.characters && (Cu = new xu(e.characters.characters, t)),
        e.weapons?.weapons && ($u = new xu(e.weapons.weapons, t)),
        zi.info({
            operation: 'ocr.init',
            data: {
                itemsIndexed: e.items?.items.length || 0,
                tomesIndexed: e.tomes?.tomes.length || 0,
                charactersIndexed: e.characters?.characters.length || 0,
                weaponsIndexed: e.weapons?.weapons.length || 0,
            },
        }));
}
function Tu(e, t, n) {
    if (!t) return [];
    const a = (function (e) {
            const t = e.split('\n'),
                n = [];
            for (const a of t) {
                const e = a.trim();
                if (!(e.length <= 2))
                    if (e.length > 50) {
                        const t = e.split(/[,;|\t]+/);
                        for (const e of t) {
                            const t = e.trim();
                            t.length > 2 && n.push(t);
                        }
                    } else n.push(e);
            }
            return n;
        })(e),
        i = [],
        o = new Set();
    let r = 1,
        s = '';
    for (const c of a) {
        const e = t.search(c);
        if (0 === e.length) continue;
        const a = e[0],
            l = a?.score;
        a &&
            void 0 !== l &&
            (n.debug && l >= 0.5 && l < r && ((r = l), (s = a.item.name)),
            l < 0.5 &&
                !o.has(a.item.id) &&
                (o.add(a.item.id),
                i.push({ type: n.type, entity: a.item, confidence: 1 - l, rawText: c }),
                n.debug &&
                    zi.debug({
                        operation: `ocr.${n.type}_matched`,
                        data: { segment: c.substring(0, 30), matchedEntity: a.item.name, score: l.toFixed(3) },
                    })));
    }
    return (
        n.debug &&
            0 === i.length &&
            a.length > 0 &&
            zi.debug({
                operation: `ocr.no_${n.type}s_matched`,
                data: {
                    segmentsChecked: a.length,
                    bestScore: r < 1 ? r.toFixed(3) : 'none',
                    bestMatch: s || 'none',
                    sampleSegments: a.slice(0, 5).map(e => e.substring(0, 20)),
                },
            }),
        i
    );
}
async function Au(e, t) {
    try {
        t && t(0, 'Starting OCR...');
        const n = await (async function (e, t, n = 6e4, a = 2) {
            let i = null;
            t && t(0, 'Loading OCR engine...');
            for (let r = 0; r <= a; r++)
                try {
                    (zi.info({
                        operation: 'ocr.extract_text',
                        data: { phase: 'start', attempt: r + 1, maxRetries: a + 1 },
                    }),
                        r > 0 && t && t(0, `Retrying OCR (attempt ${r + 1}/${a + 1})...`));
                    const i = await Ld();
                    let o = 0;
                    const s = t
                            ? setInterval(() => {
                                  o < 90 && ((o += 10), t(o, `Recognizing text... ${o}%`));
                              }, 500)
                            : null,
                        c = i.recognize(e),
                        l = await $d(c, n, 'OCR recognition');
                    s && clearInterval(s);
                    const d = l.data.text;
                    return (
                        zi.info({
                            operation: 'ocr.extract_text',
                            data: {
                                phase: 'complete',
                                attempt: r + 1,
                                textLength: d.length,
                                confidence: l.data.confidence,
                                textPreview: d.substring(0, 500).replace(/\n/g, ' | '),
                            },
                        }),
                        d
                    );
                } catch (o) {
                    if (
                        ((i = o),
                        zi.warn({
                            operation: 'ocr.extract_text',
                            data: { phase: 'retry', attempt: r + 1, maxRetries: a + 1, willRetry: r < a },
                            error: { name: i.name, message: i.message, module: 'ocr' },
                        }),
                        (i.message.includes('worker') || i.message.includes('timeout')) && (await zd()),
                        r < a)
                    ) {
                        const e = Math.min(1e3 * Math.pow(2, r), 8e3);
                        await Md(e);
                    }
                }
            throw (
                zi.error({
                    operation: 'ocr.extract_text',
                    error: {
                        name: i?.name || 'UnknownError',
                        message: i?.message || 'OCR failed after all retries',
                        module: 'ocr',
                        retriable: !1,
                    },
                }),
                i || new Error('OCR failed after all retries')
            );
        })(e, t);
        t && t(100, 'Matching detected text...');
        const a = (function (e) {
                return Tu(e, Eu, { type: 'item', debug: !0 });
            })(n),
            i = (function (e) {
                return Tu(e, Su, { type: 'tome' });
            })(n),
            o = (function (e) {
                if (!Cu) return null;
                const t = Cu.search(e);
                if (0 === t.length) return null;
                const n = t[0],
                    a = n?.score;
                return n && void 0 !== a && a < 0.5
                    ? { type: 'character', entity: n.item, confidence: 1 - a, rawText: e }
                    : null;
            })(n),
            r = (function (e) {
                if (!$u) return null;
                const t = $u.search(e);
                if (0 === t.length) return null;
                const n = t[0],
                    a = n?.score;
                return n && void 0 !== a && a < 0.5
                    ? { type: 'weapon', entity: n.item, confidence: 1 - a, rawText: e }
                    : null;
            })(n);
        return (
            zi.info({
                operation: 'ocr.auto_detect',
                data: {
                    itemsDetected: a.length,
                    tomesDetected: i.length,
                    characterDetected: o ? 1 : 0,
                    weaponDetected: r ? 1 : 0,
                },
            }),
            { items: a, tomes: i, character: o, weapon: r, rawText: n }
        );
    } catch (n) {
        throw (
            zi.error({ operation: 'ocr.auto_detect', error: { name: n.name, message: n.message, module: 'ocr' } }),
            n
        );
    }
}
((window.initOCR = Mu),
    (window.terminateOCRWorker = zd),
    (window.isOCRWorkerActive = function () {
        return null !== Ad;
    }));
let Iu = {};
const Lu = new Map(),
    zu = new Map();
let Du = !1,
    Fu = !1,
    Ou = !1;
const Ru = new Map();
const Pu = new (class {
        constructor(e) {
            ((this.cache = new Map()), (this.maxSize = e));
        }
        get(e) {
            const t = this.cache.get(e);
            return (void 0 !== t && (this.cache.delete(e), this.cache.set(e, t)), t);
        }
        set(e, t) {
            if (this.cache.has(e)) this.cache.delete(e);
            else if (this.cache.size >= this.maxSize) {
                const e = this.cache.keys().next().value;
                void 0 !== e && this.cache.delete(e);
            }
            this.cache.set(e, t);
        }
        has(e) {
            return this.cache.has(e);
        }
        delete(e) {
            return this.cache.delete(e);
        }
        clear() {
            this.cache.clear();
        }
        get size() {
            return this.cache.size;
        }
        entries() {
            return this.cache.entries();
        }
    })(500),
    Nu = new Map(),
    Bu = [32, 38, 40, 44, 48, 55, 64, 72],
    ju = 9e5;
let qu = null;
function Hu() {
    return Iu;
}
function Zu() {
    return Lu;
}
function Uu() {
    return zu;
}
function Vu() {
    return Du;
}
function Wu(e) {
    Ou = e;
}
function Ju() {
    return Ru;
}
function Ku(e, t, n) {
    const a = Gu();
    if (a >= 2e3) {
        const e = Nu.keys().next().value;
        void 0 !== e &&
            (Nu.delete(e),
            zi.info({ operation: 'cv.state.multi_scale_eviction', data: { evictedItemId: e, currentCount: a } }));
    }
    (Nu.has(e) || Nu.set(e, new Map()), Nu.get(e).set(t, n));
}
function Gu() {
    let e = 0;
    return (
        Nu.forEach(t => {
            e += t.size;
        }),
        e
    );
}
function Yu(e) {
    Du = e;
}
function Xu(e) {
    Fu = e;
}
let Qu = null,
    eh = !1;
async function th() {
    if (eh && Qu) return Qu;
    try {
        const e = await fetch('data/grid-presets.json');
        return e.ok
            ? ((Qu = await e.json()),
              (eh = !0),
              zi.info({
                  operation: 'cv.state.grid_presets_loaded',
                  data: { presetCount: Object.keys(Qu?.presets || {}).length },
              }),
              Qu)
            : (zi.warn({ operation: 'cv.state.grid_presets_not_found', data: { status: e.status } }), (eh = !0), null);
    } catch (e) {
        return (
            zi.warn({ operation: 'cv.state.grid_presets_load_error', error: { name: e.name, message: e.message } }),
            (eh = !0),
            null
        );
    }
}
function nh(e, t) {
    if (!Qu?.presets) return null;
    const n = `${e}x${t}`;
    return Qu.presets[n] || null;
}
const ah = new Map();
let ih = !1,
    oh = !1,
    rh = null;
const sh = new Set(),
    ch = new Set(),
    lh = new Map();
let dh = '/data/training-data/';
function uh() {
    return ih;
}
function hh(e) {
    const t = ah.get(e) || [],
        n = lh.get(e) || [];
    let a;
    return (
        (a = 0 === ch.size || ch.size === sh.size ? [...t, ...n] : [...t.filter(e => ch.has(e.sourceImage)), ...n]),
        a
    );
}
function mh(e) {
    switch (e) {
        case 'corrected':
        case 'corrected_from_empty':
            return 1.2;
        case 'verified':
            return 1;
        default:
            return 0.8;
    }
}
async function ph(e) {
    return new Promise(t => {
        const n = new Image();
        let a = !1;
        const i = setTimeout(() => {
            a ||
                ((a = !0),
                zi.warn({ operation: 'cv.training.load_image_timeout', data: { imagePath: e, timeoutMs: 5e3 } }),
                t(null));
        }, 5e3);
        ((n.onload = () => {
            if (!a) {
                ((a = !0), clearTimeout(i));
                try {
                    const a = document.createElement('canvas');
                    ((a.width = n.width), (a.height = n.height));
                    const i = a.getContext('2d', { willReadFrequently: !0 });
                    if (!i)
                        return (
                            zi.warn({
                                operation: 'cv.training.canvas_context_failed',
                                data: { imagePath: e, width: n.width, height: n.height },
                            }),
                            void t(null)
                        );
                    i.drawImage(n, 0, 0);
                    const o = i.getImageData(0, 0, n.width, n.height);
                    t(o);
                } catch (o) {
                    (zi.warn({
                        operation: 'cv.training.load_image_processing_error',
                        error: { name: o.name, message: o.message },
                        data: { imagePath: e },
                    }),
                        t(null));
                }
            }
        }),
            (n.onerror = n => {
                a ||
                    ((a = !0),
                    clearTimeout(i),
                    zi.warn({
                        operation: 'cv.training.load_image_failed',
                        data: { imagePath: e, error: n instanceof ErrorEvent ? n.message : 'Unknown error' },
                    }),
                    t(null));
            }),
            (n.src = dh + e));
    });
}
async function fh() {
    if (ih) return (zi.info({ operation: 'cv.training.already_loaded', data: { templateCount: ah.size } }), !0);
    if (oh)
        return (
            zi.info({
                operation: 'cv.training.load_in_progress',
                data: { message: 'Training data load already in progress' },
            }),
            !1
        );
    oh = !0;
    try {
        const e = dh + 'index.json',
            t = await fetch(e);
        if (!t.ok)
            return (
                zi.info({
                    operation: 'cv.training.no_index',
                    data: { status: t.status, message: 'No training data index found' },
                }),
                (ih = !0),
                !0
            );
        const n = await t.json();
        ((rh = n),
            zi.info({
                operation: 'cv.training.index_loaded',
                data: { version: n.version, totalSamples: n.total_samples, itemCount: Object.keys(n.items).length },
            }));
        let a = 0,
            i = 0;
        for (const [o, r] of Object.entries(n.items)) {
            const e = [];
            for (const t of r.samples) {
                const n = await ph(t.file);
                n
                    ? (sh.add(t.source_image),
                      e.push({
                          imageData: n,
                          weight: mh(t.validation_type),
                          resolution: t.source_resolution,
                          validationType: t.validation_type,
                          sourceImage: t.source_image,
                      }),
                      a++)
                    : i++;
            }
            e.length > 0 && ah.set(o, e);
        }
        return (
            (ih = !0),
            (function () {
                ch.clear();
                for (const e of sh) ch.add(e);
            })(),
            zi.info({
                operation: 'cv.training.load_complete',
                data: { loadedTemplates: a, failedTemplates: i, itemsWithTemplates: ah.size, sourcesFound: sh.size },
            }),
            (oh = !1),
            !0
        );
    } catch (e) {
        return (
            zi.warn({ operation: 'cv.training.load_error', error: { name: e.name, message: e.message } }),
            (oh = !1),
            !1
        );
    }
}
function gh() {
    if (qu) return;
    !(function (e) {
        qu = e;
    })(
        setInterval(() => {
            const e = Date.now();
            let t = 0;
            const n = Ju();
            for (const [a, i] of n.entries()) e - i.timestamp > ju && (n.delete(a), t++);
            if (n.size > 50) {
                const e = Array.from(n.entries());
                e.sort((e, t) => e[1].timestamp - t[1].timestamp);
                const a = n.size - 50 + 10;
                for (let i = 0; i < a && i < e.length; i++) {
                    const a = e[i];
                    a && (n.delete(a[0]), t++);
                }
            }
            t > 0 && zi.info({ operation: 'cv.cache_cleanup', data: { evicted: t, remaining: n.size } });
        }, 3e5)
    );
}
function yh(e) {
    ((Iu = e || {}),
        gh(),
        uh() ||
            fh().catch(t => {
                zi.warn({
                    operation: 'cv.training.background_load_error',
                    error: { name: t.name, message: t.message, stack: t.stack?.split('\n').slice(0, 3).join(' -> ') },
                    data: { phase: 'background_init', itemsAvailable: e?.items?.items?.length || 0 },
                });
            }),
        zi.info({ operation: 'cv.init', data: { itemsCount: e?.items?.items?.length || 0 } }));
}
function vh() {
    return Vu();
}
const bh = {
    common: {
        name: 'common',
        h: [0, 360],
        s: [0, 25],
        l: [35, 75],
        rgb: { r: [100, 200], g: [100, 200], b: [100, 200] },
    },
    uncommon: {
        name: 'uncommon',
        h: [85, 155],
        s: [30, 100],
        l: [20, 70],
        rgb: { r: [0, 150], g: [100, 255], b: [0, 150] },
    },
    rare: { name: 'rare', h: [190, 250], s: [50, 100], l: [35, 70], rgb: { r: [0, 150], g: [60, 220], b: [150, 255] } },
    epic: {
        name: 'epic',
        h: [260, 320],
        s: [40, 100],
        l: [25, 70],
        rgb: { r: [100, 220], g: [0, 150], b: [150, 255] },
    },
    legendary: {
        name: 'legendary',
        h: [15, 55],
        s: [70, 100],
        l: [40, 80],
        rgb: { r: [200, 255], g: [80, 220], b: [0, 150] },
    },
};
function wh(e) {
    const t = (function (e) {
        return (
            {
                red: ['orange', 'magenta', 'purple'],
                orange: ['red', 'yellow'],
                yellow: ['orange', 'lime', 'green'],
                green: ['lime', 'cyan', 'yellow'],
                lime: ['green', 'yellow', 'cyan'],
                cyan: ['green', 'blue', 'lime'],
                blue: ['cyan', 'purple', 'navy'],
                purple: ['blue', 'magenta', 'red'],
                magenta: ['purple', 'red'],
                gray: ['black', 'white'],
                black: ['gray'],
                white: ['gray'],
            }[e] || []
        );
    })(e);
    return [e, ...t];
}
const _h = 0.15,
    kh = 3,
    xh = 1.1;
function Eh(e) {
    const t = e.data;
    let n = 0,
        a = 0,
        i = 0,
        o = 0;
    for (let d = 0; d < t.length; d += 16) ((n += t[d] ?? 0), (a += t[d + 1] ?? 0), (i += t[d + 2] ?? 0), o++);
    const r = n / o,
        s = a / o,
        c = i / o;
    let l = 0;
    for (let d = 0; d < t.length; d += 16) {
        const e = (t[d] ?? 0) - r,
            n = (t[d + 1] ?? 0) - s,
            a = (t[d + 2] ?? 0) - c;
        l += e * e + n * n + a * a;
    }
    return l / o;
}
function Sh(e) {
    const t = e.data,
        n = e.width,
        a = e.height;
    let i = 0,
        o = 0;
    for (let r = 1; r < a - 1; r += 2)
        for (let e = 1; e < n - 1; e += 2) {
            const a = 4 * (r * n + e),
                s = ((t[a] ?? 0) + (t[a + 1] ?? 0) + (t[a + 2] ?? 0)) / 3,
                c = ((t[a + 4] ?? 0) + (t[a + 5] ?? 0) + (t[a + 6] ?? 0)) / 3,
                l = ((t[a + 4 * n] ?? 0) + (t[a + 4 * n + 1] ?? 0) + (t[a + 4 * n + 2] ?? 0)) / 3;
            (Math.abs(c - s) + Math.abs(l - s) > 30 && i++, o++);
        }
    return o > 0 ? i / o : 0;
}
function Ch(e) {
    const t = (function (e) {
        const t = e.data;
        let n = 0,
            a = 0,
            i = 0,
            o = 0;
        for (let v = 0; v < t.length; v += 16) ((n += t[v] ?? 0), (a += t[v + 1] ?? 0), (i += t[v + 2] ?? 0), o++);
        if (0 === o) return { primary: 'gray', secondary: 'neutral', saturation: 'low', brightness: 'medium' };
        const r = n / o,
            s = a / o,
            c = i / o,
            l = Math.max(r, s, c),
            d = Math.min(r, s, c),
            u = l - d,
            h = (l + d) / 2,
            m = 0 === u ? 0 : u / (255 - Math.abs(2 * h - 255));
        let p, f, g, y;
        return (
            (p = m < 0.2 ? 'low' : m < 0.5 ? 'medium' : 'high'),
            (f = h < 80 ? 'dark' : h < 180 ? 'medium' : 'bright'),
            u < 30
                ? ((g = 'gray'),
                  (y = h < 60 ? 'black' : h > 200 ? 'white' : 'neutral'),
                  { primary: g, secondary: y, saturation: p, brightness: f })
                : (r >= s && r >= c
                      ? ((g = 'red'),
                        (y =
                            s > 1.5 * c && s > 100
                                ? s > 180
                                    ? 'yellow'
                                    : 'orange'
                                : c > 1.2 * s && c > 80
                                  ? 'magenta'
                                  : r > 200
                                    ? 'bright_red'
                                    : 'dark_red'))
                      : s >= r && s >= c
                        ? ((g = 'green'),
                          (y =
                              c > 1.3 * r && c > 80
                                  ? 'cyan'
                                  : r > c && r > 100
                                    ? 'lime'
                                    : s > 200
                                      ? 'bright_green'
                                      : 'forest'))
                        : ((g = 'blue'),
                          (y =
                              r > 1.3 * s && r > 80
                                  ? 'purple'
                                  : s > r && s > 100
                                    ? 'sky'
                                    : c > 200
                                      ? 'bright_blue'
                                      : 'navy')),
                  { primary: g, secondary: y, saturation: p, brightness: f })
        );
    })(e);
    return 'gray' === t.primary
        ? 'black' === t.secondary
            ? 'black'
            : 'white' === t.secondary
              ? 'white'
              : 'gray'
        : 'yellow' === t.secondary ||
            'orange' === t.secondary ||
            'cyan' === t.secondary ||
            'lime' === t.secondary ||
            'purple' === t.secondary ||
            'magenta' === t.secondary
          ? t.secondary
          : t.primary;
}
function $h(e, t, n, a) {
    const i = bh[a];
    if (!i) return !1;
    if (e < i.rgb.r[0] || e > i.rgb.r[1]) return !1;
    if (t < i.rgb.g[0] || t > i.rgb.g[1]) return !1;
    if (n < i.rgb.b[0] || n > i.rgb.b[1]) return !1;
    const o = (function (e, t, n) {
        ((e /= 255), (t /= 255), (n /= 255));
        const a = Math.max(e, t, n),
            i = Math.min(e, t, n);
        let o = 0,
            r = 0;
        const s = (a + i) / 2;
        if (a !== i) {
            const c = a - i;
            switch (((r = s > 0.5 ? c / (2 - a - i) : c / (a + i)), a)) {
                case e:
                    o = ((t - n) / c + (t < n ? 6 : 0)) / 6;
                    break;
                case t:
                    o = ((n - e) / c + 2) / 6;
                    break;
                case n:
                    o = ((e - t) / c + 4) / 6;
            }
        }
        return { h: 360 * o, s: 100 * r, l: 100 * s };
    })(e, t, n);
    let r = !1;
    r = i.h[0] <= i.h[1] ? o.h >= i.h[0] && o.h <= i.h[1] : o.h >= i.h[0] || o.h <= i.h[1];
    const s = o.s >= i.s[0] && o.s <= i.s[1],
        c = o.l >= i.l[0] && o.l <= i.l[1];
    return r && s && c;
}
function Mh(e, t, n) {
    for (const a of Object.keys(bh)) if ($h(e, t, n, a)) return a;
    return null;
}
function Th(e) {
    const t = e.data;
    let n = 0,
        a = 0;
    const i = e.width,
        o = e.height,
        r = Math.floor(0.2 * Math.min(i, o));
    for (let s = r; s < o - r; s += 2)
        for (let e = r; e < i - r; e += 2) {
            const o = 4 * (s * i + e),
                r = t[o] ?? 0,
                c = t[o + 1] ?? 0,
                l = t[o + 2] ?? 0,
                d = (r + c + l) / 3,
                u = Math.max(r, c, l),
                h = Math.min(r, c, l);
            (d < 80 && u - h < 40 && n++, a++);
        }
    return a > 0 && n / a > 0.6;
}
function Ah(e) {
    const t = e.data;
    let n = 0,
        a = 0,
        i = 0,
        o = 0,
        r = 0,
        s = 0,
        c = 0;
    for (let m = 0; m < t.length; m += 16) {
        const e = t[m] ?? 0,
            l = t[m + 1] ?? 0,
            d = t[m + 2] ?? 0;
        ((n += e), (a += l), (i += d), (o += e * e), (r += l * l), (s += d * d), c++);
    }
    if (0 === c) return !0;
    const l = n / c,
        d = a / c,
        u = i / c,
        h = o / c - l * l + (r / c - d * d) + (s / c - u * u);
    if ((l + d + u) / 3 < 40) return !0;
    {
        const t = (function (e) {
            const t = e.data;
            let n = 0,
                a = 0;
            for (let i = 0; i < t.length; i += 16) {
                const e = t[i] ?? 0,
                    o = t[i + 1] ?? 0,
                    r = t[i + 2] ?? 0,
                    s = Math.max(e, o, r),
                    c = Math.min(e, o, r);
                let l = 0;
                (s !== c && (l = (s + c) / 2 <= 127.5 ? (s - c) / (s + c) : (s - c) / (510 - s - c)), (n += l), a++);
            }
            return a > 0 ? n / a : 0;
        })(e);
        if (t < _h && h < 800) return !0;
    }
    {
        const t = (function (e) {
            const t = e.data,
                n = new Set();
            for (let a = 0; a < t.length; a += 16) {
                const e = t[a] ?? 0,
                    i = t[a + 1] ?? 0,
                    o = t[a + 2] ?? 0,
                    r = (Math.floor(e / 32) << 6) | (Math.floor(i / 32) << 3) | Math.floor(o / 32);
                n.add(r);
            }
            return n.size;
        })(e);
        if (t < kh) return !0;
    }
    {
        const t = (function (e) {
            const t = e.data,
                n = e.width,
                a = e.height,
                i = Math.floor(0.25 * n),
                o = Math.floor(0.25 * a);
            let r = 0,
                s = 0,
                c = 0,
                l = 0,
                d = 0,
                u = 0,
                h = 0,
                m = 0,
                p = 0,
                f = 0,
                g = 0,
                y = 0,
                v = 0,
                b = 0;
            for (let C = 0; C < a; C += 2)
                for (let e = 0; e < n; e += 2) {
                    const w = 4 * (C * n + e),
                        _ = t[w] ?? 0,
                        k = t[w + 1] ?? 0,
                        x = t[w + 2] ?? 0;
                    e >= i && e < n - i && C >= o && C < a - o
                        ? ((r += _), (s += k), (c += x), (l += _ * _), (d += k * k), (u += x * x), h++)
                        : ((m += _), (p += k), (f += x), (g += _ * _), (y += k * k), (v += x * x), b++);
                }
            if (0 === h || 0 === b) return 1;
            const w = r / h,
                _ = s / h,
                k = c / h,
                x = m / b,
                E = p / b,
                S = f / b;
            return (
                (l / h - w * w + (d / h - _ * _) + (u / h - k * k)) /
                (g / b - x * x + (y / b - E * E) + (v / b - S * S) + 1)
            );
        })(e);
        if (t < xh) return !0;
    }
    if (h < 500) {
        if (h < 150) return !0;
        const t = Sh(e);
        if (t < 0.05) return !0;
        if (t < 0.12 && Th(e)) return !0;
    }
    if (h < 800 && Th(e)) {
        if (Sh(e) < 0.08) return !0;
    }
    return !1;
}
function Ih(e) {
    const t = (function (e, t = 2) {
            const { width: n, height: a, data: i } = e,
                o = [];
            for (let r = 0; r < n; r++)
                for (let e = 0; e < t; e++) {
                    const t = 4 * (e * n + r);
                    o.push(i[t] ?? 0, i[t + 1] ?? 0, i[t + 2] ?? 0);
                    const s = 4 * ((a - 1 - e) * n + r);
                    o.push(i[s] ?? 0, i[s + 1] ?? 0, i[s + 2] ?? 0);
                }
            for (let r = t; r < a - t; r++)
                for (let e = 0; e < t; e++) {
                    const t = 4 * (r * n + e);
                    o.push(i[t] ?? 0, i[t + 1] ?? 0, i[t + 2] ?? 0);
                    const a = 4 * (r * n + (n - 1 - e));
                    o.push(i[a] ?? 0, i[a + 1] ?? 0, i[a + 2] ?? 0);
                }
            return new Uint8ClampedArray(o);
        })(e, 3),
        n = { common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0 };
    let a = 0;
    for (let r = 0; r < t.length; r += 3) {
        const e = Mh(t[r] ?? 0, t[r + 1] ?? 0, t[r + 2] ?? 0);
        (e && (n[e] = (n[e] ?? 0) + 1), a++);
    }
    let i = null,
        o = 0;
    for (const [r, s] of Object.entries(n)) s > o && ((o = s), (i = r));
    return o < 0.1 * a ? null : i;
}
function Lh(e) {
    const t = e.data;
    let n = 0,
        a = 0;
    const i = {};
    for (let o = 0; o < t.length; o += 4) {
        const e = t[o] ?? 0,
            r = t[o + 1] ?? 0,
            s = t[o + 2] ?? 0;
        Math.max(e, r, s) - Math.min(e, r, s) > 40 && a++;
        const c = Mh(e, r, s);
        c && (n++, (i[c] = (i[c] || 0) + 1));
    }
    return { total: t.length / 4, rarityCount: n, colorfulCount: a, rarityCounts: i };
}
function zh(e, t, n) {
    const a = t.width,
        i = t.height;
    for (const o of Bu) {
        if (o === a && o === i) {
            Ku(e, o, n.getImageData(0, 0, a, i));
            continue;
        }
        const r = document.createElement('canvas');
        ((r.width = o), (r.height = o));
        const s = r.getContext('2d', { willReadFrequently: !0 });
        if (!s) continue;
        ((s.imageSmoothingEnabled = !0), (s.imageSmoothingQuality = 'high'), s.drawImage(t, 0, 0, a, i, 0, 0, o, o));
        Ku(e, o, s.getImageData(0, 0, o, o));
    }
}
async function Dh(e) {
    let t = 0;
    const n = [],
        a = Zu(),
        i = e.map(async e => {
            try {
                if (!e.image) return;
                const n = e.image.endsWith('.png')
                        ? e.image.slice(0, -4) + '.webp'
                        : e.image.replace(/\.png$/, '.webp'),
                    i = new Image();
                await new Promise((o, r) => {
                    ((i.onload = () => {
                        const n = document.createElement('canvas');
                        ((n.width = i.width), (n.height = i.height));
                        const s = n.getContext('2d', { willReadFrequently: !0 });
                        s
                            ? (s.drawImage(i, 0, 0),
                              a.set(e.id, { image: i, canvas: n, ctx: s, width: i.width, height: i.height }),
                              zh(e.id, n, s),
                              t++,
                              o())
                            : r(new Error('Failed to get canvas context'));
                    }),
                        (i.onerror = () => {
                            const n = new Image();
                            ((n.onload = () => {
                                const i = document.createElement('canvas');
                                ((i.width = n.width), (i.height = n.height));
                                const s = i.getContext('2d', { willReadFrequently: !0 });
                                s
                                    ? (s.drawImage(n, 0, 0),
                                      a.set(e.id, { image: n, canvas: i, ctx: s, width: n.width, height: n.height }),
                                      zh(e.id, i, s),
                                      t++,
                                      o())
                                    : r(new Error('Failed to get canvas context'));
                            }),
                                (n.onerror = () => r(new Error(`Failed to load: ${e.image}`))),
                                (n.src = e.image));
                        }),
                        (i.src = n));
                });
            } catch (i) {
                (n.push(e.id),
                    zi.error({
                        operation: 'cv.load_template',
                        error: { name: i.name, message: i.message },
                        data: { itemId: e.id, itemName: e.name },
                    }));
            }
        });
    return (
        await Promise.all(i),
        n.length > 0 &&
            zi.warn({
                operation: 'cv.load_template_batch',
                data: { totalAttempted: e.length, loaded: t, failed: n.length, failedIds: n.slice(0, 10) },
            }),
        { loaded: t, failed: n.length, failedIds: n }
    );
}
function Fh(e) {
    const t = Zu(),
        n = Uu();
    e.forEach(e => {
        const a = t.get(e.id);
        if (!a) return;
        const i = Ch(a.ctx.getImageData(0, 0, a.width, a.height));
        (n.has(i) || n.set(i, []), n.get(i).push(e));
    });
}
async function Oh() {
    if (Vu()) return;
    const e = Zu(),
        t = Uu();
    e.size > 0 &&
        (e.clear(),
        t.clear(),
        Xu(!1),
        zi.info({ operation: 'cv.load_templates', data: { phase: 'clearing_old_templates' } }));
    const n = Hu().items?.items || [];
    zi.info({ operation: 'cv.load_templates', data: { phase: 'start', totalItems: n.length } });
    const { priority: a, standard: i } = (function (e) {
            const t = [],
                n = [],
                a = ['common', 'uncommon'];
            return (
                e.forEach(e => {
                    a.includes(e.rarity) ? t.push(e) : n.push(e);
                }),
                { priority: t, standard: n }
            );
        })(n),
        o = await Dh(a);
    (Fh(a),
        Xu(!0),
        zi.info({
            operation: 'cv.load_templates',
            data: {
                phase: 'priority_complete',
                priorityLoaded: o.loaded,
                priorityFailed: o.failed,
                priorityTotal: a.length,
            },
        }),
        Ou
            ? zi.info({
                  operation: 'cv.load_templates',
                  data: { phase: 'skipped_standard', reason: 'already_loading' },
              })
            : (Wu(!0),
              setTimeout(async () => {
                  try {
                      const e = await Dh(i);
                      (Fh(i),
                          Yu(!0),
                          Wu(!1),
                          zi.info({
                              operation: 'cv.load_templates',
                              data: {
                                  phase: 'complete',
                                  priorityLoaded: o.loaded,
                                  priorityFailed: o.failed,
                                  standardLoaded: e.loaded,
                                  standardFailed: e.failed,
                                  total: n.length,
                                  multiScaleVariants: Gu(),
                                  colorGroups: Object.fromEntries(
                                      Array.from(t.entries()).map(([e, t]) => [e, t.length])
                                  ),
                              },
                          }));
                  } catch (e) {
                      (zi.error({
                          operation: 'cv.load_templates',
                          data: { phase: 'error', error: e instanceof Error ? e.message : String(e) },
                      }),
                          Yu(!0),
                          Wu(!1));
                  }
              }, 0)));
}
let Rh = {
    weights: { ssim: 0.35, ncc: 0.25, histogram: 0.25, edge: 0.15 },
    agreement: { enabled: !0, threshold: 0.55, minMetricsForBonus: 2, bonusPerMetric: 0.02, maxBonus: 0.06 },
    baseThreshold: 0.45,
    rarityThresholds: { common: -0.03, uncommon: -0.02, rare: 0, epic: 0.02, legendary: 0.05, unknown: 0.05 },
    minConfidence: 0.35,
    maxConfidence: 0.99,
};
function Ph(e) {
    const t = Rh,
        n = t.baseThreshold;
    if (!e) return Math.max(t.minConfidence, n + t.rarityThresholds.unknown);
    const a = e.toLowerCase(),
        i = t.rarityThresholds[a] ?? t.rarityThresholds.unknown;
    return Math.max(t.minConfidence, n + i);
}
function Nh(e, t) {
    return e >= Ph(t);
}
const Bh = {
    low: {
        tier: 'low',
        name: 'Low Resolution (720p)',
        iconSize: { min: 28, max: 48, typical: 36 },
        spacing: { min: 2, max: 8, typical: 4 },
        maxHotbarRows: 2,
        iconsPerRow: { min: 6, max: 12, typical: 10 },
        templateScales: [0.75, 0.85, 1],
        minConfidence: 0.4,
        nmsThreshold: 0.35,
        cellMarginPercent: 8,
        borderMarginPercent: 6,
        countTextHeight: { min: 8, max: 14 },
        countTextPosition: 'bottom-right',
        scanStep: 1,
        batchSize: 20,
    },
    medium: {
        tier: 'medium',
        name: 'Medium Resolution (1080p)',
        iconSize: { min: 36, max: 64, typical: 48 },
        spacing: { min: 3, max: 10, typical: 5 },
        maxHotbarRows: 2,
        iconsPerRow: { min: 6, max: 12, typical: 10 },
        templateScales: [0.9, 1, 1.1],
        minConfidence: 0.45,
        nmsThreshold: 0.4,
        cellMarginPercent: 6,
        borderMarginPercent: 5,
        countTextHeight: { min: 10, max: 18 },
        countTextPosition: 'bottom-right',
        scanStep: 2,
        batchSize: 30,
    },
    high: {
        tier: 'high',
        name: 'High Resolution (1440p)',
        iconSize: { min: 48, max: 80, typical: 64 },
        spacing: { min: 4, max: 12, typical: 7 },
        maxHotbarRows: 2,
        iconsPerRow: { min: 6, max: 12, typical: 10 },
        templateScales: [1, 1.15, 1.3],
        minConfidence: 0.45,
        nmsThreshold: 0.4,
        cellMarginPercent: 5,
        borderMarginPercent: 4,
        countTextHeight: { min: 14, max: 24 },
        countTextPosition: 'bottom-right',
        scanStep: 2,
        batchSize: 40,
    },
    ultra: {
        tier: 'ultra',
        name: 'Ultra Resolution (4K)',
        iconSize: { min: 72, max: 128, typical: 96 },
        spacing: { min: 6, max: 16, typical: 10 },
        maxHotbarRows: 2,
        iconsPerRow: { min: 6, max: 12, typical: 10 },
        templateScales: [1.2, 1.5, 1.8],
        minConfidence: 0.45,
        nmsThreshold: 0.4,
        cellMarginPercent: 4,
        borderMarginPercent: 3,
        countTextHeight: { min: 20, max: 36 },
        countTextPosition: 'bottom-right',
        scanStep: 4,
        batchSize: 50,
    },
};
function jh(e, t) {
    return t <= 800 ? 'low' : t <= 1200 ? 'medium' : t <= 1800 ? 'high' : 'ultra';
}
function qh(e, t) {
    const n = jh(0, t);
    return Bh[n];
}
function Hh(e, t, n, a, i) {
    const o = qh(0, i),
        r = o.countTextHeight.max,
        s = Math.round(0.4 * n);
    switch (o.countTextPosition) {
        case 'bottom-center':
            return { x: e + Math.round((n - s) / 2), y: t + a - r, width: s, height: r };
        case 'top-right':
            return { x: e + n - s, y: t, width: s, height: r };
        default:
            return { x: e + n - s, y: t + a - r, width: s, height: r };
    }
}
function Zh(e) {
    return `/workers/${e}`;
}
let Uh = !1;
function Vh(e) {
    Uh = e;
}
function Wh(e, t, n) {
    const a = Ph(n);
    if (e && t) {
        const e = jh(0, t),
            n = { low: -0.05, medium: 0, high: 0.02, ultra: 0.03 };
        return Math.max(0.35, Math.min(0.75, a + n[e]));
    }
    return a;
}
function Jh(e, t) {
    const n = Math.max(e.x, t.x),
        a = Math.max(e.y, t.y),
        i = Math.min(e.x + e.width, t.x + t.width),
        o = Math.min(e.y + e.height, t.y + t.height),
        r = Math.max(0, i - n) * Math.max(0, o - a),
        s = e.width * e.height + t.width * t.height - r;
    return s > 0 ? r / s : 0;
}
function Kh(e, t = 0.3) {
    if (0 === e.length) return [];
    const n = [...e].sort((e, t) => t.confidence - e.confidence),
        a = [];
    for (const i of n) {
        if (!i.position) {
            a.push(i);
            continue;
        }
        let e = !0;
        for (const n of a) {
            if (!n.position) continue;
            if (Jh(i.position, n.position) > t) {
                e = !1;
                break;
            }
        }
        e && a.push(i);
    }
    return a;
}
function Gh(e, t, n) {
    const a = document.createElement('canvas');
    ((a.width = e.width), (a.height = e.height));
    const i = a.getContext('2d', { willReadFrequently: !0 });
    if (!i)
        return (
            zi.warn({
                operation: 'cv.resize_image_data',
                error: { name: 'CanvasError', message: 'Failed to get source canvas 2D context' },
            }),
            null
        );
    i.putImageData(e, 0, 0);
    const o = document.createElement('canvas');
    ((o.width = t), (o.height = n));
    const r = o.getContext('2d', { willReadFrequently: !0 });
    return r
        ? (r.drawImage(a, 0, 0, e.width, e.height, 0, 0, t, n), r.getImageData(0, 0, t, n))
        : (zi.warn({
              operation: 'cv.resize_image_data',
              error: { name: 'CanvasError', message: 'Failed to get output canvas 2D context' },
          }),
          null);
}
function Yh(e, t) {
    let n = Math.floor(0.8 * t.width),
        a = Math.floor(0.8 * t.height);
    ((n = Math.max(1, n)), (a = Math.max(1, a)));
    const i = e.canvas.width,
        o = e.canvas.height,
        r = Math.max(0, Math.min(t.x, i - 1)),
        s = Math.max(0, Math.min(t.y, o - 1)),
        c = Math.min(n, i - r),
        l = Math.min(a, o - s);
    return c <= 0 || l <= 0 ? e.createImageData(1, 1) : e.getImageData(r, s, c, l);
}
function Xh(e) {
    const t = Math.min(25, Math.floor(0.25 * e.width));
    return { x: e.x + e.width - t, y: e.y + e.height - t, width: t, height: t, label: `${e.label || 'cell'}_count` };
}
function Qh(e, t, n) {
    const a = Math.floor(0.65 * n),
        i = n - 5,
        o = Math.floor(0.15 * t),
        r = Math.floor(0.7 * t),
        s = [];
    for (let m = a; m < i; m += 2) {
        const t = e.getImageData(o, m, r, 2),
            n = Lh(t),
            a = Eh(t);
        s.push({ y: m, rarityRatio: n.rarityCount / n.total, colorfulRatio: n.colorfulCount / n.total, variance: a });
    }
    let c = 0,
        l = a,
        d = i;
    for (let m = 0; m < s.length - 35; m++) {
        const e = s.slice(m, m + 35),
            t = e.reduce((e, t) => e + t.rarityRatio, 0) / e.length,
            a = e.reduce((e, t) => e + t.colorfulRatio, 0) / e.length,
            i = e.reduce((e, t) => e + t.variance, 0) / e.length;
        let o = 0;
        (t > 0.01 && (o += 200 * t), a > 0.03 && (o += 80 * a), i > 200 && (o += Math.min(30, i / 50)));
        const r = e[0],
            u = e[e.length - 1];
        if (!r || !u) continue;
        const h = r.y / n;
        (h > 0.88 ? (o += 30) : h > 0.82 && (o += 15), o > c && ((c = o), (l = r.y), (d = u.y + 2)));
    }
    const u = Math.floor(0.15 * n),
        h = Math.floor(0.05 * n);
    return (
        d - l > u && (l = d - u),
        d - l < h && (l = d - h),
        c < 10 && ((l = Math.floor(0.85 * n)), (d = n - 5)),
        { topY: l, bottomY: d, confidence: Math.min(1, c / 100) }
    );
}
function em(e, t, n) {
    const { topY: a, bottomY: i } = n,
        o = i - a,
        r = Math.floor(0.15 * t),
        s = Math.floor(0.85 * t),
        c = [0.1, 0.25, 0.5, 0.75, 0.9],
        l = new Map();
    for (const u of c) {
        const t = Math.floor(a + o * u);
        if (t >= e.canvas.height) continue;
        const n = e.getImageData(r, t, s - r, 1).data;
        let i = !1,
            c = -1;
        for (let e = 0; e < s - r; e++) {
            const t = e + r,
                a = 4 * e,
                o = Mh(n[a] ?? 0, n[a + 1] ?? 0, n[a + 2] ?? 0);
            if (o && !i) ((i = !0), (c = t));
            else if (!o && i) {
                const e = t - c;
                if (e >= 2 && e <= 8) {
                    const e = 4 * Math.round(c / 4);
                    l.set(e, (l.get(e) || 0) + 1);
                }
                i = !1;
            }
        }
    }
    const d = [];
    for (const [u, h] of l) h >= 2 && d.push(u);
    return (
        d.sort((e, t) => e - t),
        (function (e) {
            if (e.length < 3) return e;
            const t = [];
            for (let s = 1; s < e.length; s++) {
                const n = e[s],
                    a = e[s - 1];
                if (void 0 === n || void 0 === a) continue;
                const i = n - a;
                i > 20 && i < 120 && t.push({ gap: i, fromIdx: s - 1, toIdx: s });
            }
            if (t.length < 2) return e;
            const n = new Map(),
                a = 4;
            for (const { gap: s } of t) {
                const e = Math.round(s / a) * a;
                n.set(e, (n.get(e) || 0) + 1);
            }
            let i = 0,
                o = 0;
            for (const [s, c] of n) c > o && ((o = c), (i = s));
            if (o < 2) return e;
            const r = new Set();
            for (const { gap: s, fromIdx: c, toIdx: l } of t) Math.abs(s - i) <= a && (r.add(c), r.add(l));
            return e.filter((e, t) => r.has(t));
        })(d)
    );
}
function tm(e, t) {
    const n = e.map(e => e.entity.name.toLowerCase()),
        a = t.map(e => e.toLowerCase()),
        i = n.filter(e => a.includes(e)).length,
        o = n.filter(e => !a.includes(e)).length,
        r = a.filter(e => !n.includes(e)).length,
        s = i + o + r;
    return {
        accuracy: s > 0 ? i / s : 0,
        precision: i + o > 0 ? i / (i + o) : 0,
        recall: i + r > 0 ? i / (i + r) : 0,
        truePositives: i,
        falsePositives: o,
        falseNegatives: r,
    };
}
function nm(e, t) {
    return 1280 === e && 800 === t
        ? { category: 'steam_deck', width: e, height: t }
        : Math.abs(e - 1280) < 50 && Math.abs(t - 720) < 50
          ? { category: '720p', width: e, height: t }
          : Math.abs(e - 1920) < 50 && Math.abs(t - 1080) < 50
            ? { category: '1080p', width: e, height: t }
            : Math.abs(e - 2560) < 50 && Math.abs(t - 1440) < 50
              ? { category: '1440p', width: e, height: t }
              : Math.abs(e - 3840) < 50 && Math.abs(t - 2160) < 50
                ? { category: '4K', width: e, height: t }
                : { category: 'custom', width: e, height: t };
}
function am(e, t) {
    const n = e / t;
    return Math.abs(n - 1.6) < 0.1 ? 'steam_deck' : Math.abs(n - 1.7777) < 0.1 ? 'pc' : 'unknown';
}
function im(e, t) {
    return e.reduce((e, n) => {
        const a = t(n);
        return (e[a] || (e[a] = []), e[a].push(n), e);
    }, {});
}
function om(e, t) {
    return (
        {
            '720p': [32, 38, 44],
            '1080p': [40, 48, 56],
            '1440p': [48, 55, 64],
            '4K': [64, 72, 80],
            steam_deck: [36, 42, 48],
        }[nm(e, t).category] || [40, 50, 60]
    );
}
function rm(e, t, n = 64) {
    const a = { '720p': 38, '1080p': 45, '1440p': 55, '4K': 70, steam_deck: 40 }[nm(e, t).category] || 45,
        i = [],
        o = Math.floor(0.12 * a),
        r = t - a - 15;
    for (let s = 50; s < e - 50 - a; s += a + o) i.push({ x: s, y: r, width: a, height: a, label: `cell_${i.length}` });
    return i.slice(0, 30);
}
function sm(e, t) {
    if (0 === e.length) return { mode: 0, count: 0, stdDev: 0 };
    const n = new Map();
    for (const s of e) {
        const e = Math.round(s / t) * t;
        (n.has(e) || n.set(e, []), n.get(e).push(s));
    }
    let a = 0,
        i = 0,
        o = [];
    for (const [s, c] of n) c.length > i && ((i = c.length), (a = s), (o = c));
    let r = 0;
    if (o.length > 1) {
        const e = o.reduce((e, t) => e + t, 0) / o.length,
            t = o.reduce((t, n) => t + (n - e) ** 2, 0) / o.length;
        r = Math.sqrt(t);
    }
    return { mode: a, count: i, stdDev: r };
}
function cm(e, t, n) {
    const a = 0.2 * t;
    if (e.length < 3 || 0 === n) return a;
    const i = 2 * n,
        o = 0.15 * t,
        r = 0.35 * t;
    return Math.max(o, Math.min(r, Math.max(i, a)));
}
function lm(e, t) {
    if (e.length < 3) return { isValid: !0, confidence: 0.5, filteredDetections: e, gridParams: null };
    const n = e.filter(e => e.position).map(e => ({ x: e.position.x, y: e.position.y, detection: e }));
    if (n.length < 3) return { isValid: !0, confidence: 0.5, filteredDetections: e, gridParams: null };
    const a = (function (e, t) {
            if (0 === e.length) return [];
            const n = [...e].sort((e, t) => e.y - t.y),
                a = n[0];
            if (!a) return [];
            const i = [];
            let o = [a];
            for (let r = 1; r < n.length; r++) {
                const e = n[r],
                    a = n[r - 1];
                e && a && (e.y - a.y <= t ? o.push(e) : (i.push(o), (o = [e])));
            }
            return (i.push(o), i);
        })(n, 0.3 * t),
        i = [];
    for (const v of a) {
        if (v.length < 2) continue;
        const e = [...v].sort((e, t) => e.x - t.x);
        for (let n = 1; n < e.length; n++) {
            const a = e[n],
                o = e[n - 1];
            if (!a || !o) continue;
            const r = a.x - o.x;
            r > 0.5 * t && r < 2.5 * t && i.push(r);
        }
    }
    const o = [];
    if (a.length > 1) {
        const e = a.map(e => e.reduce((e, t) => e + t.y, 0) / e.length).sort((e, t) => e - t);
        for (let n = 1; n < e.length; n++) {
            const a = e[n],
                i = e[n - 1];
            if (void 0 === a || void 0 === i) continue;
            const r = a - i;
            r > 0.5 * t && r < 2.5 * t && o.push(r);
        }
    }
    const r = Math.max(6, 0.15 * t),
        s = sm(i, r),
        c = o.length > 0 ? sm(o, r) : { mode: t, count: 0, stdDev: 0 },
        l = s.count >= 2 ? s.mode : t,
        d = c.count >= 2 ? c.mode : t,
        u = cm(i, t, s.stdDev),
        h = cm(o, t, c.stdDev),
        m = Math.max(u, h),
        p = [];
    for (const v of a) {
        if (0 === v.length) continue;
        const e = [...v].sort((e, t) => e.x - t.x),
            t = e[0];
        t && p.push(t);
        for (let n = 1; n < e.length; n++) {
            const t = e[n],
                a = e[n - 1];
            if (!t || !a) continue;
            const i = t.x - a.x,
                o = Math.abs(i - l) <= m,
                r = (i > 1.5 * l && Math.abs((i % l) - 0) <= m) || Math.abs((i % l) - l) <= m;
            (o || r) && p.push(t);
        }
    }
    const f = p.length / n.length,
        g = Math.max(2, Math.ceil(0.15 * n.length)),
        y = f >= 0.7 || n.length - p.length <= g || p.length >= n.length - 2;
    return (
        zi.info({
            operation: 'cv.grid_verification',
            data: {
                totalDetections: n.length,
                filteredDetections: p.length,
                rows: a.length,
                xSpacing: l,
                ySpacing: d,
                tolerance: m,
                adaptiveXTolerance: u,
                fitRatio: f,
                isValid: y,
            },
        }),
        {
            isValid: y,
            confidence: f,
            filteredDetections: p.map(e => e.detection),
            gridParams: { xSpacing: l, ySpacing: d, tolerance: m },
        }
    );
}
function dm(e) {
    let t = (function (e, t = 1.5) {
        const n = new Uint8ClampedArray(e.data),
            a = 128;
        for (let i = 0; i < n.length; i += 4)
            ((n[i] = Math.min(255, Math.max(0, a + ((n[i] ?? 0) - a) * t))),
                (n[i + 1] = Math.min(255, Math.max(0, a + ((n[i + 1] ?? 0) - a) * t))),
                (n[i + 2] = Math.min(255, Math.max(0, a + ((n[i + 2] ?? 0) - a) * t))));
        return { data: n, width: e.width, height: e.height };
    })(e);
    return (
        (t = (function (e) {
            const t = new Uint8ClampedArray(e.data);
            let n = 255,
                a = 0,
                i = 255,
                o = 0,
                r = 255,
                s = 0;
            for (let u = 0; u < t.length; u += 4)
                ((n = Math.min(n, t[u] ?? 0)),
                    (a = Math.max(a, t[u] ?? 0)),
                    (i = Math.min(i, t[u + 1] ?? 0)),
                    (o = Math.max(o, t[u + 1] ?? 0)),
                    (r = Math.min(r, t[u + 2] ?? 0)),
                    (s = Math.max(s, t[u + 2] ?? 0)));
            const c = a - n || 1,
                l = o - i || 1,
                d = s - r || 1;
            for (let u = 0; u < t.length; u += 4)
                (c >= 20 && (t[u] = Math.round((((t[u] ?? 0) - n) / c) * 255)),
                    l >= 20 && (t[u + 1] = Math.round((((t[u + 1] ?? 0) - i) / l) * 255)),
                    d >= 20 && (t[u + 2] = Math.round((((t[u + 2] ?? 0) - r) / d) * 255)));
            return { data: t, width: e.width, height: e.height };
        })(t)),
        t
    );
}
function um(e, t) {
    if (e.width !== t.width || e.height !== t.height) return 0;
    const n = e.width,
        a = e.height,
        i = (0.01 * 255) ** 2,
        o = (0.03 * 255) ** 2,
        r = new Float32Array(n * a),
        s = new Float32Array(n * a);
    for (let d = 0; d < n * a; d++) {
        const n = 4 * d;
        ((r[d] = ((e.data[n] ?? 0) + (e.data[n + 1] ?? 0) + (e.data[n + 2] ?? 0)) / 3),
            (s[d] = ((t.data[n] ?? 0) + (t.data[n + 1] ?? 0) + (t.data[n + 2] ?? 0)) / 3));
    }
    let c = 0,
        l = 0;
    for (let d = 0; d <= a - 8; d += 4)
        for (let e = 0; e <= n - 8; e += 4) {
            let t = 0,
                a = 0;
            const u = 64;
            for (let i = 0; i < 8; i++)
                for (let o = 0; o < 8; o++) {
                    const c = (d + i) * n + (e + o);
                    ((t += r[c] ?? 0), (a += s[c] ?? 0));
                }
            ((t /= u), (a /= u));
            let h = 0,
                m = 0,
                p = 0;
            for (let i = 0; i < 8; i++)
                for (let o = 0; o < 8; o++) {
                    const c = (d + i) * n + (e + o),
                        l = (r[c] ?? 0) - t,
                        u = (s[c] ?? 0) - a;
                    ((h += l * l), (m += u * u), (p += l * u));
                }
            ((h /= u), (m /= u), (p /= u));
            const f = (2 * t * a + i) * (2 * p + o),
                g = (t ** 2 + a ** 2 + i) * (h + m + o);
            ((c += Math.max(0, Math.min(1, f / g))), l++);
        }
    return 0 === l
        ? (function (e, t) {
              if (e.width !== t.width || e.height !== t.height) return 0;
              const n = e.data,
                  a = t.data,
                  i = n.length / 4;
              if (0 === i) return 0;
              let o = 0,
                  r = 0;
              const s = [],
                  c = [];
              for (let f = 0; f < n.length; f += 4) {
                  const e = ((n[f] ?? 0) + (n[f + 1] ?? 0) + (n[f + 2] ?? 0)) / 3,
                      t = ((a[f] ?? 0) + (a[f + 1] ?? 0) + (a[f + 2] ?? 0)) / 3;
                  (s.push(e), c.push(t), (o += e), (r += t));
              }
              ((o /= i), (r /= i));
              let l = 0,
                  d = 0,
                  u = 0;
              for (let f = 0; f < i; f++) {
                  const e = (s[f] ?? 0) - o,
                      t = (c[f] ?? 0) - r;
                  ((l += e * e), (d += t * t), (u += e * t));
              }
              ((l /= i), (d /= i), (u /= i));
              const h = (0.01 * 255) ** 2,
                  m = (0.03 * 255) ** 2,
                  p = ((2 * o * r + h) * (2 * u + m)) / ((o ** 2 + r ** 2 + h) * (l + d + m));
              return Math.max(0, Math.min(1, p));
          })(e, t)
        : Math.max(0, Math.min(1, c / l));
}
function hm(e, t) {
    const n = dm(e),
        a = dm(t),
        i = (function (e, t) {
            const n = e.data,
                a = t.data;
            let i = 0,
                o = 0,
                r = 0,
                s = 0,
                c = 0,
                l = 0;
            const d = Math.min(n.length, a.length);
            for (let y = 0; y < d; y += 4) {
                const e = ((n[y] ?? 0) + (n[y + 1] ?? 0) + (n[y + 2] ?? 0)) / 3,
                    t = ((a[y] ?? 0) + (a[y + 1] ?? 0) + (a[y + 2] ?? 0)) / 3;
                ((i += e), (o += t), (r += e * t), (s += e * e), (c += t * t), l++);
            }
            if (0 === l) return 0;
            const u = i / l,
                h = o / l,
                m = r / l - u * h,
                p = (s / l - u * u) * (c / l - h * h);
            if (p <= 0) return 0;
            const f = Math.sqrt(p);
            if (0 === f || !Number.isFinite(f)) return 0;
            const g = (m / f + 1) / 2;
            return Math.max(0, Math.min(1, g));
        })(n, a),
        o = (function (e, t) {
            const n = 32,
                a = new Array(512).fill(0),
                i = new Array(512).fill(0),
                o = e.data,
                r = t.data;
            let s = 0,
                c = 0;
            for (let d = 0; d < o.length; d += 4) {
                const e =
                    8 * Math.min(7, Math.floor((o[d] ?? 0) / n)) * 8 +
                    8 * Math.min(7, Math.floor((o[d + 1] ?? 0) / n)) +
                    Math.min(7, Math.floor((o[d + 2] ?? 0) / n));
                ((a[e] = (a[e] ?? 0) + 1), s++);
            }
            for (let d = 0; d < r.length; d += 4) {
                const e =
                    8 * Math.min(7, Math.floor((r[d] ?? 0) / n)) * 8 +
                    8 * Math.min(7, Math.floor((r[d + 1] ?? 0) / n)) +
                    Math.min(7, Math.floor((r[d + 2] ?? 0) / n));
                ((i[e] = (i[e] ?? 0) + 1), c++);
            }
            if (0 === s || 0 === c) return 0;
            for (let d = 0; d < a.length; d++) ((a[d] = (a[d] ?? 0) / s), (i[d] = (i[d] ?? 0) / c));
            let l = 0;
            for (let d = 0; d < a.length; d++) l += Math.min(a[d] ?? 0, i[d] ?? 0);
            return l;
        })(n, a),
        r = um(n, a),
        s = (function (e, t) {
            const { width: n, height: a } = e,
                { width: i, height: o } = t;
            if (n !== i || a !== o) return 0;
            const r = e.data,
                s = t.data,
                c = (e, t, n, a) => {
                    const i = 4 * (n * a + t);
                    return ((e[i] ?? 0) + (e[i + 1] ?? 0) + (e[i + 2] ?? 0)) / 3;
                },
                l = (e, t, n, a, i) => {
                    if (t <= 0 || t >= a - 1 || n <= 0 || n >= i - 1) return 0;
                    const o = c(e, t + 1, n, a) - c(e, t - 1, n, a),
                        r = c(e, t, n + 1, a) - c(e, t, n - 1, a);
                    return Math.sqrt(o * o + r * r);
                };
            let d = 0,
                u = 0,
                h = 0;
            for (let f = 1; f < a - 1; f += 2)
                for (let e = 1; e < n - 1; e += 2) {
                    const t = l(r, e, f, n, a),
                        c = l(s, e, f, i, o);
                    ((d += t * c), (u += t * t), (h += c * c));
                }
            const m = Math.sqrt(u * h);
            if (0 === m) return 0;
            const p = d / m;
            return Math.max(0, Math.min(1, p));
        })(n, a);
    return (function (e, t, n, a) {
        const i = Rh,
            o = i.weights;
        let r = e * o.ncc + t * o.ssim + n * o.histogram + a * o.edge;
        if (i.agreement.enabled) {
            const s = [e, t, n, a],
                c = [o.ncc, o.ssim, o.histogram, o.edge],
                l = s.filter((e, t) => (c[t] ?? 0) > 0).filter(e => e >= i.agreement.threshold).length;
            l >= i.agreement.minMetricsForBonus &&
                (r += Math.min(
                    (l - i.agreement.minMetricsForBonus + 1) * i.agreement.bonusPerMetric,
                    i.agreement.maxBonus
                ));
        }
        return Math.max(i.minConfidence, Math.min(i.maxConfidence, r));
    })(i, r, o, s);
}
'undefined' != typeof window &&
    (window.testUtils = {
        calculateAccuracyMetrics: tm,
        calculateF1Score: function (e, t) {
            return e + t === 0 ? 0 : (2 * e * t) / (e + t);
        },
        detectResolution: nm,
        detectUILayout: am,
        generateTestReport: function (e) {
            let t = '# MegaBonk Image Recognition Test Report\n\n';
            ((t += `**Total Tests:** ${e.length}\n`), (t += `**Generated:** ${new Date().toISOString()}\n\n`));
            const n = e.reduce((e, t) => e + t.accuracy, 0) / e.length,
                a = e.reduce((e, t) => e + t.precision, 0) / e.length,
                i = e.reduce((e, t) => e + t.recall, 0) / e.length,
                o = e.reduce((e, t) => e + t.processingTime, 0) / e.length;
            ((t += '## Overall Performance\n\n'),
                (t += `- **Average Accuracy:** ${(100 * n).toFixed(2)}%\n`),
                (t += `- **Average Precision:** ${(100 * a).toFixed(2)}%\n`),
                (t += `- **Average Recall:** ${(100 * i).toFixed(2)}%\n`),
                (t += `- **Average Processing Time:** ${o.toFixed(2)}ms\n\n`));
            const r = im(e, e => e.resolution);
            t += '## Performance by Resolution\n\n';
            for (const [l, d] of Object.entries(r)) {
                const e = d.reduce((e, t) => e + t.accuracy, 0) / d.length;
                t += `- **${l}:** ${(100 * e).toFixed(2)}% accuracy (${d.length} tests)\n`;
            }
            t += '\n';
            const s = im(e, e => e.uiLayout);
            t += '## Performance by UI Layout\n\n';
            for (const [l, d] of Object.entries(s)) {
                const e = d.reduce((e, t) => e + t.accuracy, 0) / d.length;
                t += `- **${l}:** ${(100 * e).toFixed(2)}% accuracy (${d.length} tests)\n`;
            }
            t += '\n';
            const c = im(e, e => e.detectionMode);
            t += '## Performance by Detection Mode\n\n';
            for (const [l, d] of Object.entries(c)) {
                const e = d.reduce((e, t) => e + t.accuracy, 0) / d.length;
                t += `- **${l}:** ${(100 * e).toFixed(2)}% accuracy (${d.length} tests)\n`;
            }
            return (
                (t += '\n'),
                (t += '## Individual Test Results\n\n'),
                e.forEach((e, n) => {
                    ((t += `### Test ${n + 1}: ${e.imageName}\n\n`),
                        (t += `- **Resolution:** ${e.resolution}\n`),
                        (t += `- **UI Layout:** ${e.uiLayout}\n`),
                        (t += `- **Detection Mode:** ${e.detectionMode}\n`),
                        (t += `- **Accuracy:** ${(100 * e.accuracy).toFixed(2)}%\n`),
                        (t += `- **Precision:** ${(100 * e.precision).toFixed(2)}%\n`),
                        (t += `- **Recall:** ${(100 * e.recall).toFixed(2)}%\n`),
                        (t += `- **Processing Time:** ${e.processingTime.toFixed(2)}ms\n`),
                        e.errors.length > 0 && (t += `- **Errors:** ${e.errors.join(', ')}\n`),
                        (t += '\n'));
                }),
                t
            );
        },
        runAutomatedTest: async function (e, t, n, a) {
            const i = performance.now();
            try {
                const o = new Image();
                await new Promise((t, n) => {
                    ((o.onload = t), (o.onerror = n), (o.src = e));
                });
                const r = nm(o.width, o.height),
                    s = am(o.width, o.height),
                    c = await n(e),
                    l = tm(c.items, t.items),
                    d = performance.now() - i,
                    u = c.items.map(e => e.entity.name),
                    h = c.items.map(e => e.confidence);
                return (
                    zi.info({
                        operation: 'test.automated_test',
                        data: {
                            resolution: `${r.width}x${r.height}`,
                            uiLayout: s,
                            detectionMode: a,
                            accuracy: l.accuracy,
                            processingTime: d,
                        },
                    }),
                    {
                        imageName: 'automated_test',
                        resolution: `${r.width}x${r.height}`,
                        uiLayout: s,
                        detectionMode: a,
                        expectedItems: t.items,
                        detectedItems: u,
                        accuracy: l.accuracy,
                        precision: l.precision,
                        recall: l.recall,
                        confidenceScores: h,
                        processingTime: d,
                        errors: [],
                    }
                );
            } catch (o) {
                const e = performance.now() - i;
                return {
                    imageName: 'automated_test',
                    resolution: 'unknown',
                    uiLayout: 'unknown',
                    detectionMode: a,
                    expectedItems: t.items,
                    detectedItems: [],
                    accuracy: 0,
                    precision: 0,
                    recall: 0,
                    confidenceScores: [],
                    processingTime: e,
                    errors: [o.message],
                };
            }
        },
        compareDetectionResults: function (e, t) {
            const n = e.items.map(e => e.entity.name),
                a = t.items.map(e => e.entity.name),
                i = new Set(n),
                o = new Set(a),
                r = n.filter(e => !o.has(e)),
                s = a.filter(e => !i.has(e)),
                c = n.filter(e => o.has(e));
            return { onlyIn1: r, onlyIn2: s, inBoth: c, agreement: c.length / Math.max(n.length, a.length, 1) };
        },
    });
const mm = new Map(),
    pm = new Map(),
    fm = new Map();
let gm = { successRateWeight: 0.7, confidenceWeight: 0.3, timeDecay: 0.95 },
    ym = 0;
function vm(e) {
    return (
        (function () {
            const e = Date.now();
            if (e - ym < 6e4) return;
            pm.clear();
            for (const [t, n] of mm) {
                const e = wm(n);
                pm.set(t, e);
            }
            ym = e;
        })(),
        pm.get(e) || null
    );
}
function bm(e) {
    return fm.has(e);
}
function wm(e) {
    const t = e.usageCount > 0 ? e.successCount / e.usageCount : 0,
        n = (Date.now() - e.lastUpdated) / 864e5,
        a = Math.pow(gm.timeDecay, n),
        i = (t * gm.successRateWeight + e.avgConfidence * gm.confidenceWeight) * a;
    return {
        templateId: e.templateId,
        itemId: e.itemId,
        rankScore: i,
        successRate: t,
        shouldSkip: fm.has(e.templateId),
        threshold: e.optimalThreshold,
    };
}
let _m = {
    minVotes: 1,
    minConsensus: 0.5,
    usePerformanceWeighting: !0,
    performanceWeight: 0.3,
    method: 'weighted-average',
    confusionPenalty: 0.1,
};
function km(e, t) {
    if (!t.usePerformanceWeighting) return 1;
    const n = vm(e);
    if (!n) return 1;
    let a = 0.5 + 0.5 * n.successRate;
    return ((a += Math.min(n.rankScore / 100, 0.2)), n.shouldSkip && (a *= 0.5), Math.max(0.1, Math.min(1.5, a)));
}
function xm(e, t, n) {
    switch (n.method) {
        case 'max':
            return e.maxConfidence;
        case 'median': {
            const n = t
                    .filter(t => t.itemId === e.itemId)
                    .map(e => e.confidence)
                    .sort((e, t) => e - t),
                a = Math.floor(n.length / 2);
            return n.length % 2 == 0 ? ((n[a - 1] ?? 0) + (n[a] ?? 0)) / 2 : (n[a] ?? 0);
        }
        case 'ranked-choice': {
            const n = t
                .filter(t => t.itemId === e.itemId)
                .map(e => e.confidence)
                .sort((e, t) => t - e);
            let a = 0,
                i = 0;
            for (let e = 0; e < n.length; e++) {
                const t = 1 / (e + 1);
                ((a += (n[e] ?? 0) * t), (i += t));
            }
            return i > 0 ? a / i : 0;
        }
        default:
            return e.weightedConfidence;
    }
}
function Em(e, t) {
    const n = { ..._m, ...t };
    if (0 === e.length) return null;
    const a = (function (e, t) {
        const n = new Map();
        for (const a of e) {
            const e = n.get(a.itemId),
                i = km(a.templateId, t),
                o = a.confidence * i;
            e
                ? (e.voteCount++,
                  (e.totalWeight += i),
                  (e.avgConfidence = (e.avgConfidence * (e.voteCount - 1) + a.confidence) / e.voteCount),
                  (e.maxConfidence = Math.max(e.maxConfidence, a.confidence)),
                  (e.weightedConfidence += o))
                : n.set(a.itemId, {
                      itemId: a.itemId,
                      voteCount: 1,
                      totalWeight: i,
                      avgConfidence: a.confidence,
                      maxConfidence: a.confidence,
                      weightedConfidence: o,
                  });
        }
        for (const a of n.values()) a.totalWeight > 0 && (a.weightedConfidence /= a.totalWeight);
        return n;
    })(e, n);
    if (0 === a.size) return null;
    let i = null,
        o = -1;
    for (const l of a.values()) {
        const t = xm(l, e, n);
        t > o && ((o = t), (i = l));
    }
    if (!i) return null;
    const r = e.length,
        s = i.voteCount / r;
    if (i.voteCount < n.minVotes) return null;
    s < n.minConsensus && (o *= s);
    const c = e.find(e => e.itemId === i.itemId)?.rarity;
    return {
        itemId: i.itemId,
        confidence: Math.min(0.99, o),
        voteCount: i.voteCount,
        totalVotes: r,
        passesThreshold: Nh(o, c),
        votingBreakdown: a,
        consensus: s,
    };
}
function Sm(e, t) {
    return (function (e, t) {
        return hm(e, t);
    })(e, t);
}
function Cm(e, t, n, a, i = !1) {
    if (
        !i &&
        a &&
        !(function (e) {
            if (bm(e)) return !1;
            const t = vm(e);
            return !(t && t.successRate < 0.3 && !t.shouldSkip);
        })(a ? `${a}_primary` : 'unknown')
    )
        return 0;
    const o = Yh(e, t);
    let r;
    if (
        a &&
        (function (e) {
            return Nu.has(e) && Nu.get(e).size > 0;
        })(a)
    ) {
        const e = (function (e) {
            let t = Bu[0] ?? 48,
                n = Math.abs(e - t);
            for (const a of Bu) {
                const i = Math.abs(e - a);
                i < n && ((n = i), (t = a));
            }
            return t;
        })(Math.max(o.width, o.height));
        if (
            ((r = (function (e, t) {
                return Nu.get(e)?.get(t);
            })(a, e)),
            r && (e !== o.width || e !== o.height))
        ) {
            const e = Gh(r, o.width, o.height);
            e && (r = e);
        }
    }
    if (
        (!r &&
            a &&
            (r = (function (e, t, n) {
                const a = `${e}_${t}_${n}`;
                return Pu.get(a);
            })(a, o.width, o.height)),
        !r)
    ) {
        if (((r = Gh(n.ctx.getImageData(0, 0, n.width, n.height), o.width, o.height) ?? void 0), !r)) return 0;
        a &&
            (function (e, t, n, a) {
                const i = `${e}_${t}_${n}`;
                Pu.set(i, a);
            })(a, o.width, o.height, r);
    }
    return Sm(o, r);
}
function $m(e, t, n, a, i) {
    const o = Cm(e, t, n, a);
    if (!i || 0 === i.length) return o;
    const r = Yh(e, t),
        s = [{ templateId: `primary_${a}`, itemId: a, confidence: o }];
    for (let l = 0; l < i.length; l++) {
        const e = i[l];
        if (!e) continue;
        const t = Gh(e.imageData, r.width, r.height);
        if (!t) continue;
        const n = Sm(r, t);
        s.push({ templateId: `training_${a}_${l}`, itemId: a, confidence: n });
    }
    const c = Em(s);
    return c ? c.confidence : o;
}
function Mm(e, t, n, a, i = !1) {
    const o = Zu();
    let r = null;
    for (const s of n) {
        const n = o.get(s.id);
        if (!n) continue;
        const c = i ? hh(s.id) : [],
            l = c.length > 0 ? $m(e, t, n, s.id, c) : Cm(e, t, n, s.id);
        l >= 0.35 && l > a && (!r || l > r.similarity) && (r = { item: s, similarity: l });
    }
    return r;
}
async function Tm(e, t = 3e4) {
    return new Promise((n, a) => {
        const i = new Image();
        let o = null,
            r = !1;
        const s = () => {
            o && (clearTimeout(o), (o = null));
        };
        ((o = setTimeout(() => {
            r ||
                ((r = !0),
                (i.src = ''),
                zi.warn({
                    operation: 'cv.load_image_timeout',
                    error: { name: 'TimeoutError', message: `Image loading timed out after ${t}ms` },
                }),
                a(new Error(`Image loading timed out after ${t}ms`)));
        }, t)),
            (i.onload = () => {
                if (r) return;
                ((r = !0), s());
                const e = document.createElement('canvas');
                ((e.width = i.width), (e.height = i.height));
                const t = e.getContext('2d', { willReadFrequently: !0 });
                t
                    ? (t.drawImage(i, 0, 0), n({ canvas: e, ctx: t, width: i.width, height: i.height }))
                    : a(new Error('Failed to get canvas context'));
            }),
            (i.onerror = e => {
                if (r) return;
                ((r = !0), s());
                const t = e instanceof ErrorEvent ? e.message : 'Failed to load image';
                (zi.warn({ operation: 'cv.load_image_error', error: { name: 'ImageLoadError', message: t } }),
                    a(new Error(t)));
            }),
            (i.src = e));
    });
}
function Am(e, t) {
    const n = Ju();
    if ((n.set(e, { results: t, timestamp: Date.now() }), n.size > 50)) {
        const e = Array.from(n.entries());
        e.sort((e, t) => e[1].timestamp - t[1].timestamp);
        for (let t = 0; t < 10; t++) {
            const a = e[t];
            a && n.delete(a[0]);
        }
    }
}
class Im {
    constructor() {
        ((this.enabled = !1),
            (this.runs = []),
            (this.currentRun = null),
            (this.colorFilterStats = { attempts: 0, exactMatches: 0, mixedFallbacks: 0, candidateCounts: [] }));
    }
    static getInstance() {
        return (Im.instance || (Im.instance = new Im()), Im.instance);
    }
    setEnabled(e) {
        ((this.enabled = e), e && zi.info({ operation: 'cv.metrics.enabled' }));
    }
    isEnabled() {
        return this.enabled;
    }
    startRun(e, t, n) {
        this.enabled &&
            ((this.currentRun = {
                totalTimeMs: 0,
                gridDetectionTimeMs: 0,
                templateMatchingTimeMs: 0,
                validationTimeMs: 0,
                twoPhaseAttempted: !1,
                twoPhaseSucceeded: !1,
                twoPhaseFailureReason: null,
                gridConfidence: 0,
                gridCellsGenerated: 0,
                gridVerificationInput: 0,
                gridVerificationOutput: 0,
                gridVerificationRejected: 0,
                colorFilterAttempts: 0,
                colorExactMatches: 0,
                colorMixedFallbacks: 0,
                avgCandidatesAfterColorFilter: 0,
                totalDetections: 0,
                highConfidenceDetections: 0,
                mediumConfidenceDetections: 0,
                lowConfidenceDetections: 0,
                confidenceHistogram: { '0.5-0.6': 0, '0.6-0.7': 0, '0.7-0.8': 0, '0.8-0.9': 0, '0.9-1.0': 0 },
                rarityValidationMatches: 0,
                rarityValidationMismatches: 0,
                rarityValidationRejections: 0,
                detectionsByRarity: {},
                imageWidth: e,
                imageHeight: t,
                resolution: n,
            }),
            (this.colorFilterStats = { attempts: 0, exactMatches: 0, mixedFallbacks: 0, candidateCounts: [] }));
    }
    recordTwoPhaseAttempt(e, t, n, a) {
        this.enabled &&
            this.currentRun &&
            ((this.currentRun.twoPhaseAttempted = !0),
            (this.currentRun.twoPhaseSucceeded = e),
            (this.currentRun.twoPhaseFailureReason = t),
            (this.currentRun.gridConfidence = n),
            (this.currentRun.gridCellsGenerated = a));
    }
    recordGridDetectionTime(e) {
        this.enabled && this.currentRun && (this.currentRun.gridDetectionTimeMs = e);
    }
    recordTemplateMatchingTime(e) {
        this.enabled && this.currentRun && (this.currentRun.templateMatchingTimeMs = e);
    }
    recordValidationTime(e) {
        this.enabled && this.currentRun && (this.currentRun.validationTimeMs = e);
    }
    recordGridVerification(e, t) {
        this.enabled &&
            this.currentRun &&
            ((this.currentRun.gridVerificationInput = e),
            (this.currentRun.gridVerificationOutput = t),
            (this.currentRun.gridVerificationRejected = e - t));
    }
    recordColorFilter(e, t, n) {
        this.enabled &&
            this.currentRun &&
            (this.colorFilterStats.attempts++,
            e && this.colorFilterStats.exactMatches++,
            t && this.colorFilterStats.mixedFallbacks++,
            this.colorFilterStats.candidateCounts.push(n));
    }
    recordDetection(e, t) {
        if (!this.enabled || !this.currentRun) return;
        ((this.currentRun.totalDetections = (this.currentRun.totalDetections || 0) + 1),
            e >= 0.8
                ? (this.currentRun.highConfidenceDetections = (this.currentRun.highConfidenceDetections || 0) + 1)
                : e >= 0.65
                  ? (this.currentRun.mediumConfidenceDetections = (this.currentRun.mediumConfidenceDetections || 0) + 1)
                  : (this.currentRun.lowConfidenceDetections = (this.currentRun.lowConfidenceDetections || 0) + 1));
        const n = this.currentRun.confidenceHistogram;
        (e >= 0.9
            ? n['0.9-1.0']++
            : e >= 0.8
              ? n['0.8-0.9']++
              : e >= 0.7
                ? n['0.7-0.8']++
                : e >= 0.6
                  ? n['0.6-0.7']++
                  : n['0.5-0.6']++,
            this.currentRun.detectionsByRarity || (this.currentRun.detectionsByRarity = {}),
            (this.currentRun.detectionsByRarity[t] = (this.currentRun.detectionsByRarity[t] || 0) + 1));
    }
    recordRarityValidation(e, t) {
        this.enabled &&
            this.currentRun &&
            (t
                ? (this.currentRun.rarityValidationRejections = (this.currentRun.rarityValidationRejections || 0) + 1)
                : e
                  ? (this.currentRun.rarityValidationMatches = (this.currentRun.rarityValidationMatches || 0) + 1)
                  : (this.currentRun.rarityValidationMismatches =
                        (this.currentRun.rarityValidationMismatches || 0) + 1));
    }
    endRun(e) {
        if (!this.enabled || !this.currentRun) return null;
        ((this.currentRun.colorFilterAttempts = this.colorFilterStats.attempts),
            (this.currentRun.colorExactMatches = this.colorFilterStats.exactMatches),
            (this.currentRun.colorMixedFallbacks = this.colorFilterStats.mixedFallbacks),
            (this.currentRun.avgCandidatesAfterColorFilter =
                this.colorFilterStats.candidateCounts.length > 0
                    ? this.colorFilterStats.candidateCounts.reduce((e, t) => e + t, 0) /
                      this.colorFilterStats.candidateCounts.length
                    : 0),
            (this.currentRun.totalTimeMs = e));
        const t = this.currentRun;
        return (this.runs.push(t), (this.currentRun = null), t);
    }
    getRuns() {
        return [...this.runs];
    }
    getAggregatedMetrics() {
        if (0 === this.runs.length) return null;
        const e = this.runs,
            t = e.length,
            n = e.filter(e => e.twoPhaseAttempted).length,
            a = e.filter(e => e.twoPhaseSucceeded).length,
            i = n > 0 ? a / n : 0,
            o = e.filter(e => e.twoPhaseAttempted).map(e => e.gridConfidence),
            r = o.length > 0 ? o.reduce((e, t) => e + t, 0) / o.length : 0,
            s = e.filter(e => e.gridVerificationInput > 0).map(e => e.gridVerificationOutput / e.gridVerificationInput),
            c = s.length > 0 ? s.reduce((e, t) => e + t, 0) / s.length : 1,
            l = e.filter(e => e.colorFilterAttempts > 0);
        return {
            runCount: t,
            twoPhaseSuccessRate: i,
            avgGridConfidence: r,
            avgGridRetentionRate: c,
            avgColorExactMatchRate:
                l.length > 0 ? l.reduce((e, t) => e + t.colorExactMatches / t.colorFilterAttempts, 0) / l.length : 0,
            avgColorMixedFallbackRate:
                l.length > 0 ? l.reduce((e, t) => e + t.colorMixedFallbacks / t.colorFilterAttempts, 0) / l.length : 0,
            avgCandidatesAfterFilter:
                l.length > 0 ? l.reduce((e, t) => e + t.avgCandidatesAfterColorFilter, 0) / l.length : 0,
            avgDetectionsPerRun: e.reduce((e, t) => e + t.totalDetections, 0) / t,
            avgHighConfidenceRate:
                e.reduce(
                    (e, t) => e + (t.totalDetections > 0 ? t.highConfidenceDetections / t.totalDetections : 0),
                    0
                ) / t,
            avgTotalTimeMs: e.reduce((e, t) => e + t.totalTimeMs, 0) / t,
            avgGridDetectionTimeMs: e.reduce((e, t) => e + t.gridDetectionTimeMs, 0) / t,
            avgTemplateMatchingTimeMs: e.reduce((e, t) => e + t.templateMatchingTimeMs, 0) / t,
            byDifficulty: {},
        };
    }
    clear() {
        ((this.runs = []),
            (this.currentRun = null),
            (this.colorFilterStats = { attempts: 0, exactMatches: 0, mixedFallbacks: 0, candidateCounts: [] }));
    }
    exportJSON() {
        return JSON.stringify(
            { runs: this.runs, aggregated: this.getAggregatedMetrics(), timestamp: new Date().toISOString() },
            null,
            2
        );
    }
}
function Lm() {
    return Im.getInstance();
}
async function zm(e, t, n, a, i = {}) {
    const { minConfidence: o = Wh(t, n), progressCallback: r } = i,
        s = Lm(),
        c = performance.now();
    r && r(20, 'Phase 1: Detecting grid structure...');
    const l = Qh(e, t, n),
        d = em(e, t, l),
        u = (function (e, t) {
            if (e.length < 2) return null;
            const n = [];
            for (let p = 1; p < e.length; p++) {
                const t = e[p],
                    a = e[p - 1];
                if (void 0 === t || void 0 === a) continue;
                const i = t - a;
                i > 20 && i < 120 && n.push(i);
            }
            if (n.length < 1) return null;
            const a = new Map();
            for (const p of n) {
                const e = 6 * Math.round(p / 6);
                a.set(e, (a.get(e) || 0) + 1);
            }
            let i = 0,
                o = 0;
            for (const [p, f] of a) f > o && ((o = f), (i = p));
            if (o < 2 || i < 25) return null;
            let r = e[0] ?? 0;
            for (let p = 0; p < e.length - 1; p++) {
                const t = e[p],
                    n = e[p + 1];
                if (void 0 === t || void 0 === n) continue;
                const a = n - t;
                if (Math.abs(a - i) <= 6) {
                    r = t;
                    break;
                }
            }
            let s = 1,
                c = r;
            for (let p = 0; p < e.length; p++) {
                const t = e[p];
                if (void 0 === t || t <= c) continue;
                const n = t - c;
                Math.abs(n - i) <= 6 && (s++, (c = t));
            }
            const l = s,
                d = o + 1,
                u = Math.min(1, d / Math.max(3, l)),
                h = t.bottomY - t.topY,
                m = Math.max(1, Math.round(h / i));
            return { startX: r, startY: t.topY, cellWidth: i, cellHeight: i, columns: s, rows: m, confidence: u };
        })(d, l);
    if (
        (s.recordGridDetectionTime(performance.now() - c),
        zi.info({
            operation: 'cv.two_phase.grid_detection',
            data: {
                hotbarConfidence: l.confidence,
                edgesFound: d.length,
                gridDetected: !!u,
                gridConfidence: u?.confidence || 0,
            },
        }),
        !u || u.confidence < 0.4 || u.columns < 3)
    ) {
        const e = u ? (u.confidence < 0.4 ? 'low_confidence' : 'too_few_columns') : 'no_grid';
        return (
            zi.info({ operation: 'cv.two_phase.fallback_to_sliding_window', data: { reason: e } }),
            s.recordTwoPhaseAttempt(!1, e, u?.confidence || 0, 0),
            { detections: [], gridUsed: !1, grid: null }
        );
    }
    r && r(30, 'Phase 2: Matching templates at grid positions...');
    const h = (function (e, t = 50) {
            const n = [];
            for (let a = 0; a < e.rows && n.length < t; a++)
                for (let i = 0; i < e.columns && n.length < t; i++)
                    n.push({
                        x: e.startX + i * e.cellWidth,
                        y: e.startY + a * e.cellHeight,
                        width: e.cellWidth,
                        height: e.cellHeight,
                        label: `grid_${a}_${i}`,
                    });
            return n;
        })(u),
        m = [],
        p = Uu(),
        f = uh();
    zi.info({
        operation: 'cv.two_phase.matching_start',
        data: { gridCells: h.length, columns: u.columns, rows: u.rows, cellSize: u.cellWidth },
    });
    for (let y = 0; y < h.length; y++) {
        const t = h[y];
        if (!t) continue;
        if (r && y % 5 == 0) {
            r(30 + Math.floor((y / h.length) * 50), `Matching cell ${y + 1}/${h.length}...`);
        }
        const n = e.getImageData(t.x, t.y, t.width, t.height);
        if (Ah(n)) continue;
        if (Eh(n) < 800) continue;
        const i = Ch(n),
            c = wh(i),
            l = [],
            d = new Set();
        let u = !1;
        for (const e of c) {
            const t = p.get(e) || [];
            e === i && t.length > 0 && (u = !0);
            for (const e of t) d.has(e.id) || (d.add(e.id), l.push(e));
        }
        const g = l.length > 0 ? l : a.slice(0, 30),
            v = !u && l.length > 0;
        s.recordColorFilter(u, v, g.length);
        const b = Mm(e, t, g, o, f);
        b &&
            (m.push({
                type: 'item',
                entity: b.item,
                confidence: b.similarity,
                position: { x: t.x, y: t.y, width: t.width, height: t.height },
                method: 'template_match',
            }),
            s.recordDetection(b.similarity, b.item.rarity));
    }
    const g = performance.now() - c - (s.isEnabled(), 0);
    return (
        s.recordTemplateMatchingTime(g),
        zi.info({ operation: 'cv.two_phase.complete', data: { detections: m.length, cellsScanned: h.length } }),
        s.recordTwoPhaseAttempt(!0, null, u.confidence, h.length),
        { detections: m, gridUsed: !0, grid: u }
    );
}
async function Dm(e, t, n, a, i = {}) {
    const o = Wh(t, n),
        { stepSize: r = 12, minConfidence: s = o, regionOfInterest: c, progressCallback: l, multiScale: d = !0 } = i,
        u = [],
        h = om(t, n),
        m = d ? h : [h[1] || 48],
        p = h[1] || 48,
        f = Zu(),
        g = Uu(),
        y = c?.x ?? 0,
        v = c?.y ?? 0,
        b = c?.width ?? t,
        w = c?.height ?? n,
        _ = Math.ceil((b - p) / r) * Math.ceil((w - p) / r);
    let k = 0;
    const x = uh();
    zi.info({
        operation: 'cv.sliding_window_start',
        data: {
            scanRegion: { x: y, y: v, w: b, h: w },
            iconSizes: m,
            multiScale: d,
            stepSize: r,
            totalSteps: _,
            templatesLoaded: f.size,
            trainingDataLoaded: x,
        },
    });
    for (let S = v; S <= v + w - p; S += r)
        for (let t = y; t <= y + b - p; t += r) {
            if ((k++, l && k % 100 == 0)) {
                l(Math.floor((k / _) * 60) + 20, `Scanning ${k}/${_}...`);
            }
            const n = e.getImageData(t, S, p, p);
            if (Ah(n)) continue;
            if (Eh(n) < 800) continue;
            const i = wh(Ch(n)),
                o = [],
                r = new Set();
            for (const e of i) {
                const t = g.get(e) || [];
                for (const e of t) r.has(e.id) || (r.add(e.id), o.push(e));
            }
            const c = o.length > 0 ? o : a.slice(0, 30);
            let d = null;
            for (const a of c) {
                const n = f.get(a.id);
                if (!n) continue;
                const i = x ? hh(a.id) : [];
                for (const o of m) {
                    const r = { x: t, y: S, width: o, height: o },
                        c = i.length > 0 ? $m(e, r, n, a.id, i) : Cm(e, r, n, a.id);
                    c > s + (o < 40 ? -0.02 : o > 60 ? 0.01 : 0) &&
                        (!d || c > d.similarity) &&
                        (d = { item: a, similarity: c, scale: o });
                }
            }
            d &&
                u.push({
                    type: 'item',
                    entity: d.item,
                    confidence: d.similarity,
                    position: { x: t, y: S, width: d.scale, height: d.scale },
                    method: 'template_match',
                });
        }
    zi.info({ operation: 'cv.sliding_window_complete', data: { rawDetections: u.length, scannedPositions: k } });
    const E = Kh(u, 0.3);
    return (zi.info({ operation: 'cv.nms_complete', data: { beforeNMS: u.length, afterNMS: E.length } }), E);
}
const Fm = {
    default: {
        id: 'default',
        name: 'Balanced',
        description: 'Balanced precision/recall with standard preprocessing',
        weight: 1,
        preprocessing: { contrastEnhance: !0, contrastFactor: 1.5, colorNormalize: !0, edgeEnhance: !1 },
        templates: { useRanking: !0, skipPoorPerformers: !0, maxTemplatesPerItem: 5 },
    },
    'high-precision': {
        id: 'high-precision',
        name: 'High Precision',
        description: 'Stricter matching to reduce false positives',
        weight: 0.9,
        minConfidence: 0.55,
        preprocessing: { contrastEnhance: !0, contrastFactor: 1.3, colorNormalize: !0, edgeEnhance: !1 },
        metricWeights: { ssim: 0.45, ncc: 0.2, histogram: 0.2, edge: 0.15 },
        templates: { useRanking: !0, skipPoorPerformers: !0, maxTemplatesPerItem: 3 },
    },
    'high-recall': {
        id: 'high-recall',
        name: 'High Recall',
        description: 'Lenient matching to catch more items',
        weight: 0.8,
        minConfidence: 0.35,
        preprocessing: { contrastEnhance: !0, contrastFactor: 1.8, colorNormalize: !0, edgeEnhance: !1 },
        metricWeights: { ssim: 0.3, ncc: 0.3, histogram: 0.25, edge: 0.15 },
        templates: { useRanking: !0, skipPoorPerformers: !1, maxTemplatesPerItem: 8 },
    },
    'edge-focused': {
        id: 'edge-focused',
        name: 'Edge Focused',
        description: 'Emphasizes edge structure over color',
        weight: 0.85,
        preprocessing: { contrastEnhance: !0, contrastFactor: 1.4, colorNormalize: !1, edgeEnhance: !0 },
        metricWeights: { ssim: 0.25, ncc: 0.15, histogram: 0.15, edge: 0.45 },
        templates: { useRanking: !0, skipPoorPerformers: !0, maxTemplatesPerItem: 5 },
    },
    'color-focused': {
        id: 'color-focused',
        name: 'Color Focused',
        description: 'Emphasizes color matching for similar-shaped items',
        weight: 0.85,
        preprocessing: { contrastEnhance: !1, contrastFactor: 1, colorNormalize: !1, edgeEnhance: !1 },
        metricWeights: { ssim: 0.2, ncc: 0.2, histogram: 0.45, edge: 0.15 },
        templates: { useRanking: !0, skipPoorPerformers: !0, maxTemplatesPerItem: 5 },
    },
    fast: {
        id: 'fast',
        name: 'Fast',
        description: 'Quick detection with minimal processing',
        weight: 0.7,
        minConfidence: 0.5,
        preprocessing: { contrastEnhance: !1, contrastFactor: 1, colorNormalize: !1, edgeEnhance: !1 },
        metricWeights: { ssim: 0.5, ncc: 0.5, histogram: 0, edge: 0 },
        templates: { useRanking: !0, skipPoorPerformers: !0, maxTemplatesPerItem: 2 },
    },
};
let Om = {
    strategies: ['default', 'high-precision', 'edge-focused'],
    minAgreement: 2,
    combineMethod: 'voting',
    earlyExitThreshold: 0.9,
    parallel: !0,
};
function Rm(e) {
    return Fm[e];
}
function Pm(e, t, n) {
    const a = qh(0, t),
        i = ['default'];
    switch (
        (('high' !== a.tier && 'ultra' !== a.tier) || i.push('high-precision'),
        'low' === a.tier && i.push('high-recall'),
        n)
    ) {
        case 'dark':
        case 'noisy':
            i.push('edge-focused');
            break;
        case 'bright':
            i.push('color-focused');
    }
    return i.slice(0, 3);
}
const Nm = 0.6,
    Bm = 3,
    jm = 2;
let qm = {};
function Hm(e, t = Nm) {
    const n = [];
    for (const a of e)
        if (a.confidence < t) {
            const e = Zm(a, Bm);
            n.push({ detection: a, alternatives: e, cropDataUrl: a.cropDataUrl });
        }
    return (n.sort((e, t) => e.detection.confidence - t.detection.confidence), n);
}
function Zm(e, t) {
    return (qm.items?.items || [])
        .filter(t => t.id !== e.detectedItemId)
        .map(t => ({ item: t, score: Um(e, t) }))
        .filter(({ score: e }) => e > 0.3)
        .sort((e, t) => t.score - e.score)
        .slice(0, t)
        .map(({ item: e }) => e);
}
function Um(e, t) {
    let n = 0;
    const a = e.detectedItemName.toLowerCase(),
        i = t.name.toLowerCase(),
        o = a.split(/\s+/),
        r = i.split(/\s+/);
    ((n += 0.2 * o.filter(e => r.includes(e)).length), a[0] === i[0] && (n += 0.1));
    return (Math.abs(a.length - i.length) <= 3 && (n += 0.1), Math.min(1, n));
}
const Vm = [
    {
        digit: 1,
        pattern: [
            [0, 0, 1, 0, 0],
            [0, 1, 1, 0, 0],
            [0, 0, 1, 0, 0],
            [0, 0, 1, 0, 0],
            [0, 0, 1, 0, 0],
            [0, 0, 1, 0, 0],
            [0, 1, 1, 1, 0],
        ],
    },
    {
        digit: 2,
        pattern: [
            [0, 1, 1, 1, 0],
            [1, 0, 0, 0, 1],
            [0, 0, 0, 0, 1],
            [0, 0, 1, 1, 0],
            [0, 1, 0, 0, 0],
            [1, 0, 0, 0, 0],
            [1, 1, 1, 1, 1],
        ],
    },
    {
        digit: 3,
        pattern: [
            [0, 1, 1, 1, 0],
            [1, 0, 0, 0, 1],
            [0, 0, 0, 0, 1],
            [0, 0, 1, 1, 0],
            [0, 0, 0, 0, 1],
            [1, 0, 0, 0, 1],
            [0, 1, 1, 1, 0],
        ],
    },
    {
        digit: 4,
        pattern: [
            [0, 0, 0, 1, 0],
            [0, 0, 1, 1, 0],
            [0, 1, 0, 1, 0],
            [1, 0, 0, 1, 0],
            [1, 1, 1, 1, 1],
            [0, 0, 0, 1, 0],
            [0, 0, 0, 1, 0],
        ],
    },
    {
        digit: 5,
        pattern: [
            [1, 1, 1, 1, 1],
            [1, 0, 0, 0, 0],
            [1, 1, 1, 1, 0],
            [0, 0, 0, 0, 1],
            [0, 0, 0, 0, 1],
            [1, 0, 0, 0, 1],
            [0, 1, 1, 1, 0],
        ],
    },
    {
        digit: 6,
        pattern: [
            [0, 0, 1, 1, 0],
            [0, 1, 0, 0, 0],
            [1, 0, 0, 0, 0],
            [1, 1, 1, 1, 0],
            [1, 0, 0, 0, 1],
            [1, 0, 0, 0, 1],
            [0, 1, 1, 1, 0],
        ],
    },
    {
        digit: 7,
        pattern: [
            [1, 1, 1, 1, 1],
            [0, 0, 0, 0, 1],
            [0, 0, 0, 1, 0],
            [0, 0, 1, 0, 0],
            [0, 1, 0, 0, 0],
            [0, 1, 0, 0, 0],
            [0, 1, 0, 0, 0],
        ],
    },
    {
        digit: 8,
        pattern: [
            [0, 1, 1, 1, 0],
            [1, 0, 0, 0, 1],
            [1, 0, 0, 0, 1],
            [0, 1, 1, 1, 0],
            [1, 0, 0, 0, 1],
            [1, 0, 0, 0, 1],
            [0, 1, 1, 1, 0],
        ],
    },
    {
        digit: 9,
        pattern: [
            [0, 1, 1, 1, 0],
            [1, 0, 0, 0, 1],
            [1, 0, 0, 0, 1],
            [0, 1, 1, 1, 1],
            [0, 0, 0, 0, 1],
            [0, 0, 0, 1, 0],
            [0, 1, 1, 0, 0],
        ],
    },
    {
        digit: 0,
        pattern: [
            [0, 1, 1, 1, 0],
            [1, 0, 0, 0, 1],
            [1, 0, 0, 0, 1],
            [1, 0, 0, 0, 1],
            [1, 0, 0, 0, 1],
            [1, 0, 0, 0, 1],
            [0, 1, 1, 1, 0],
        ],
    },
];
function Wm(e, t) {
    const n = t.length,
        a = t[0]?.length ?? 0,
        i = (function (e, t, n) {
            const a = e.length,
                i = e[0]?.length ?? 0;
            if (0 === i || 0 === a)
                return Array(n)
                    .fill(null)
                    .map(() => Array(t).fill(!1));
            const o = [];
            for (let r = 0; r < n; r++) {
                const s = [],
                    c = Math.floor((r * a) / n);
                for (let n = 0; n < t; n++) {
                    const a = Math.floor((n * i) / t);
                    s.push(e[c]?.[a] ?? !1);
                }
                o.push(s);
            }
            return o;
        })(e, a, n);
    let o = 0,
        r = 0;
    for (let s = 0; s < n; s++)
        for (let e = 0; e < a; e++) {
            ((1 === (t[s]?.[e] ?? 0)) === (i[s]?.[e] ?? !1) && o++, r++);
        }
    return o / r;
}
function Jm(e, t, n, a, i) {
    const o = [];
    for (let r = 0; r < i; r++) {
        const i = [];
        for (let o = 0; o < a; o++) i.push(e[n + r]?.[t + o] ?? !1);
        o.push(i);
    }
    return o;
}
function Km(e) {
    let t = -1,
        n = 0;
    for (const { digit: a, pattern: i } of Vm) {
        const o = Wm(e, i);
        o > n && ((n = o), (t = a));
    }
    return n < 0.5 ? null : { digit: t, confidence: n };
}
function Gm(e) {
    const t = e.length,
        n = e[0]?.length ?? 0;
    if (n < 5 || t < 5) return !1;
    let a = 0;
    const i = Math.floor(t / 2),
        o = Math.floor(n / 2);
    for (let r = -2; r <= 2; r++) {
        const s = i + r,
            c = o + r;
        s >= 0 && s < t && c >= 0 && c < n && e[s]?.[c] && a++;
    }
    for (let r = -2; r <= 2; r++) {
        const s = i + r,
            c = o - r;
        s >= 0 && s < t && c >= 0 && c < n && e[s]?.[c] && a++;
    }
    return a >= 6;
}
function Ym(e, t, n, a, i, o = 1080) {
    const r = Hh(t, n, a, i, o),
        s = {
            x: Math.max(0, Math.min(r.x, e.width - 1)),
            y: Math.max(0, Math.min(r.y, e.height - 1)),
            width: Math.min(r.width, e.width - r.x),
            height: Math.min(r.height, e.height - r.y),
        };
    if (s.width < 3 || s.height < 3) return { count: 1, confidence: 0, rawText: '', region: s, method: 'none' };
    const c = (function (e, t, n, a, i) {
            const o = new Uint8ClampedArray(a * i * 4);
            for (let r = 0; r < i; r++)
                for (let i = 0; i < a; i++) {
                    const s = t + i,
                        c = n + r;
                    if (s >= 0 && s < e.width && c >= 0 && c < e.height) {
                        const t = 4 * (c * e.width + s),
                            n = 4 * (r * a + i);
                        ((o[n] = e.data[t] ?? 0),
                            (o[n + 1] = e.data[t + 1] ?? 0),
                            (o[n + 2] = e.data[t + 2] ?? 0),
                            (o[n + 3] = e.data[t + 3] ?? 255));
                    }
                }
            return { data: o, width: a, height: i };
        })(e, s.x, s.y, s.width, s.height),
        l = (function (e) {
            const t = [];
            for (let n = 0; n < e.height; n++) {
                const a = [];
                for (let t = 0; t < e.width; t++) {
                    const i = 4 * (n * e.width + t),
                        o = e.data[i] ?? 0,
                        r = e.data[i + 1] ?? 0,
                        s = e.data[i + 2] ?? 0,
                        c = o > 200 && r > 200 && s > 200,
                        l = o > 200 && r > 180 && s < 100,
                        d = (o + r + s) / 3 > 180;
                    a.push(c || l || d);
                }
                t.push(a);
            }
            return t;
        })(c),
        d = (function (e) {
            const t = e.length,
                n = e[0]?.length ?? 0,
                a = Array(t)
                    .fill(null)
                    .map(() => Array(n).fill(!1)),
                i = [];
            for (let o = 0; o < t; o++)
                for (let r = 0; r < n; r++)
                    if (e[o]?.[r] && !a[o]?.[r]) {
                        let s = r,
                            c = r,
                            l = o,
                            d = o;
                        const u = [[r, o]],
                            h = a[o];
                        for (h && (h[r] = !0); u.length > 0; ) {
                            const i = u.shift(),
                                o = i[0],
                                r = i[1];
                            ((s = Math.min(s, o)), (c = Math.max(c, o)), (l = Math.min(l, r)), (d = Math.max(d, r)));
                            const h = [
                                [-1, 0],
                                [1, 0],
                                [0, -1],
                                [0, 1],
                            ];
                            for (const s of h) {
                                const i = o + s[0],
                                    c = r + s[1];
                                i >= 0 &&
                                    i < n &&
                                    c >= 0 &&
                                    c < t &&
                                    e[c]?.[i] &&
                                    !a[c]?.[i] &&
                                    (a[c] && (a[c][i] = !0), u.push([i, c]));
                            }
                        }
                        const m = c - s + 1,
                            p = d - l + 1;
                        m >= 3 && p >= 5 && m <= n / 2 && i.push({ x: s, y: l, width: m, height: p });
                    }
            return (i.sort((e, t) => e.x - t.x), i);
        })(l);
    if (0 === d.length) return { count: 1, confidence: 0, rawText: '', region: s, method: 'none' };
    let u = [],
        h = 0,
        m = !1;
    for (const f of d) {
        const e = Jm(l, f.x, f.y, f.width, f.height);
        if (!m && Gm(e)) {
            m = !0;
            continue;
        }
        const t = Km(e);
        t && (u.push(t.digit), (h += t.confidence));
    }
    if (0 === u.length) return { count: 1, confidence: 0, rawText: m ? 'x?' : '', region: s, method: 'none' };
    let p = 0;
    for (const f of u) p = 10 * p + f;
    (p < 1 || p > 99) && ((p = 1), (h = 0));
    return { count: p, confidence: h / u.length, rawText: (m ? 'x' : '') + u.join(''), region: s, method: 'pattern' };
}
function Xm(e, t, n, a, i, o = 1080) {
    const r = Hh(t, n, a, i, o);
    let s = 0;
    for (let c = r.y; c < r.y + r.height && c < e.height; c++)
        for (let t = r.x; t < r.x + r.width && t < e.width; t++) {
            const n = 4 * (c * e.width + t),
                a = e.data[n] ?? 0,
                i = e.data[n + 1] ?? 0,
                o = e.data[n + 2] ?? 0;
            a > 200 && i > 200 && o > 200 && s++;
        }
    return s / (r.width * r.height) > 0.1;
}
async function Qm(e, t, n = !1) {
    if (Uh)
        return (
            zi.warn({
                operation: 'cv.detect_concurrent_rejected',
                data: { message: 'CV detection already in progress' },
            }),
            []
        );
    Vh(!0);
    const a = Lm(),
        i = performance.now();
    try {
        const r = (function (e) {
                const t = e.length;
                let n = 5381,
                    a = 0;
                const i = Math.min(500, t),
                    o = Math.max(1, Math.floor(t / i));
                for (let r = 0; r < t; r += o) n = (((n << 5) + n) ^ e.charCodeAt(r)) >>> 0;
                for (let r = Math.max(0, t - 1e3); r < t; r += 10) a = ((a << 5) + a + e.charCodeAt(r)) >>> 0;
                return `img_${(n >>> 0).toString(16)}_${(a >>> 0).toString(16)}_${t}`;
            })(e),
            s = (function (e) {
                const t = Ju(),
                    n = t.get(e);
                return n ? (Date.now() - n.timestamp > ju ? (t.delete(e), null) : n.results) : null;
            })(r);
        if (s)
            return (
                zi.info({ operation: 'cv.cache_hit', data: { imageHash: r, resultCount: s.length } }),
                t && t(100, 'Loaded from cache (instant)'),
                s
            );
        (t && t(0, 'Loading image...'), Fu || (t && t(5, 'Loading item templates...'), await Oh()));
        const { ctx: c, width: l, height: d } = await Tm(e),
            u = nm(l, d);
        a.startRun(l, d, u.category);
        const h = Pm(0, d),
            m = jh(0, d);
        (zi.info({
            operation: 'cv.strategy_selection',
            data: { resolutionTier: m, selectedStrategies: h, dynamicThreshold: Wh(l, d) },
        }),
            t && t(15, 'Analyzing image structure...'));
        const p = Hu().items?.items || [],
            f = Zu();
        if (
            (zi.info({
                operation: 'cv.detect_start',
                data: { imageWidth: l, imageHeight: d, templatesLoaded: f.size, mode: 'sliding_window' },
            }),
            n)
        ) {
            const e = rm(l, d);
            zi.info({ operation: 'cv.detect_items_workers', data: { gridPositions: e.length, workers: 4 } });
            const n = await (async function (e, t, n, a) {
                const i = Zu(),
                    o = [];
                try {
                    for (let e = 0; e < 4; e++) o.push(new Worker(Zh('template-matcher-worker.js')));
                    const r = n
                            .map(e => {
                                const t = i.get(e.id);
                                if (!t) return null;
                                const n = t.ctx.getImageData(0, 0, t.width, t.height);
                                return {
                                    itemId: e.id,
                                    itemName: e.name,
                                    imageData: { width: n.width, height: n.height, data: Array.from(n.data) },
                                };
                            })
                            .filter(e => null !== e),
                        s = Math.ceil(t.length / 4),
                        c = [];
                    for (let e = 0; e < t.length; e += s) c.push(t.slice(e, e + s));
                    const l = c.map(
                        (t, n) =>
                            new Promise(a => {
                                const i = o[n % 4],
                                    s = t.map((t, n) => {
                                        const a = Yh(e, t);
                                        return {
                                            index: n,
                                            position: t,
                                            imageData: { width: a.width, height: a.height, data: Array.from(a.data) },
                                        };
                                    }),
                                    c = e => {
                                        'BATCH_COMPLETE' === e.data.type &&
                                            e.data.data.batchId === n &&
                                            (i?.removeEventListener('message', c), a(e.data.data.results));
                                    };
                                (i?.addEventListener('message', c),
                                    i?.postMessage({
                                        type: 'MATCH_BATCH',
                                        data: { batchId: n, cells: s, templates: r },
                                    }));
                            })
                    );
                    a && a(60, 'Processing with workers...');
                    return (await Promise.all(l))
                        .flat()
                        .map(e => {
                            const t = n.find(t => t.id === e.itemId);
                            return t
                                ? {
                                      type: 'item',
                                      entity: t,
                                      confidence: e.similarity,
                                      position: e.position,
                                      method: 'template_match',
                                  }
                                : null;
                        })
                        .filter(e => null !== e);
                } finally {
                    o.forEach(e => e.terminate());
                }
            })(c, e, p, t);
            return (
                t && t(100, 'Worker processing complete'),
                zi.info({
                    operation: 'cv.detect_items_workers_complete',
                    data: { detectionsCount: n.length, gridPositions: e.length },
                }),
                Am(r, n),
                n
            );
        }
        t && t(18, 'Attempting two-phase grid detection...');
        const g = await zm(c, l, d, p, { minConfidence: Wh(l, d), progressCallback: t });
        let y;
        if (g.gridUsed && g.detections.length > 0)
            ((y = g.detections),
                zi.info({
                    operation: 'cv.two_phase_success',
                    data: { detections: y.length, gridColumns: g.grid?.columns || 0, gridRows: g.grid?.rows || 0 },
                }));
        else {
            (zi.info({
                operation: 'cv.two_phase_fallback',
                data: { reason: g.gridUsed ? 'no_detections' : 'grid_detection_failed' },
            }),
                t && t(25, 'Falling back to sliding window...'));
            const e = Qh(c, l, d),
                n = {
                    x: 0,
                    y: e.confidence > 0.3 ? e.topY : Math.floor(0.8 * d),
                    width: l,
                    height: e.confidence > 0.3 ? e.bottomY - e.topY : Math.floor(0.2 * d),
                    label: 'hotbar_region',
                };
            (zi.info({ operation: 'cv.hotbar_detection', data: { detected: e, usingROI: n } }),
                (y = await Dm(c, l, d, p, {
                    stepSize: 10,
                    minConfidence: Wh(l, d),
                    regionOfInterest: n,
                    progressCallback: t,
                })));
        }
        const v = await (async function (e, t, n, a, i) {
                const o = {
                    x: 0,
                    y: 0,
                    width: Math.floor(0.25 * t),
                    height: Math.floor(0.4 * n),
                    label: 'equipment_region',
                };
                return (
                    i && i(85, 'Scanning equipment region...'),
                    zi.info({ operation: 'cv.equipment_region_scan', data: { region: o } }),
                    await Dm(e, t, n, a, { stepSize: 8, minConfidence: Wh(t, n), regionOfInterest: o })
                );
            })(c, l, d, p, t),
            b = [...y, ...v];
        t && t(88, 'Verifying grid pattern...');
        const w = om(l, d),
            _ = lm(b, w[1] || 48);
        let k = _.isValid ? _.filteredDetections : b;
        (a.recordGridVerification(b.length, k.length), t && t(92, 'Applying context boosting...'));
        let x = (o = k).map(e => {
            let t = 0;
            const n = e.entity;
            'common' === n.rarity
                ? (t += 0.03)
                : 'uncommon' === n.rarity
                  ? (t += 0.02)
                  : 'legendary' === n.rarity && (t -= 0.02);
            const a = o.map(e => e.entity.name.toLowerCase()),
                i =
                    {
                        wrench: ['scrap', 'metal', 'gear'],
                        battery: ['tesla', 'electric', 'shock'],
                        'gym sauce': ['protein', 'fitness', 'muscle'],
                        medkit: ['bandage', 'health', 'healing'],
                    }[n.name.toLowerCase()] || [];
            for (const o of i)
                if (a.some(e => e.includes(o))) {
                    t += 0.03;
                    break;
                }
            const r = Math.min(0.99, Math.max(0, e.confidence + t));
            return { ...e, confidence: r };
        });
        t && t(96, 'Validating with border rarity...');
        const E = performance.now();
        ((x = x
            .map(e => {
                const t = (function (e, t, n = !1) {
                    if (!e.position) return e;
                    const a = e.entity,
                        i = e.position,
                        o = t.canvas.width,
                        r = t.canvas.height;
                    if (i.x < 0 || i.y < 0 || i.x + i.width > o || i.y + i.height > r) return e;
                    const s = Ih(t.getImageData(i.x, i.y, i.width, i.height));
                    return s
                        ? s === a.rarity
                            ? { ...e, confidence: Math.min(0.99, 1.08 * e.confidence) }
                            : n && 'common' !== a.rarity && 'common' !== s
                              ? (zi.info({
                                    operation: 'cv.rarity_validation.rejected',
                                    data: { item: a.name, expectedRarity: a.rarity, detectedRarity: s },
                                }),
                                null)
                              : { ...e, confidence: 0.75 * e.confidence }
                        : { ...e, confidence: 0.98 * e.confidence };
                })(e, c, !1);
                return (
                    null === t
                        ? a.recordRarityValidation(!1, !0)
                        : t.confidence > e.confidence
                          ? a.recordRarityValidation(!0, !1)
                          : a.recordRarityValidation(!1, !1),
                    t
                );
            })
            .filter(e => null !== e)),
            a.recordValidationTime(performance.now() - E),
            t && t(98, 'Detecting item counts...'));
        const S = c.getImageData(0, 0, l, d);
        for (const e of x)
            if (e.position) {
                const { x: t, y: n, width: a, height: i } = e.position;
                if (Xm(S, t, n, a, i, d)) {
                    const o = Ym(S, t, n, a, i, d);
                    o.count > 1 && o.confidence > 0.5 && ((e.stackCount = o.count), (e.countConfidence = o.confidence));
                }
            }
        t && t(100, 'Smart detection complete');
        const C = {
            detectionsCount: x.length,
            hotbarDetections: y.length,
            equipmentDetections: v.length,
            mode: g.gridUsed ? 'two_phase_grid' : 'sliding_window',
            gridUsed: g.gridUsed,
        };
        (0 === x.length
            ? ((C.debugHint = 'No icons detected - ensure screenshot shows game UI with item icons'),
              (C.suggestion = 'Try taking screenshot during gameplay with hotbar visible'))
            : (C.detectedItems = x.slice(0, 5).map(e => e.entity.name)),
            zi.info({ operation: 'cv.detect_items_smart', data: C }),
            Am(r, x));
        const $ = x
                .filter(e => e.position)
                .map(e => ({
                    detectedItemId: e.entity.id,
                    detectedItemName: e.entity.name,
                    confidence: e.confidence,
                    x: e.position.x,
                    y: e.position.y,
                    width: e.position.width,
                    height: e.position.height,
                })),
            M = Hm($);
        return (
            M.length > 0 &&
                (function (e) {
                    return Hm(e).length >= jm;
                })($) &&
                zi.info({
                    operation: 'cv.active_learning.uncertain_found',
                    data: {
                        uncertainCount: M.length,
                        totalDetections: x.length,
                        topUncertain: M.slice(0, 3).map(e => ({
                            item: e.detection.detectedItemName,
                            confidence: e.detection.confidence.toFixed(2),
                            alternatives: e.alternatives.length,
                        })),
                    },
                }),
            a.endRun(performance.now() - i),
            x
        );
    } catch (r) {
        throw (
            zi.error({ operation: 'cv.detect_items', error: { name: r.name, message: r.message } }),
            a.endRun(performance.now() - i),
            r
        );
    } finally {
        Vh(!1);
    }
    var o;
}
function ep(e, t, n) {
    const a = Math.floor(0.8 * n),
        i = n - a,
        o = e.getImageData(0, a, t, i).data;
    let r = 0,
        s = 0,
        c = 0;
    for (let h = 0; h < o.length; h += 40) {
        const e = o[h] ?? 0,
            t = o[h + 1] ?? 0,
            n = o[h + 2] ?? 0;
        if ((o[h + 3] ?? 0) < 128) continue;
        const a = (e + t + n) / 3;
        r += a;
        const i = a;
        ((s += Math.pow(e - i, 2) + Math.pow(t - i, 2) + Math.pow(n - i, 2)), c++);
    }
    if (0 === c) return 'pause_menu';
    const l = r / c,
        d = s / c,
        u = l > 70 && d > 900;
    return (
        zi.info({
            operation: 'cv.detect_screen_type',
            data: {
                avgBrightness: Math.round(l),
                avgVariance: Math.round(d),
                sampleCount: c,
                screenType: u ? 'gameplay' : 'pause_menu',
            },
        }),
        u ? 'gameplay' : 'pause_menu'
    );
}
function tp() {
    'serviceWorker' in navigator &&
        navigator.serviceWorker.ready
            .then(e => {
                window.setInterval(() => {
                    e.update();
                }, 36e5);
                let t = !1;
                e.addEventListener('updatefound', () => {
                    const n = e.installing;
                    if (!n) return;
                    const a = () => {
                        'installed' === n.state &&
                            navigator.serviceWorker.controller &&
                            (t ||
                                ((t = !0),
                                (function (e) {
                                    const t = document.createElement('div');
                                    ((t.className = 'update-notification'),
                                        (t.innerHTML =
                                            '\n        <div class="update-content">\n            <span class="update-icon">🎉</span>\n            <div class="update-message">\n                <strong>Update Available!</strong>\n                <p>A new version of MegaBonk Guide is ready.</p>\n            </div>\n            <button class="update-btn" id="update-reload-btn">\n                Reload Now\n            </button>\n            <button class="update-dismiss-btn" id="update-dismiss-btn">\n                Later\n            </button>\n        </div>\n    '),
                                        document.body.appendChild(t));
                                    const n = () => {
                                            t.remove();
                                        },
                                        a = document.getElementById('update-reload-btn');
                                    if (a) {
                                        const t = () => {
                                            e.waiting && e.waiting.postMessage({ type: 'SKIP_WAITING' });
                                            const t = () => {
                                                window.location.reload();
                                            };
                                            navigator.serviceWorker.addEventListener('controllerchange', t, {
                                                once: !0,
                                            });
                                        };
                                        a.addEventListener('click', t, { once: !0 });
                                    }
                                    const i = document.getElementById('update-dismiss-btn');
                                    i && i.addEventListener('click', n, { once: !0 });
                                })(e),
                                n.removeEventListener('statechange', a)));
                    };
                    n.addEventListener('statechange', a);
                });
            })
            .catch(e => {
                zi.warn({
                    operation: 'app.update',
                    error: { name: e.name, message: e.message, module: 'service-worker' },
                    data: { reason: 'service_worker_not_available' },
                });
            });
}
('undefined' != typeof window &&
    ((window.initCV = yh),
    (window.detectItemsWithCV = Qm),
    (window.detectGridPositions = rm),
    (window.detectItemCounts = async function (e, t) {
        const a = await n(() => import('./index-B231jng3.js').then(e => e.i), []),
            i = new Map(),
            { canvas: o } = await Tm(e);
        for (const n of t)
            try {
                const e = Xh(n),
                    t = document.createElement('canvas');
                ((t.width = e.width),
                    (t.height = e.height),
                    t
                        .getContext('2d', { willReadFrequently: !0 })
                        .drawImage(o, e.x, e.y, e.width, e.height, 0, 0, e.width, e.height));
                const r = (await a.recognize(t.toDataURL(), 'eng')).data.text.trim().match(/[x×]?(\d+)/);
                if (r && r[1]) {
                    const e = parseInt(r[1], 10);
                    !isNaN(e) && e > 1 && e <= 20 && i.set(n.label || '', e);
                }
            } catch (r) {
                zi.error({ operation: 'cv.detect_count', error: { name: r.name, message: r.message } });
            }
        return i;
    }),
    (window.loadImageToCanvas = Tm),
    (window.calculateSimilarity = Sm),
    (window.calculateIoU = Jh),
    (window.nonMaxSuppression = Kh),
    (window.getAdaptiveIconSizes = om),
    (window.extractCountRegion = Xh),
    (window.detectHotbarRegion = Qh),
    (window.detectIconEdges = em),
    (window.detectIconScale = function (e, t, n) {
        const a = Qh(e, t, n);
        if (a.confidence < 0.3) return { iconSize: om(t, n)[1] || 48, confidence: 0.5, method: 'resolution_fallback' };
        const i = em(e, t, a);
        if (i.length < 2) return { iconSize: om(t, n)[1] || 48, confidence: 0.4, method: 'resolution_fallback' };
        const o = [];
        for (let u = 1; u < i.length; u++) {
            const e = i[u],
                t = i[u - 1];
            if (void 0 === e || void 0 === t) continue;
            const n = e - t;
            n >= 25 && n <= 100 && o.push(n);
        }
        if (o.length < 2) return { iconSize: om(t, n)[1] || 48, confidence: 0.4, method: 'resolution_fallback' };
        const r = new Map();
        for (const u of o) {
            const e = 4 * Math.round(u / 4);
            r.set(e, (r.get(e) || 0) + 1);
        }
        let s = 0,
            c = 0;
        for (const [u, h] of r) h > c && ((c = h), (s = u));
        const l = o.filter(e => Math.abs(e - s) <= 4).length,
            d = Math.min(0.95, l / o.length);
        return (
            zi.info({
                operation: 'cv.scale_detection',
                data: { edgesFound: i.length, spacings: o.length, detectedSize: s, confidence: d },
            }),
            { iconSize: s, confidence: d, method: 'edge_analysis' }
        );
    }),
    (window.resizeImageData = Gh),
    (window.fitsGrid = function (e, t, n, a) {
        if (n <= 0) return !0;
        const i = (e - t) % n;
        return i <= a || i >= n - a;
    }),
    (window.verifyGridPattern = lm),
    (window.runEnsembleDetection = async function (e, t, n, a, i, o) {
        const r = Pm(0, n),
            s = Om,
            c = [];
        for (const l of r) {
            const a = Rm(l),
                o = a.minConfidence ?? Wh(t, n),
                r = Zu();
            let d = null;
            for (const [t, n] of r) {
                if (a.templates.skipPoorPerformers && bm(`${t}_primary`)) continue;
                const r = Cm(e, i, n, t);
                r > o && (!d || r > d.confidence) && (d = { itemId: t, confidence: r, templateId: `${t}_primary` });
            }
            if (
                d &&
                (c.push({
                    strategyId: l,
                    itemId: d.itemId,
                    confidence: d.confidence * a.weight,
                    position: { x: i.x, y: i.y, width: i.width, height: i.height },
                    templateId: d.templateId,
                }),
                d.confidence >= s.earlyExitThreshold)
            )
                break;
        }
        return 0 === c.length
            ? null
            : (function (e, t, n = Om) {
                  if (0 === e.length) return null;
                  const a = new Map();
                  for (const l of e) {
                      const e = a.get(l.itemId) ?? [];
                      (e.push(l), a.set(l.itemId, e));
                  }
                  let i = null,
                      o = 0,
                      r = [];
                  switch (n.combineMethod) {
                      case 'voting': {
                          const t = Em(
                              e.map(e => ({
                                  templateId: e.templateId,
                                  itemId: e.itemId,
                                  confidence: e.confidence * Fm[e.strategyId].weight,
                              }))
                          );
                          t && ((i = t.itemId), (o = t.confidence), (r = a.get(t.itemId) ?? []));
                          break;
                      }
                      case 'max':
                          for (const [e, t] of a) {
                              const n = Math.max(...t.map(e => e.confidence));
                              n > o && ((o = n), (i = e), (r = t));
                          }
                          break;
                      case 'average':
                          for (const [e, t] of a) {
                              const n = t.reduce((e, t) => e + t.confidence, 0) / t.length;
                              n > o && ((o = n), (i = e), (r = t));
                          }
                          break;
                      case 'weighted':
                          for (const [e, t] of a) {
                              let n = 0,
                                  a = 0;
                              for (const e of t) {
                                  const t = Fm[e.strategyId].weight;
                                  ((a += e.confidence * t), (n += t));
                              }
                              const s = a / n;
                              s > o && ((o = s), (i = e), (r = t));
                          }
                  }
                  if (!i) return null;
                  const s = r.length / e.length;
                  r.length < n.minAgreement && (o *= s);
                  const c = r.reduce((e, t) => (t.confidence > e.confidence ? t : e));
                  return {
                      itemId: i,
                      confidence: Math.min(0.99, o),
                      position: t,
                      bestStrategy: c.strategyId,
                      strategyResults: e,
                      agreement: s,
                      passesThreshold: Nh(o),
                  };
              })(c, { x: i.x, y: i.y, width: i.width, height: i.height }, s);
    }),
    (window.getCVMetrics = function () {
        const e = Lm();
        return { runs: e.getRuns(), aggregated: e.getAggregatedMetrics(), enabled: e.isEnabled() };
    }),
    (window.getDetectionConfig = function (e, t) {
        const n = e && t ? jh(0, t) : 'medium',
            a = e && t ? Pm(0, t) : ['default'];
        return { dynamicThreshold: Wh(e, t), resolutionTier: n, selectedStrategies: a, scoringConfig: Rh };
    }),
    (window.extractDominantColors = function (e, t = 5) {
        const n = e.data,
            a = new Map();
        for (let i = 0; i < n.length; i += 16) {
            const e = `${32 * Math.floor((n[i] ?? 0) / 32)},${32 * Math.floor((n[i + 1] ?? 0) / 32)},${32 * Math.floor((n[i + 2] ?? 0) / 32)}`;
            a.set(e, (a.get(e) || 0) + 1);
        }
        return Array.from(a.entries())
            .sort((e, t) => t[1] - e[1])
            .slice(0, t)
            .map(([e, t]) => {
                const n = e.split(',').map(Number);
                return { r: n[0] ?? 0, g: n[1] ?? 0, b: n[2] ?? 0, frequency: t };
            });
    }),
    (window.getDominantColor = Ch),
    (window.calculateColorVariance = Eh),
    (window.isEmptyCell = Ah),
    (window.detectBorderRarity = Ih),
    (window.detectUIRegions = function (e, t, n) {
        let a,
            i,
            o = null;
        'number' == typeof e ? ((a = e), (i = t)) : ((o = e), (a = t), (i = n));
        const r = nm(a, i),
            s = am(a, i),
            c = o ? ep(o, a, i) : 'pause_menu';
        return (
            zi.info({
                operation: 'cv.detect_ui_regions',
                data: {
                    width: a,
                    height: i,
                    uiLayout: s,
                    resolution: r.category,
                    screenType: c,
                    hasContext: null !== o,
                },
            }),
            'pause_menu' === c
                ? (function (e, t, n) {
                      return 'steam_deck' === n
                          ? {
                                pauseMenu: {
                                    x: Math.floor(0.15 * e),
                                    y: Math.floor(0.15 * t),
                                    width: Math.floor(0.7 * e),
                                    height: Math.floor(0.7 * t),
                                    label: 'pause_menu',
                                },
                                stats: {
                                    x: Math.floor(0.2 * e),
                                    y: Math.floor(0.15 * t),
                                    width: Math.floor(0.6 * e),
                                    height: Math.floor(0.2 * t),
                                    label: 'stats',
                                },
                                inventory: {
                                    x: Math.floor(0.2 * e),
                                    y: Math.floor(0.4 * t),
                                    width: Math.floor(0.6 * e),
                                    height: Math.floor(0.45 * t),
                                    label: 'inventory',
                                },
                            }
                          : {
                                pauseMenu: {
                                    x: Math.floor(0.15 * e),
                                    y: Math.floor(0.1 * t),
                                    width: Math.floor(0.7 * e),
                                    height: Math.floor(0.8 * t),
                                    label: 'pause_menu',
                                },
                                stats: {
                                    x: Math.floor(0.25 * e),
                                    y: Math.floor(0.15 * t),
                                    width: Math.floor(0.5 * e),
                                    height: Math.floor(0.2 * t),
                                    label: 'stats',
                                },
                                inventory: {
                                    x: Math.floor(0.25 * e),
                                    y: Math.floor(0.4 * t),
                                    width: Math.floor(0.5 * e),
                                    height: Math.floor(0.5 * t),
                                    label: 'inventory',
                                },
                            };
                  })(a, i, s)
                : (function (e, t) {
                      return {
                          gameplay: { x: 0, y: 0, width: e, height: t, label: 'gameplay' },
                          stats: {
                              x: Math.floor(0.02 * e),
                              y: Math.floor(0.02 * t),
                              width: Math.floor(0.15 * e),
                              height: Math.floor(0.12 * t),
                              label: 'stats',
                          },
                          character: {
                              x: Math.floor(0.02 * e),
                              y: Math.floor(0.2 * t),
                              width: Math.floor(0.15 * e),
                              height: Math.floor(0.4 * t),
                              label: 'character',
                          },
                      };
                  })(a, i)
        );
    }),
    (window.detectScreenType = ep),
    (window.clearDetectionCache = function () {
        (Ju().clear(), zi.info({ operation: 'cv.cache_cleared', data: { cleared: !0 } }));
    })),
    document.addEventListener('DOMContentLoaded', async function () {
        const t = performance.now();
        (zi.info({ operation: 'app.init', data: { phase: 'start' } }),
            (window.onerror = (t, n, a, i, o) => {
                const r = o;
                zi.error({
                    operation: 'error.unhandled',
                    error: { name: r?.name || 'Error', message: String(t), stack: r?.stack, module: 'global' },
                    data: { source: n, line: a, column: i },
                });
                try {
                    e.error('Something went wrong. The error has been logged.');
                } catch {}
                return !1;
            }),
            window.addEventListener('unhandledrejection', t => {
                const n = t.reason;
                zi.error({
                    operation: 'error.promise',
                    error: {
                        name: n?.name || 'UnhandledRejection',
                        message: n?.message || String(n),
                        stack: n?.stack,
                        module: 'global',
                    },
                });
                try {
                    e.error('An error occurred. Please try again.');
                } catch {}
                t.preventDefault();
            }),
            await Ec(
                'theme-manager',
                async () => {
                    Lc.init();
                },
                { required: !1 }
            ),
            xc('dom-cache', () => {
                zi.warn({
                    operation: 'module.degraded',
                    data: { moduleName: 'dom-cache', fallback: 'direct_dom_queries' },
                });
            }),
            xc('data-service', () => {
                (zi.error({ operation: 'module.init.failed', data: { moduleName: 'data-service', critical: !0 } }),
                    e.error('Failed to load game data. Please refresh the page.'));
            }),
            await Ec(
                'offline-indicator',
                async () => {
                    ic();
                },
                { required: !1 }
            ),
            await Ec(
                'update-notification',
                async () => {
                    tp();
                },
                { required: !1 }
            ),
            await Ec(
                'dom-cache',
                async () => {
                    gc.init();
                },
                { required: !1, gracefulDegradation: !0 }
            ),
            await Ec(
                'image-fallback',
                async () => {
                    yo ||
                        ((yo = !0),
                        document.addEventListener(
                            'error',
                            e => {
                                const t = e.target;
                                t instanceof HTMLImageElement &&
                                    'true' === t.dataset.fallback &&
                                    (t.style.display = 'none');
                            },
                            !0
                        ));
                },
                { required: !1 }
            ),
            await Ec(
                'blur-up-images',
                async () => {
                    !(function () {
                        if (vo) return;
                        ((vo = !0),
                            document.querySelectorAll('img[data-blur-up="true"]').forEach(e => {
                                e instanceof HTMLImageElement &&
                                    e.complete &&
                                    e.naturalHeight > 0 &&
                                    e.classList.add('blur-up-loaded');
                            }),
                            document.addEventListener(
                                'load',
                                e => {
                                    const t = e.target;
                                    t instanceof HTMLImageElement &&
                                        'true' === t.dataset.blurUp &&
                                        requestAnimationFrame(() => {
                                            t.classList.add('blur-up-loaded');
                                        });
                                },
                                !0
                            ),
                            new MutationObserver(e => {
                                e.forEach(e => {
                                    e.addedNodes.forEach(e => {
                                        e instanceof HTMLElement &&
                                            (e instanceof HTMLImageElement &&
                                                'true' === e.dataset.blurUp &&
                                                e.complete &&
                                                e.naturalHeight > 0 &&
                                                e.classList.add('blur-up-loaded'),
                                            e.querySelectorAll?.('img[data-blur-up="true"]')?.forEach(e => {
                                                e instanceof HTMLImageElement &&
                                                    e.complete &&
                                                    e.naturalHeight > 0 &&
                                                    e.classList.add('blur-up-loaded');
                                            }));
                                    });
                                });
                            }).observe(document.body, { childList: !0, subtree: !0 }));
                    })();
                },
                { required: !1 }
            ),
            await Ec(
                'toast-manager',
                async () => {
                    e.init();
                },
                { required: !0 }
            ),
            await Ec(
                'favorites',
                async () => {
                    !(function () {
                        if (!Ro()) {
                            try {
                                e.warning('Favorites will not be saved in this browser mode.');
                            } catch {}
                            return !1;
                        }
                        try {
                            const e = localStorage.getItem(Fo);
                            if (e) {
                                const t = JSON.parse(e);
                                if ('object' == typeof t && null !== t) return (Lo('favorites', t), !0);
                            }
                            return !0;
                        } catch (t) {
                            try {
                                e.warning('Could not load saved favorites. Using fresh list.');
                            } catch {}
                            return !1;
                        }
                    })();
                },
                { required: !1 }
            ),
            await Ec(
                'event-system',
                async () => {
                    (Ys(), Xs());
                },
                { required: !0 }
            ),
            await Ec(
                'keyboard-shortcuts',
                async () => {
                    $c();
                },
                { required: !1 }
            ),
            await Ec(
                'data-service',
                async () => {
                    await uc();
                },
                { required: !0 }
            ),
            await Ec(
                'web-vitals',
                async () => {
                    (vl(),
                        setTimeout(() => {
                            const e = document.createElement('div');
                            ((e.id = 'perf-badge'),
                                (e.className = 'perf-badge'),
                                (e.style.cssText =
                                    '\n            position: fixed;\n            bottom: 1rem;\n            left: 1rem;\n            padding: 0.5rem 1rem;\n            background: var(--bg-elevated);\n            border: 1px solid var(--bg-subtle);\n            border-radius: 0.5rem;\n            font-size: 0.75rem;\n            color: var(--text-secondary);\n            cursor: pointer;\n            z-index: 998;\n            transition: all 0.3s;\n            opacity: 0.7;\n        '));
                            const t = Object.entries(fl).filter(([e, t]) => null !== t),
                                n = t.filter(([e, t]) => 'good' === t.rating).length,
                                a = t.length,
                                i = a > 0 ? Math.round((n / a) * 100) : 0,
                                o = i >= 80 ? '🚀' : i >= 60 ? '⚡' : '🐌';
                            ((e.textContent = `${o} Perf: ${i}%`),
                                (e.title = 'Click to view Web Vitals details'),
                                e.addEventListener('click', () => {
                                    bl();
                                }),
                                e.addEventListener('mouseenter', () => {
                                    e.style.opacity = '1';
                                }),
                                e.addEventListener('mouseleave', () => {
                                    e.style.opacity = '0.7';
                                }),
                                ('localhost' !== window.location.hostname &&
                                    '127.0.0.1' !== window.location.hostname) ||
                                    document.body.appendChild(e));
                        }, 3e3));
                },
                { required: !1 }
            ),
            await Ec(
                'mobile-nav',
                async () => {
                    !(function () {
                        const e = mo('.mobile-bottom-nav');
                        if (!e)
                            return void zi.warn({
                                operation: 'mobile-nav.init',
                                data: { reason: 'mobile_nav_not_found' },
                            });
                        e.addEventListener('click', Ll);
                        const t = e.querySelector('[data-tab="more"]');
                        (t && (t.setAttribute('aria-expanded', 'false'), t.setAttribute('aria-haspopup', 'dialog')),
                            zo('currentTab', e => {
                                Il(e);
                            }));
                        const n = Io('currentTab');
                        (n && Il(n), zi.info({ operation: 'mobile-nav.init', data: { status: 'initialized' } }));
                    })();
                },
                { required: !1 }
            ),
            await Ec(
                'mobile-filters',
                async () => {
                    Hl();
                },
                { required: !1 }
            ),
            await Ec(
                'recently-viewed',
                async () => {
                    Xr();
                },
                { required: !1 }
            ),
            await Ec(
                'debug-panel',
                async () => {
                    md();
                },
                { required: !1 }
            ),
            await Ec(
                'pull-refresh',
                async () => {
                    Cd();
                },
                { required: !1 }
            ),
            'undefined' != typeof requestIdleCallback ? requestIdleCallback(() => Nr()) : setTimeout(Nr, 2e3));
        const n = Math.round(performance.now() - t);
        zi.info({
            operation: 'app.ready',
            durationMs: n,
            data: {
                phase: 'complete',
                modulesLoaded: [
                    'theme-manager',
                    'offline-indicator',
                    'update-notification',
                    'dom-cache',
                    'image-fallback',
                    'blur-up-images',
                    'toast-manager',
                    'favorites',
                    'event-system',
                    'keyboard-shortcuts',
                    'data-service',
                    'web-vitals',
                    'mobile-nav',
                    'mobile-filters',
                    'recently-viewed',
                    'debug-panel',
                    'pull-refresh',
                ],
            },
        });
    }));
export {
    od as A,
    Xi as B,
    pd as C,
    Gi as D,
    fd as E,
    Gl as F,
    yd as G,
    rd as H,
    Ki as I,
    no as J,
    to as K,
    fc as L,
    Yi as M,
    e as T,
    n as _,
    ho as a,
    pc as b,
    Ds as c,
    Fs as d,
    So as e,
    mo as f,
    Io as g,
    po as h,
    Sr as i,
    fo as j,
    _o as k,
    zi as l,
    $o as m,
    hc as n,
    Mh as o,
    yh as p,
    Mu as q,
    Oh as r,
    Lo as s,
    th as t,
    nh as u,
    Au as v,
    vh as w,
    Qm as x,
    ao as y,
    Tm as z,
};
//# sourceMappingURL=main-Da4TIoXx.js.map
