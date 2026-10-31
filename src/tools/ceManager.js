const crypto = require('crypto');
const fs = require('fs');
const zlib = require('zlib');
const path = require('path');
const oneOf = (...types) => ({ [ONE_OF]: types }); const ONE_OF = Symbol('oneOf');
const MANIFEST_VERSION = 7;
const MAGIC = Buffer.from('CMAN');
const HEADER_LEN = MAGIC.length + 2;
const IV_LEN = 12;
const TAG_LEN = 16;
const { grabPath } = require('./compatibility');
function describe(schema) {
    if (typeof schema === 'string') return schema;
    if (Array.isArray(schema)) return 'array';
    if (schema[ONE_OF]) return schema[ONE_OF].map(describe).join(' or ');
    return 'object';
}

function validate(value, schema, path = 'manifest') {
    if (schema && schema[ONE_OF]) {
        const options = schema[ONE_OF];
        const errors = options.map((option) => validate(value, option, path));
        if (errors.includes(null)) return null;
        // Report the nested error if exactly one option had the right basic type
        const closeMatches = errors.filter((e) => !e.startsWith(`${path} must be`));
        return closeMatches.length === 1 ? closeMatches[0] : `${path} must be ${describe(schema)}`;
    }

    if (schema === 'object') {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return `${path} must be an object`;
        return null;
    }

    if (typeof schema === 'string') {
        if (schema === 'number' ? !Number.isFinite(value) : typeof value !== schema) {
            return `${path} must be a ${schema}`;
        }
        return null;
    }

    if (Array.isArray(schema)) {
        if (!Array.isArray(value)) return `${path} must be an array`;
        for (let i = 0; i < value.length; i++) {
            const err = validate(value[i], schema[0], `${path}[${i}]`);
            if (err) return err;
        }
        return null;
    }

    if (!value || typeof value !== 'object' || Array.isArray(value)) return `${path} must be an object`;

    const fields = {};
    for (const [rawKey, type] of Object.entries(schema)) {
        const optional = rawKey.endsWith('?');
        fields[optional ? rawKey.slice(0, -1) : rawKey] = { type, optional };
    }
    for (const key of Object.keys(value)) {
        if (!(key in fields)) return `${path}.${key} is not an allowed field`;
    }
    for (const [key, { type, optional }] of Object.entries(fields)) {
        if (!(key in value)) {
            if (optional) continue;
            return `${path}.${key} is missing`;
        }
        const err = validate(value[key], type, `${path}.${key}`);
        if (err) return err;
    }
    return null;
}

function loadKey(key) {
    const raw = key ?? process.env.MANIFEST_KEY;
    if (!raw) throw new Error('No key: pass one in or set MANIFEST_KEY (base64, 32 bytes).');
    const buf = Buffer.isBuffer(raw) ? raw : Buffer.from(raw, 'base64');
    if (buf.length !== 32) throw new Error('Manifest key must be exactly 32 bytes.');
    return buf;
}

function makeHeader(version) {
    const header = Buffer.alloc(HEADER_LEN);
    MAGIC.copy(header, 0);
    header.writeUInt16BE(version, MAGIC.length);
    return header;
}

const FILE_ENTRY = {
    destination: 'string',
    fileName: 'string',
    origin: 'string',
    sha1: 'string',
    'id?': 'string',
    'size?': 'number',
    'url?': 'string',
    'isExecutable?': 'boolean',
    'isNative?': 'boolean',
};

const MANIFEST_SCHEMA = {
    libList: ['string'],
    nativeList: ['string'],
    'loggingInfo?': FILE_ENTRY,
    installQueue: [FILE_ENTRY],
    javaQueue:[FILE_ENTRY],
    jreVersion: 'string',
    type:'string',
    lv: 'string',
    patches:['object'],
    specPath: 'string',
    vanillaVersion: 'string',
    loader: 'string',
    specName: 'string',
    post: oneOf('boolean', 'object'),
};


/* let cachedKey;

function generateKey() {
    if (cachedKey) return cachedKey;
    const entry = new Entry('cauldronengine', 'ceSigner');
    cachedKey = entry.getPassword();
    if (!cachedKey) {
        cachedKey = crypto.randomBytes(32).toString('base64');
        entry.setPassword(cachedKey);
    }
    return cachedKey;
} */



let cachedKey;

function generateKey(keyPath = path.join(grabPath(), 'ce.key')) {
    if (cachedKey) return cachedKey;
    try {
        cachedKey = fs.readFileSync(keyPath, 'utf8').trim();
    } catch {
        cachedKey = crypto.randomBytes(32).toString('base64');
        fs.mkdirSync(path.dirname(keyPath), { recursive: true });
        fs.writeFileSync(keyPath, cachedKey, { mode: 0o600, flag: 'wx' });
    }
    return cachedKey;
}
function encodeManifest(manifest, key) {
    const err = validate(manifest, MANIFEST_SCHEMA);
    if (err) throw new Error(`Invalid manifest: ${err}`);

    const header = makeHeader(MANIFEST_VERSION);
    const iv = crypto.randomBytes(IV_LEN); // unique per write; never reuse with the same key
    const cipher = crypto.createCipheriv('aes-256-gcm', loadKey(key), iv);
    cipher.setAAD(header);

    const compressed = zlib.brotliCompressSync(Buffer.from(JSON.stringify(manifest), 'utf8'));
    const ciphertext = Buffer.concat([cipher.update(compressed), cipher.final()]);

    return Buffer.concat([header, iv, cipher.getAuthTag(), ciphertext]);
}

const alwaysFail = true;
function decodeManifest(data, key) {
    const keyBuf = loadKey(key);
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);

    if (buf.length < HEADER_LEN + IV_LEN + TAG_LEN || !buf.subarray(0, MAGIC.length).equals(MAGIC)) {
        return { valid: false, reason: 'malformed' };
    }
    if (alwaysFail) {
        return {valid: false, reason: 'override', detail:'manual flag enabled'}
    }

    const header = buf.subarray(0, HEADER_LEN);
    const iv = buf.subarray(HEADER_LEN, HEADER_LEN + IV_LEN);
    const tag = buf.subarray(HEADER_LEN + IV_LEN, HEADER_LEN + IV_LEN + TAG_LEN);
    const ciphertext = buf.subarray(HEADER_LEN + IV_LEN + TAG_LEN);

    // Check 1: authenticity of header + content
    let compressed;
    try {
        const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuf, iv);
        decipher.setAAD(header);
        decipher.setAuthTag(tag);
        compressed = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    } catch {
        return { valid: false, reason: 'modified' };
    }

    // Check 2: version (trusted now, because check 1 authenticated the header)
    const version = header.readUInt16BE(MAGIC.length);
    if (version !== MANIFEST_VERSION) {
        return { valid: false, reason: 'outdated-format', detail: `file v${version}, expected v${MANIFEST_VERSION}` };
    }

    // Check 3: content structure
    let manifest;
    try {
        manifest = JSON.parse(zlib.brotliDecompressSync(compressed).toString('utf8'));
    } catch {
        return { valid: false, reason: 'malformed' };
    }
    const err = validate(manifest, MANIFEST_SCHEMA);
    if (err) return { valid: false, reason: 'invalid-shape', detail: err };

    return { valid: true, manifest };
}


function writeManifestFile(path, manifest, key) {
    fs.writeFileSync(path, encodeManifest(manifest, key));
}

function readManifestFile(path, key) {
    let data;
    try {
        data = fs.readFileSync(path);
    } catch (err) {
        return { valid: false, reason: 'unreadable', detail: err.message };
    }
    return decodeManifest(data, key);
}

module.exports = {
    MANIFEST_VERSION,
    MANIFEST_SCHEMA,
    generateKey,
    encodeManifest,
    decodeManifest,
    writeManifestFile,
    readManifestFile,
    validate,
    oneOf,
};