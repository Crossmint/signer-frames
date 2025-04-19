# Crossmint Signers

A minimal standalone implementation of the Crossmint signer functionality for Trusted Execution Environment (TEE) communications. This library provides cryptographic utilities supporting Solana and EVM chains.

## Features

- **Zero External Dependencies**: Completely self-contained implementation with no external dependencies for maximum security
- **Subresource Integrity (SRI)**: Scripts include integrity hashes to prevent tampering
- **Multi-Chain Support**: Compatible with both Solana (ed25519) and Ethereum (secp256k1) chains
- **TEE Communication**: Secure communication with Trusted Execution Environments
- **TypeScript Support**: Fully typed codebase for improved development experience

## Security

This implementation is designed for secure environments:

- No external network calls except explicit API interactions
- Runs completely in the browser or secure container
- Uses browser's native crypto APIs
- Includes SRI (Subresource Integrity) hashes in script tags for tamper protection

## Setup

```bash
pnpm install
```

## Development

```bash
pnpm dev
```

## Production Build

```bash
pnpm serve:prod
```

## Integration

To integrate with your application, include the production build script with SRI:

```html
<script 
  src="https://your-domain.com/dist/bundle.min.js" 
  integrity="sha384-[hash]" 
  crossorigin="anonymous">
</script>
```

Replace `[hash]` with the actual SHA-384 hash of your bundle. You can generate this using:

```bash
pnpm run generate-sri
```

## Testing

```bash
pnpm test
```

## License

MIT 