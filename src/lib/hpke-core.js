/* esm.sh - esbuild bundle(@hpke/core@1.2.7) es2022 production */
// biome-ignore lint:
var ve = {},
  fe = Se(globalThis, ve);
function Se(i, e) {
  return new Proxy(i, {
    get(t, r, n) {
      return r in e ? e[r] : i[r];
    },
    set(t, r, n) {
      return r in e && delete e[r], (i[r] = n), !0;
    },
    deleteProperty(t, r) {
      let n = !1;
      return r in e && (delete e[r], (n = !0)), r in i && (delete i[r], (n = !0)), n;
    },
    ownKeys(t) {
      let r = Reflect.ownKeys(i),
        n = Reflect.ownKeys(e),
        a = new Set(n);
      return [...r.filter(s => !a.has(s)), ...n];
    },
    defineProperty(t, r, n) {
      return r in e && delete e[r], Reflect.defineProperty(i, r, n), !0;
    },
    getOwnPropertyDescriptor(t, r) {
      return r in e
        ? Reflect.getOwnPropertyDescriptor(e, r)
        : Reflect.getOwnPropertyDescriptor(i, r);
    },
    has(t, r) {
      return r in e || r in i;
    },
  });
}
var ee = class extends Error {
    constructor(e) {
      let t;
      e instanceof Error ? (t = e.message) : typeof e == 'string' ? (t = e) : (t = ''),
        super(t),
        (this.name = this.constructor.name);
    }
  },
  h = class extends ee {},
  l = class extends h {},
  de = class extends h {},
  P = class extends h {},
  g = class extends h {},
  D = class extends h {},
  N = class extends h {},
  T = class extends h {},
  C = class extends h {},
  M = class extends h {},
  R = class extends h {},
  B = class extends h {},
  p = class extends h {};
async function Ae() {
  if (fe !== void 0 && globalThis.crypto !== void 0) return globalThis.crypto.subtle;
  try {
    let { webcrypto: i } = await import(
      '/v135/crypto-browserify@3.12.0/es2022/crypto-browserify.mjs'
    );
    return i.subtle;
  } catch (i) {
    throw new p(i);
  }
}
var w = class {
  constructor() {
    Object.defineProperty(this, '_api', {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: void 0,
    });
  }
  async _setup() {
    this._api === void 0 && (this._api = await Ae());
  }
};
var x = { Base: 0, Psk: 1, Auth: 2, AuthPsk: 3 },
  Ee = {
    NotAssigned: 0,
    DhkemP256HkdfSha256: 16,
    DhkemP384HkdfSha384: 17,
    DhkemP521HkdfSha512: 18,
    DhkemSecp256k1HkdfSha256: 19,
    DhkemX25519HkdfSha256: 32,
    DhkemX448HkdfSha512: 33,
    HybridkemX25519Kyber768: 48,
  },
  f = Ee,
  Ie = { HkdfSha256: 1, HkdfSha384: 2, HkdfSha512: 3 },
  v = Ie,
  Le = { Aes128Gcm: 1, Aes256Gcm: 2, Chacha20Poly1305: 3, ExportOnly: 65535 },
  m = Le;
var ye = ['encrypt', 'decrypt'];
var te = class extends w {
    constructor(e) {
      super(),
        Object.defineProperty(this, '_rawKey', {
          enumerable: !0,
          configurable: !0,
          writable: !0,
          value: void 0,
        }),
        Object.defineProperty(this, '_key', {
          enumerable: !0,
          configurable: !0,
          writable: !0,
          value: void 0,
        }),
        (this._rawKey = e);
    }
    async seal(e, t, r) {
      await this._setupKey();
      let n = { name: 'AES-GCM', iv: e, additionalData: r };
      return await this._api.encrypt(n, this._key, t);
    }
    async open(e, t, r) {
      await this._setupKey();
      let n = { name: 'AES-GCM', iv: e, additionalData: r };
      return await this._api.decrypt(n, this._key, t);
    }
    async _setupKey() {
      if (this._key !== void 0) return;
      await this._setup();
      let e = await this._importKey(this._rawKey);
      new Uint8Array(this._rawKey).fill(0), (this._key = e);
    }
    async _importKey(e) {
      return await this._api.importKey('raw', e, { name: 'AES-GCM' }, !0, ye);
    }
  },
  G = class {
    constructor() {
      Object.defineProperty(this, 'id', {
        enumerable: !0,
        configurable: !0,
        writable: !0,
        value: m.Aes128Gcm,
      }),
        Object.defineProperty(this, 'keySize', {
          enumerable: !0,
          configurable: !0,
          writable: !0,
          value: 16,
        }),
        Object.defineProperty(this, 'nonceSize', {
          enumerable: !0,
          configurable: !0,
          writable: !0,
          value: 12,
        }),
        Object.defineProperty(this, 'tagSize', {
          enumerable: !0,
          configurable: !0,
          writable: !0,
          value: 16,
        });
    }
    createEncryptionContext(e) {
      return new te(e);
    }
  },
  re = class extends G {
    constructor() {
      super(...arguments),
        Object.defineProperty(this, 'id', {
          enumerable: !0,
          configurable: !0,
          writable: !0,
          value: m.Aes256Gcm,
        }),
        Object.defineProperty(this, 'keySize', {
          enumerable: !0,
          configurable: !0,
          writable: !0,
          value: 32,
        }),
        Object.defineProperty(this, 'nonceSize', {
          enumerable: !0,
          configurable: !0,
          writable: !0,
          value: 12,
        }),
        Object.defineProperty(this, 'tagSize', {
          enumerable: !0,
          configurable: !0,
          writable: !0,
          value: 16,
        });
    }
  };
var ie = class {
  constructor() {
    Object.defineProperty(this, 'id', {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: m.ExportOnly,
    }),
      Object.defineProperty(this, 'keySize', {
        enumerable: !0,
        configurable: !0,
        writable: !0,
        value: 0,
      }),
      Object.defineProperty(this, 'nonceSize', {
        enumerable: !0,
        configurable: !0,
        writable: !0,
        value: 0,
      }),
      Object.defineProperty(this, 'tagSize', {
        enumerable: !0,
        configurable: !0,
        writable: !0,
        value: 0,
      });
  }
  createEncryptionContext(e) {
    throw new p('Export only');
  }
};
var c = new Uint8Array(0);
function ne() {
  return new Promise((i, e) => {
    e(new p('Not supported'));
  });
}
var Ue = new Uint8Array([115, 101, 99]),
  S = class {
    constructor(e, t, r) {
      Object.defineProperty(this, '_api', {
        enumerable: !0,
        configurable: !0,
        writable: !0,
        value: void 0,
      }),
        Object.defineProperty(this, 'exporterSecret', {
          enumerable: !0,
          configurable: !0,
          writable: !0,
          value: void 0,
        }),
        Object.defineProperty(this, '_kdf', {
          enumerable: !0,
          configurable: !0,
          writable: !0,
          value: void 0,
        }),
        (this._api = e),
        (this._kdf = t),
        (this.exporterSecret = r);
    }
    async seal(e, t) {
      return await ne();
    }
    async open(e, t) {
      return await ne();
    }
    async export(e, t) {
      if (e.byteLength > 8192) throw new l('Too long exporter context');
      try {
        return await this._kdf.labeledExpand(this.exporterSecret, Ue, new Uint8Array(e), t);
      } catch (r) {
        throw new T(r);
      }
    }
  },
  F = class extends S {},
  q = class extends S {
    constructor(e, t, r, n) {
      super(e, t, r),
        Object.defineProperty(this, 'enc', {
          enumerable: !0,
          configurable: !0,
          writable: !0,
          value: void 0,
        }),
        (this.enc = n);
    }
  };
var K = i =>
  typeof i == 'object' &&
  i !== null &&
  typeof i.privateKey == 'object' &&
  typeof i.publicKey == 'object';
function _(i, e) {
  if (e <= 0) throw new Error('i2Osp: too small size');
  if (i >= 256 ** e) throw new Error('i2Osp: too large integer');
  let t = new Uint8Array(e);
  for (let r = 0; r < e && i; r++) (t[e - (r + 1)] = i % 256), (i = i >> 8);
  return t;
}
function z(i, e) {
  let t = new Uint8Array(i.length + e.length);
  return t.set(i, 0), t.set(e, i.length), t;
}
function be(i) {
  let e = i.replace(/-/g, '+').replace(/_/g, '/'),
    t = atob(e),
    r = new Uint8Array(t.length);
  for (let n = 0; n < t.length; n++) r[n] = t.charCodeAt(n);
  return r;
}
function Oe(i, e) {
  if (i.byteLength !== e.byteLength) throw new Error('xor: different length inputs');
  let t = new Uint8Array(i.byteLength);
  for (let r = 0; r < i.byteLength; r++) t[r] = i[r] ^ e[r];
  return t;
}
var A = class extends S {
  constructor(e, t, r) {
    if (
      (super(e, t, r.exporterSecret),
      Object.defineProperty(this, '_aead', {
        enumerable: !0,
        configurable: !0,
        writable: !0,
        value: void 0,
      }),
      Object.defineProperty(this, '_nK', {
        enumerable: !0,
        configurable: !0,
        writable: !0,
        value: void 0,
      }),
      Object.defineProperty(this, '_nN', {
        enumerable: !0,
        configurable: !0,
        writable: !0,
        value: void 0,
      }),
      Object.defineProperty(this, '_nT', {
        enumerable: !0,
        configurable: !0,
        writable: !0,
        value: void 0,
      }),
      Object.defineProperty(this, '_ctx', {
        enumerable: !0,
        configurable: !0,
        writable: !0,
        value: void 0,
      }),
      r.key === void 0 || r.baseNonce === void 0 || r.seq === void 0)
    )
      throw new Error('Required parameters are missing');
    (this._aead = r.aead),
      (this._nK = this._aead.keySize),
      (this._nN = this._aead.nonceSize),
      (this._nT = this._aead.tagSize);
    let n = this._aead.createEncryptionContext(r.key);
    this._ctx = { key: n, baseNonce: r.baseNonce, seq: r.seq };
  }
  computeNonce(e) {
    let t = _(e.seq, e.baseNonce.byteLength);
    return Oe(e.baseNonce, t);
  }
  incrementSeq(e) {
    if (e.seq > Number.MAX_SAFE_INTEGER) throw new R('Message limit reached');
    e.seq += 1;
  }
};
var Y = class extends A {
  async open(e, t = c) {
    let r;
    try {
      r = await this._ctx.key.open(this.computeNonce(this._ctx), e, t);
    } catch (n) {
      throw new M(n);
    }
    return this.incrementSeq(this._ctx), r;
  }
};
var X = class extends A {
  constructor(e, t, r, n) {
    super(e, t, r),
      Object.defineProperty(this, 'enc', {
        enumerable: !0,
        configurable: !0,
        writable: !0,
        value: void 0,
      }),
      (this.enc = n);
  }
  async seal(e, t = c) {
    let r;
    try {
      r = await this._ctx.key.seal(this.computeNonce(this._ctx), e, t);
    } catch (n) {
      throw new C(n);
    }
    return this.incrementSeq(this._ctx), r;
  }
};
var ze = new Uint8Array([98, 97, 115, 101, 95, 110, 111, 110, 99, 101]),
  He = new Uint8Array([101, 120, 112]),
  je = new Uint8Array([105, 110, 102, 111, 95, 104, 97, 115, 104]),
  De = new Uint8Array([107, 101, 121]),
  Ne = new Uint8Array([112, 115, 107, 95, 105, 100, 95, 104, 97, 115, 104]),
  Te = new Uint8Array([115, 101, 99, 114, 101, 116]),
  Ce = new Uint8Array([72, 80, 75, 69, 0, 0, 0, 0, 0, 0]),
  J = class extends w {
    constructor(e) {
      if (
        (super(),
        Object.defineProperty(this, '_kem', {
          enumerable: !0,
          configurable: !0,
          writable: !0,
          value: void 0,
        }),
        Object.defineProperty(this, '_kdf', {
          enumerable: !0,
          configurable: !0,
          writable: !0,
          value: void 0,
        }),
        Object.defineProperty(this, '_aead', {
          enumerable: !0,
          configurable: !0,
          writable: !0,
          value: void 0,
        }),
        Object.defineProperty(this, '_suiteId', {
          enumerable: !0,
          configurable: !0,
          writable: !0,
          value: void 0,
        }),
        typeof e.kem == 'number')
      )
        throw new l('KemId cannot be used');
      if (((this._kem = e.kem), typeof e.kdf == 'number')) throw new l('KdfId cannot be used');
      if (((this._kdf = e.kdf), typeof e.aead == 'number')) throw new l('AeadId cannot be used');
      (this._aead = e.aead),
        (this._suiteId = new Uint8Array(Ce)),
        this._suiteId.set(_(this._kem.id, 2), 4),
        this._suiteId.set(_(this._kdf.id, 2), 6),
        this._suiteId.set(_(this._aead.id, 2), 8),
        this._kdf.init(this._suiteId);
    }
    get kem() {
      return this._kem;
    }
    get kdf() {
      return this._kdf;
    }
    get aead() {
      return this._aead;
    }
    async createSenderContext(e) {
      this._validateInputLength(e), await this._setup();
      let t = await this._kem.encap(e),
        r;
      return (
        e.psk !== void 0
          ? (r = e.senderKey !== void 0 ? x.AuthPsk : x.Psk)
          : (r = e.senderKey !== void 0 ? x.Auth : x.Base),
        await this._keyScheduleS(r, t.sharedSecret, t.enc, e)
      );
    }
    async createRecipientContext(e) {
      this._validateInputLength(e), await this._setup();
      let t = await this._kem.decap(e),
        r;
      return (
        e.psk !== void 0
          ? (r = e.senderPublicKey !== void 0 ? x.AuthPsk : x.Psk)
          : (r = e.senderPublicKey !== void 0 ? x.Auth : x.Base),
        await this._keyScheduleR(r, t, e)
      );
    }
    async seal(e, t, r = c) {
      let n = await this.createSenderContext(e);
      return { ct: await n.seal(t, r), enc: n.enc };
    }
    async open(e, t, r = c) {
      return await (await this.createRecipientContext(e)).open(t, r);
    }
    async _keySchedule(e, t, r) {
      let n = r.psk === void 0 ? c : new Uint8Array(r.psk.id),
        a = await this._kdf.labeledExtract(c, Ne, n),
        s = r.info === void 0 ? c : new Uint8Array(r.info),
        o = await this._kdf.labeledExtract(c, je, s),
        u = new Uint8Array(1 + a.byteLength + o.byteLength);
      u.set(new Uint8Array([e]), 0),
        u.set(new Uint8Array(a), 1),
        u.set(new Uint8Array(o), 1 + a.byteLength);
      let y = r.psk === void 0 ? c : new Uint8Array(r.psk.key),
        b = this._kdf.buildLabeledIkm(Te, y),
        j = this._kdf.buildLabeledInfo(He, u, this._kdf.hashSize),
        d = await this._kdf.extractAndExpand(t, b, j, this._kdf.hashSize);
      if (this._aead.id === m.ExportOnly) return { aead: this._aead, exporterSecret: d };
      let me = this._kdf.buildLabeledInfo(De, u, this._aead.keySize),
        ge = await this._kdf.extractAndExpand(t, b, me, this._aead.keySize),
        ke = this._kdf.buildLabeledInfo(ze, u, this._aead.nonceSize),
        Pe = await this._kdf.extractAndExpand(t, b, ke, this._aead.nonceSize);
      return {
        aead: this._aead,
        exporterSecret: d,
        key: ge,
        baseNonce: new Uint8Array(Pe),
        seq: 0,
      };
    }
    async _keyScheduleS(e, t, r, n) {
      let a = await this._keySchedule(e, t, n);
      return a.key === void 0
        ? new q(this._api, this._kdf, a.exporterSecret, r)
        : new X(this._api, this._kdf, a, r);
    }
    async _keyScheduleR(e, t, r) {
      let n = await this._keySchedule(e, t, r);
      return n.key === void 0
        ? new F(this._api, this._kdf, n.exporterSecret)
        : new Y(this._api, this._kdf, n);
    }
    _validateInputLength(e) {
      if (e.info !== void 0 && e.info.byteLength > 8192) throw new l('Too long info');
      if (e.psk !== void 0) {
        if (e.psk.key.byteLength < 32) throw new l(`PSK must have at least ${32} bytes`);
        if (e.psk.key.byteLength > 8192) throw new l('Too long psk.key');
        if (e.psk.id.byteLength > 8192) throw new l('Too long psk.id');
      }
    }
  };
var we = new Uint8Array([72, 80, 75, 69, 45, 118, 49]),
  H = class extends w {
    constructor() {
      super(),
        Object.defineProperty(this, 'id', {
          enumerable: !0,
          configurable: !0,
          writable: !0,
          value: v.HkdfSha256,
        }),
        Object.defineProperty(this, 'hashSize', {
          enumerable: !0,
          configurable: !0,
          writable: !0,
          value: 0,
        }),
        Object.defineProperty(this, '_suiteId', {
          enumerable: !0,
          configurable: !0,
          writable: !0,
          value: c,
        }),
        Object.defineProperty(this, 'algHash', {
          enumerable: !0,
          configurable: !0,
          writable: !0,
          value: { name: 'HMAC', hash: 'SHA-256', length: 256 },
        });
    }
    init(e) {
      this._suiteId = e;
    }
    buildLabeledIkm(e, t) {
      this._checkInit();
      let r = new Uint8Array(7 + this._suiteId.byteLength + e.byteLength + t.byteLength);
      return (
        r.set(we, 0),
        r.set(this._suiteId, 7),
        r.set(e, 7 + this._suiteId.byteLength),
        r.set(t, 7 + this._suiteId.byteLength + e.byteLength),
        r
      );
    }
    buildLabeledInfo(e, t, r) {
      this._checkInit();
      let n = new Uint8Array(9 + this._suiteId.byteLength + e.byteLength + t.byteLength);
      return (
        n.set(new Uint8Array([0, r]), 0),
        n.set(we, 2),
        n.set(this._suiteId, 9),
        n.set(e, 9 + this._suiteId.byteLength),
        n.set(t, 9 + this._suiteId.byteLength + e.byteLength),
        n
      );
    }
    async extract(e, t) {
      if (
        (await this._setup(),
        e.byteLength === 0 && (e = new ArrayBuffer(this.hashSize)),
        e.byteLength !== this.hashSize)
      )
        throw new l('The salt length must be the same as the hashSize');
      let r = await this._api.importKey('raw', e, this.algHash, !1, ['sign']);
      return await this._api.sign('HMAC', r, t);
    }
    async expand(e, t, r) {
      await this._setup();
      let n = await this._api.importKey('raw', e, this.algHash, !1, ['sign']),
        a = new ArrayBuffer(r),
        s = new Uint8Array(a),
        o = c,
        u = new Uint8Array(t),
        y = new Uint8Array(1);
      if (r > 255 * this.hashSize) throw new Error('Entropy limit reached');
      let b = new Uint8Array(this.hashSize + u.length + 1);
      for (let j = 1, d = 0; d < s.length; j++)
        (y[0] = j),
          b.set(o, 0),
          b.set(u, o.length),
          b.set(y, o.length + u.length),
          (o = new Uint8Array(
            await this._api.sign('HMAC', n, b.slice(0, o.length + u.length + 1))
          )),
          s.length - d >= o.length
            ? (s.set(o, d), (d += o.length))
            : (s.set(o.slice(0, s.length - d), d), (d += s.length - d));
      return a;
    }
    async extractAndExpand(e, t, r, n) {
      await this._setup();
      let a = await this._api.importKey('raw', t, 'HKDF', !1, ['deriveBits']);
      return await this._api.deriveBits(
        { name: 'HKDF', hash: this.algHash.hash, salt: e, info: r },
        a,
        n * 8
      );
    }
    async labeledExtract(e, t, r) {
      return await this.extract(e, this.buildLabeledIkm(t, r));
    }
    async labeledExpand(e, t, r, n) {
      return await this.expand(e, this.buildLabeledInfo(t, r, n), n);
    }
    _checkInit() {
      if (this._suiteId === c) throw new Error('Not initialized. Call init()');
    }
  },
  E = class extends H {
    constructor() {
      super(...arguments),
        Object.defineProperty(this, 'id', {
          enumerable: !0,
          configurable: !0,
          writable: !0,
          value: v.HkdfSha256,
        }),
        Object.defineProperty(this, 'hashSize', {
          enumerable: !0,
          configurable: !0,
          writable: !0,
          value: 32,
        }),
        Object.defineProperty(this, 'algHash', {
          enumerable: !0,
          configurable: !0,
          writable: !0,
          value: { name: 'HMAC', hash: 'SHA-256', length: 256 },
        });
    }
  },
  I = class extends H {
    constructor() {
      super(...arguments),
        Object.defineProperty(this, 'id', {
          enumerable: !0,
          configurable: !0,
          writable: !0,
          value: v.HkdfSha384,
        }),
        Object.defineProperty(this, 'hashSize', {
          enumerable: !0,
          configurable: !0,
          writable: !0,
          value: 48,
        }),
        Object.defineProperty(this, 'algHash', {
          enumerable: !0,
          configurable: !0,
          writable: !0,
          value: { name: 'HMAC', hash: 'SHA-384', length: 384 },
        });
    }
  },
  L = class extends H {
    constructor() {
      super(...arguments),
        Object.defineProperty(this, 'id', {
          enumerable: !0,
          configurable: !0,
          writable: !0,
          value: v.HkdfSha512,
        }),
        Object.defineProperty(this, 'hashSize', {
          enumerable: !0,
          configurable: !0,
          writable: !0,
          value: 64,
        }),
        Object.defineProperty(this, 'algHash', {
          enumerable: !0,
          configurable: !0,
          writable: !0,
          value: { name: 'HMAC', hash: 'SHA-512', length: 512 },
        });
    }
  };
var _e = new Uint8Array([75, 69, 77, 0, 0]);
var Me = new Uint8Array([101, 97, 101, 95, 112, 114, 107]),
  Re = new Uint8Array([115, 104, 97, 114, 101, 100, 95, 115, 101, 99, 114, 101, 116]);
function Be(i, e, t) {
  let r = new Uint8Array(i.length + e.length + t.length);
  return r.set(i, 0), r.set(e, i.length), r.set(t, i.length + e.length), r;
}
var U = class {
  constructor(e, t, r) {
    Object.defineProperty(this, 'id', {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: void 0,
    }),
      Object.defineProperty(this, 'secretSize', {
        enumerable: !0,
        configurable: !0,
        writable: !0,
        value: 0,
      }),
      Object.defineProperty(this, 'encSize', {
        enumerable: !0,
        configurable: !0,
        writable: !0,
        value: 0,
      }),
      Object.defineProperty(this, 'publicKeySize', {
        enumerable: !0,
        configurable: !0,
        writable: !0,
        value: 0,
      }),
      Object.defineProperty(this, 'privateKeySize', {
        enumerable: !0,
        configurable: !0,
        writable: !0,
        value: 0,
      }),
      Object.defineProperty(this, '_prim', {
        enumerable: !0,
        configurable: !0,
        writable: !0,
        value: void 0,
      }),
      Object.defineProperty(this, '_kdf', {
        enumerable: !0,
        configurable: !0,
        writable: !0,
        value: void 0,
      }),
      (this.id = e),
      (this._prim = t),
      (this._kdf = r);
    let n = new Uint8Array(_e);
    n.set(_(this.id, 2), 3), this._kdf.init(n);
  }
  async serializePublicKey(e) {
    return await this._prim.serializePublicKey(e);
  }
  async deserializePublicKey(e) {
    return await this._prim.deserializePublicKey(e);
  }
  async serializePrivateKey(e) {
    return await this._prim.serializePrivateKey(e);
  }
  async deserializePrivateKey(e) {
    return await this._prim.deserializePrivateKey(e);
  }
  async importKey(e, t, r = !0) {
    return await this._prim.importKey(e, t, r);
  }
  async generateKeyPair() {
    return await this._prim.generateKeyPair();
  }
  async deriveKeyPair(e) {
    if (e.byteLength > 8192) throw new l('Too long ikm');
    return await this._prim.deriveKeyPair(e);
  }
  async encap(e) {
    let t;
    e.ekm === void 0
      ? (t = await this.generateKeyPair())
      : K(e.ekm)
        ? (t = e.ekm)
        : (t = await this.deriveKeyPair(e.ekm));
    let r = await this._prim.serializePublicKey(t.publicKey),
      n = await this._prim.serializePublicKey(e.recipientPublicKey);
    try {
      let a;
      if (e.senderKey === void 0)
        a = new Uint8Array(await this._prim.dh(t.privateKey, e.recipientPublicKey));
      else {
        let u = K(e.senderKey) ? e.senderKey.privateKey : e.senderKey,
          y = new Uint8Array(await this._prim.dh(t.privateKey, e.recipientPublicKey)),
          b = new Uint8Array(await this._prim.dh(u, e.recipientPublicKey));
        a = z(y, b);
      }
      let s;
      if (e.senderKey === void 0) s = z(new Uint8Array(r), new Uint8Array(n));
      else {
        let u = K(e.senderKey)
            ? e.senderKey.publicKey
            : await this._prim.derivePublicKey(e.senderKey),
          y = await this._prim.serializePublicKey(u);
        s = Be(new Uint8Array(r), new Uint8Array(n), new Uint8Array(y));
      }
      let o = await this._generateSharedSecret(a, s);
      return { enc: r, sharedSecret: o };
    } catch (a) {
      throw new D(a);
    }
  }
  async decap(e) {
    let t = await this._prim.deserializePublicKey(e.enc),
      r = K(e.recipientKey) ? e.recipientKey.privateKey : e.recipientKey,
      n = K(e.recipientKey)
        ? e.recipientKey.publicKey
        : await this._prim.derivePublicKey(e.recipientKey),
      a = await this._prim.serializePublicKey(n);
    try {
      let s;
      if (e.senderPublicKey === void 0) s = new Uint8Array(await this._prim.dh(r, t));
      else {
        let u = new Uint8Array(await this._prim.dh(r, t)),
          y = new Uint8Array(await this._prim.dh(r, e.senderPublicKey));
        s = z(u, y);
      }
      let o;
      if (e.senderPublicKey === void 0) o = z(new Uint8Array(e.enc), new Uint8Array(a));
      else {
        let u = await this._prim.serializePublicKey(e.senderPublicKey);
        (o = new Uint8Array(e.enc.byteLength + a.byteLength + u.byteLength)),
          o.set(new Uint8Array(e.enc), 0),
          o.set(new Uint8Array(a), e.enc.byteLength),
          o.set(new Uint8Array(u), e.enc.byteLength + a.byteLength);
      }
      return await this._generateSharedSecret(s, o);
    } catch (s) {
      throw new N(s);
    }
  }
  async _generateSharedSecret(e, t) {
    let r = this._kdf.buildLabeledIkm(Me, e),
      n = this._kdf.buildLabeledInfo(Re, t, this.secretSize);
    return await this._kdf.extractAndExpand(c, r, n, this.secretSize);
  }
};
var W = ['deriveBits'],
  xe = new Uint8Array([100, 107, 112, 95, 112, 114, 107]),
  Jt = new Uint8Array([115, 107]);
var Z = class {
  constructor(e) {
    Object.defineProperty(this, '_num', {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: void 0,
    }),
      (this._num = new Uint8Array(e));
  }
  val() {
    return this._num;
  }
  reset() {
    this._num.fill(0);
  }
  set(e) {
    if (e.length !== this._num.length) throw new Error('Bignum.set: invalid argument');
    this._num.set(e);
  }
  isZero() {
    for (let e = 0; e < this._num.length; e++) if (this._num[e] !== 0) return !1;
    return !0;
  }
  lessThan(e) {
    if (e.length !== this._num.length) throw new Error('Bignum.lessThan: invalid argument');
    for (let t = 0; t < this._num.length; t++) {
      if (this._num[t] < e[t]) return !0;
      if (this._num[t] > e[t]) return !1;
    }
    return !1;
  }
};
var Ge = new Uint8Array([99, 97, 110, 100, 105, 100, 97, 116, 101]),
  Fe = new Uint8Array([
    255, 255, 255, 255, 0, 0, 0, 0, 255, 255, 255, 255, 255, 255, 255, 255, 188, 230, 250, 173, 167,
    23, 158, 132, 243, 185, 202, 194, 252, 99, 37, 81,
  ]),
  qe = new Uint8Array([
    255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255,
    255, 255, 255, 255, 255, 199, 99, 77, 129, 244, 55, 45, 223, 88, 26, 13, 178, 72, 176, 167, 122,
    236, 236, 25, 106, 204, 197, 41, 115,
  ]),
  Ye = new Uint8Array([
    1, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255,
    255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 250, 81, 134, 135, 131,
    191, 47, 150, 107, 127, 204, 1, 72, 247, 9, 165, 208, 59, 181, 201, 184, 137, 156, 71, 174, 187,
    111, 183, 30, 145, 56, 100, 9,
  ]),
  Xe = new Uint8Array([
    48, 65, 2, 1, 0, 48, 19, 6, 7, 42, 134, 72, 206, 61, 2, 1, 6, 8, 42, 134, 72, 206, 61, 3, 1, 7,
    4, 39, 48, 37, 2, 1, 1, 4, 32,
  ]),
  Je = new Uint8Array([
    48, 78, 2, 1, 0, 48, 16, 6, 7, 42, 134, 72, 206, 61, 2, 1, 6, 5, 43, 129, 4, 0, 34, 4, 55, 48,
    53, 2, 1, 1, 4, 48,
  ]),
  We = new Uint8Array([
    48, 96, 2, 1, 0, 48, 16, 6, 7, 42, 134, 72, 206, 61, 2, 1, 6, 5, 43, 129, 4, 0, 35, 4, 73, 48,
    71, 2, 1, 1, 4, 66,
  ]),
  O = class extends w {
    constructor(e, t) {
      switch (
        (super(),
        Object.defineProperty(this, '_hkdf', {
          enumerable: !0,
          configurable: !0,
          writable: !0,
          value: void 0,
        }),
        Object.defineProperty(this, '_alg', {
          enumerable: !0,
          configurable: !0,
          writable: !0,
          value: void 0,
        }),
        Object.defineProperty(this, '_nPk', {
          enumerable: !0,
          configurable: !0,
          writable: !0,
          value: void 0,
        }),
        Object.defineProperty(this, '_nSk', {
          enumerable: !0,
          configurable: !0,
          writable: !0,
          value: void 0,
        }),
        Object.defineProperty(this, '_nDh', {
          enumerable: !0,
          configurable: !0,
          writable: !0,
          value: void 0,
        }),
        Object.defineProperty(this, '_order', {
          enumerable: !0,
          configurable: !0,
          writable: !0,
          value: void 0,
        }),
        Object.defineProperty(this, '_bitmask', {
          enumerable: !0,
          configurable: !0,
          writable: !0,
          value: void 0,
        }),
        Object.defineProperty(this, '_pkcs8AlgId', {
          enumerable: !0,
          configurable: !0,
          writable: !0,
          value: void 0,
        }),
        (this._hkdf = t),
        e)
      ) {
        case f.DhkemP256HkdfSha256:
          (this._alg = { name: 'ECDH', namedCurve: 'P-256' }),
            (this._nPk = 65),
            (this._nSk = 32),
            (this._nDh = 32),
            (this._order = Fe),
            (this._bitmask = 255),
            (this._pkcs8AlgId = Xe);
          break;
        case f.DhkemP384HkdfSha384:
          (this._alg = { name: 'ECDH', namedCurve: 'P-384' }),
            (this._nPk = 97),
            (this._nSk = 48),
            (this._nDh = 48),
            (this._order = qe),
            (this._bitmask = 255),
            (this._pkcs8AlgId = Je);
          break;
        default:
          (this._alg = { name: 'ECDH', namedCurve: 'P-521' }),
            (this._nPk = 133),
            (this._nSk = 66),
            (this._nDh = 66),
            (this._order = Ye),
            (this._bitmask = 1),
            (this._pkcs8AlgId = We);
          break;
      }
    }
    async serializePublicKey(e) {
      await this._setup();
      try {
        return await this._api.exportKey('raw', e);
      } catch (t) {
        throw new P(t);
      }
    }
    async deserializePublicKey(e) {
      await this._setup();
      try {
        return await this._importRawKey(e, !0);
      } catch (t) {
        throw new g(t);
      }
    }
    async serializePrivateKey(e) {
      await this._setup();
      try {
        let t = await this._api.exportKey('jwk', e);
        if (!('d' in t)) throw new Error('Not private key');
        return be(t.d);
      } catch (t) {
        throw new P(t);
      }
    }
    async deserializePrivateKey(e) {
      await this._setup();
      try {
        return await this._importRawKey(e, !1);
      } catch (t) {
        throw new g(t);
      }
    }
    async importKey(e, t, r) {
      await this._setup();
      try {
        if (e === 'raw') return await this._importRawKey(t, r);
        if (t instanceof ArrayBuffer) throw new Error('Invalid jwk key format');
        return await this._importJWK(t, r);
      } catch (n) {
        throw new g(n);
      }
    }
    async generateKeyPair() {
      await this._setup();
      try {
        return await this._api.generateKey(this._alg, !0, W);
      } catch (e) {
        throw new p(e);
      }
    }
    async deriveKeyPair(e) {
      await this._setup();
      try {
        let t = await this._hkdf.labeledExtract(c, xe, new Uint8Array(e)),
          r = new Z(this._nSk);
        for (let a = 0; r.isZero() || !r.lessThan(this._order); a++) {
          if (a > 255) throw new Error('Faild to derive a key pair');
          let s = new Uint8Array(await this._hkdf.labeledExpand(t, Ge, _(a, 1), this._nSk));
          (s[0] = s[0] & this._bitmask), r.set(s);
        }
        let n = await this._deserializePkcs8Key(r.val());
        return r.reset(), { privateKey: n, publicKey: await this.derivePublicKey(n) };
      } catch (t) {
        throw new B(t);
      }
    }
    async derivePublicKey(e) {
      await this._setup();
      try {
        let t = await this._api.exportKey('jwk', e);
        return delete t.d, delete t.key_ops, await this._api.importKey('jwk', t, this._alg, !0, []);
      } catch (t) {
        throw new g(t);
      }
    }
    async dh(e, t) {
      try {
        return (
          await this._setup(),
          await this._api.deriveBits({ name: 'ECDH', public: t }, e, this._nDh * 8)
        );
      } catch (r) {
        throw new P(r);
      }
    }
    async _importRawKey(e, t) {
      if (t && e.byteLength !== this._nPk)
        throw new Error('Invalid public key for the ciphersuite');
      if (!t && e.byteLength !== this._nSk)
        throw new Error('Invalid private key for the ciphersuite');
      return t
        ? await this._api.importKey('raw', e, this._alg, !0, [])
        : await this._deserializePkcs8Key(new Uint8Array(e));
    }
    async _importJWK(e, t) {
      if (typeof e.crv > 'u' || e.crv !== this._alg.namedCurve)
        throw new Error(`Invalid crv: ${e.crv}`);
      if (t) {
        if (typeof e.d < 'u') throw new Error('Invalid key: `d` should not be set');
        return await this._api.importKey('jwk', e, this._alg, !0, []);
      }
      if (typeof e.d > 'u') throw new Error('Invalid key: `d` not found');
      return await this._api.importKey('jwk', e, this._alg, !0, W);
    }
    async _deserializePkcs8Key(e) {
      let t = new Uint8Array(this._pkcs8AlgId.length + e.length);
      return (
        t.set(this._pkcs8AlgId, 0),
        t.set(e, this._pkcs8AlgId.length),
        await this._api.importKey('pkcs8', t, this._alg, !0, W)
      );
    }
  };
var $ = class extends U {
    constructor() {
      let e = new E(),
        t = new O(f.DhkemP256HkdfSha256, e);
      super(f.DhkemP256HkdfSha256, t, e),
        Object.defineProperty(this, 'id', {
          enumerable: !0,
          configurable: !0,
          writable: !0,
          value: f.DhkemP256HkdfSha256,
        }),
        Object.defineProperty(this, 'secretSize', {
          enumerable: !0,
          configurable: !0,
          writable: !0,
          value: 32,
        }),
        Object.defineProperty(this, 'encSize', {
          enumerable: !0,
          configurable: !0,
          writable: !0,
          value: 65,
        }),
        Object.defineProperty(this, 'publicKeySize', {
          enumerable: !0,
          configurable: !0,
          writable: !0,
          value: 65,
        }),
        Object.defineProperty(this, 'privateKeySize', {
          enumerable: !0,
          configurable: !0,
          writable: !0,
          value: 32,
        });
    }
  },
  Q = class extends U {
    constructor() {
      let e = new I(),
        t = new O(f.DhkemP384HkdfSha384, e);
      super(f.DhkemP384HkdfSha384, t, e),
        Object.defineProperty(this, 'id', {
          enumerable: !0,
          configurable: !0,
          writable: !0,
          value: f.DhkemP384HkdfSha384,
        }),
        Object.defineProperty(this, 'secretSize', {
          enumerable: !0,
          configurable: !0,
          writable: !0,
          value: 48,
        }),
        Object.defineProperty(this, 'encSize', {
          enumerable: !0,
          configurable: !0,
          writable: !0,
          value: 97,
        }),
        Object.defineProperty(this, 'publicKeySize', {
          enumerable: !0,
          configurable: !0,
          writable: !0,
          value: 97,
        }),
        Object.defineProperty(this, 'privateKeySize', {
          enumerable: !0,
          configurable: !0,
          writable: !0,
          value: 48,
        });
    }
  },
  V = class extends U {
    constructor() {
      let e = new L(),
        t = new O(f.DhkemP521HkdfSha512, e);
      super(f.DhkemP521HkdfSha512, t, e),
        Object.defineProperty(this, 'id', {
          enumerable: !0,
          configurable: !0,
          writable: !0,
          value: f.DhkemP521HkdfSha512,
        }),
        Object.defineProperty(this, 'secretSize', {
          enumerable: !0,
          configurable: !0,
          writable: !0,
          value: 64,
        }),
        Object.defineProperty(this, 'encSize', {
          enumerable: !0,
          configurable: !0,
          writable: !0,
          value: 133,
        }),
        Object.defineProperty(this, 'publicKeySize', {
          enumerable: !0,
          configurable: !0,
          writable: !0,
          value: 133,
        }),
        Object.defineProperty(this, 'privateKeySize', {
          enumerable: !0,
          configurable: !0,
          writable: !0,
          value: 64,
        });
    }
  };
var ae = class extends J {},
  se = class extends $ {},
  oe = class extends Q {},
  ue = class extends V {},
  ce = class extends E {},
  le = class extends I {},
  he = class extends L {};
export {
  m as AeadId,
  G as Aes128Gcm,
  re as Aes256Gcm,
  ee as BaseError,
  ae as CipherSuite,
  N as DecapError,
  B as DeriveKeyPairError,
  g as DeserializeError,
  se as DhkemP256HkdfSha256,
  oe as DhkemP384HkdfSha384,
  ue as DhkemP521HkdfSha512,
  D as EncapError,
  T as ExportError,
  ie as ExportOnly,
  ce as HkdfSha256,
  le as HkdfSha384,
  he as HkdfSha512,
  h as HpkeError,
  l as InvalidParamError,
  v as KdfId,
  f as KemId,
  R as MessageLimitReachedError,
  p as NotSupportedError,
  M as OpenError,
  C as SealError,
  P as SerializeError,
  de as ValidationError,
};
