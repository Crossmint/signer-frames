# Static Frames - Secure Cryptographic Key Shard Management

A client-side secure environment for managing and storing cryptographic key shards with the ability to reconstruct them on demand. Designed with a focus on Solana (Ed25519) and Ethereum (EVM) blockchain ecosystems.

## Core Features

- 🛡️ **Key Shard Management**: Securely store and manage cryptographic key fragments in the client environment
- 🔄 **On-Demand Reconstruction**: Reconstruct full cryptographic keys only when needed
- 🔐 **Secure Storage**: Client-side storage of key shards using IndexedDB and localStorage
- 📝 **Signature Capabilities**: Sign and verify messages using reconstructed keys
- 🔢 **Format Conversion**: Convert between hex and Base58 formats for different blockchain environments

## Project Structure

The project uses a modular ES module system with esbuild for bundling:

```
├── src/             # Source code
│   └── js/
│       ├── common.js        # Common utilities (hex/base58 conversion)
│       ├── evm.js           # Ethereum key management
│       ├── index.js         # Main entry point
│       ├── lib/
│       │   └── noble-ed25519.js  # Ed25519 implementation
│       ├── solana.js        # Solana key management with Ed25519
│       └── storage.js       # IndexedDB/localStorage utilities
├── dist/            # Build output (main distribution files)
│   ├── bundle.js            # Non-minified bundle with sourcemap
│   └── bundle.min.js        # Minified bundle with sourcemap
├── static/          # Static files served to browser
│   ├── css/                 # Stylesheets
│   ├── js/
│   │   └── dist/            # Bundled scripts (copied from dist/)
│   │       ├── bundle.js        # Non-minified bundle
│   │       └── bundle.min.js    # Minified bundle for production
│   ├── index.html           # Main demo page
│   └── keymanager-demo.html # Key management demo
├── package.json     # Project configuration and scripts
└── README.md        # This documentation
```

## Building and Running

### Prerequisites

- Node.js 14+
- pnpm (required)

### Setup

```bash
# Install dependencies
pnpm install

# Build the project (minified by default)
pnpm build

# Start the development server
pnpm serve
```

### Development

```bash
# Watch for changes and rebuild (non-minified)
pnpm dev

# Build both minified and non-minified versions
pnpm build:prod

# Run full development environment (build + watch + copy + serve)
pnpm dev:all
```

### Build Options

| Command | Description |
|---------|-------------|
| `pnpm build` | Build minified bundle with sourcemap |
| `pnpm build:dev` | Build non-minified bundle with sourcemap |
| `pnpm build:prod` | Build both non-minified and minified bundles |
| `pnpm dev` | Watch for changes and build non-minified bundle |
| `pnpm dev:all` | Run complete dev environment with auto-rebuild and live-reload |
| `pnpm serve` | Start development server |

## Usage

### In Browser

Include the bundled script in your HTML:

```html
<!-- Production (minified) -->
<script src="js/dist/bundle.min.js"></script>

<!-- Development (non-minified) -->
<!-- <script src="js/dist/bundle.js"></script> -->
```

Then use the XMIF global object:

```js
// Initialize the framework
await XMIF.init();

// Generate a Solana key
const privateKey = await XMIF.Solana.generatePrivateKey();
const publicKey = await XMIF.Solana.getPublicKey(privateKey);

// Sign a message
const signature = await XMIF.Solana.signMessage("Hello, Solana!", privateKey);
const isValid = await XMIF.Solana.verifySignature("Hello, Solana!", signature, publicKey);

// Use EVM functionality
const evmPrivateKey = await XMIF.EVM.generatePrivateKey();
const ethAddress = await XMIF.EVM.getPublicAddress(evmPrivateKey);

// Store key shards
await XMIF.storeData(XMIF.Storage.KEYS_STORE, { 
  id: "my-key-shard", 
  privateKey, 
  publicKey 
});

// Retrieve and reconstruct key
const storedKeyShard = await XMIF.getData(XMIF.Storage.KEYS_STORE, "my-key-shard");
```

### As ES Module (Advanced)

For more advanced projects with a build system, you can directly import the modules:

```js
import { solana, evm, common, storage } from './path/to/static-frames';

// Generate and manage key shards
const privateKeyShard = await solana.generatePrivateKey();
const publicKey = await solana.getPublicKey(privateKeyShard);
```

## Demo Pages

1. **Main Demo** - Base58 encoding/decoding and storage functionality
   - Open http://localhost:3000/ when running `pnpm serve`

2. **Key Manager Demo** - Demonstrate key generation, signing, and verification
   - Open http://localhost:3000/keymanager-demo.html when running `pnpm serve`

## Bundle Size

| File | Size (uncompressed) | Size (gzipped)* |
|------|---------------------|-----------------|
| bundle.js | ~26 KB | ~8 KB |
| bundle.min.js | ~11 KB | ~4 KB |

*Estimated gzipped size. Actual size may vary with server compression settings.

## Security Considerations

- All cryptographic operations remain client-side - keys are never transmitted to servers
- Key shards should be stored with proper encryption for production use
- This framework focuses on secure client-side key management rather than server-based key storage
- For enhanced security, consider implementing additional encryption for stored key shards

## License

MIT 

## Testing

This project uses Vitest for testing. The following commands are available:

```bash
# Run tests once
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with UI
pnpm test:ui

# Run tests with coverage
pnpm test:coverage
```

### Test Files

The test suite includes:

- `tests/storage.test.js` - Tests for localStorage functionality (getting, setting, and removing items with expiry)
- `tests/html.test.js` - Tests for HTML page rendering and content verification
- `tests/iframe.test.js` - Tests for iframe communication with postMessage API

The tests utilize mocks to simulate browser environments, DOM manipulation, and message passing between iframes. 