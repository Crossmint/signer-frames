<!-- [![cov](https://<you>.github.io/<repo>/badges/coverage.svg)](https://github.com/crossmint/signer-frames/actions)
 -->

# Crossmint Signers

A minimal standalone implementation of the Crossmint signer functionality for Trusted Execution Environment (TEE) communications. This library provides cryptographic utilities supporting Solana and EVM chains.
Moved to https://github.com/Crossmint/open-signer

## Features

- **Minimal External Dependencies**: Implementation with minimal external dependencies (just Zod) for maximum security
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

## Testing

```bash
pnpm test:coverage
```

## License

MIT 

# Frames Testing App

A simple Next.js application for testing iframe communication using MessageChannel. This app demonstrates how to establish a secure communication channel between a parent window and an iframe, which is useful for implementing sandboxed functionality or integrating with third-party services.

## Features

- **MessageChannel-based Communication**: Implements a secure communication channel between the parent app and iframe
- **Request-Response Pattern**: Demonstrates a simple request-response pattern for message signing
- **Message Logging**: Real-time display of all messages exchanged between the parent and iframe
- **Event-driven Architecture**: Uses a clean event-driven approach for handling messages

## Getting Started

### Prerequisites

- Node.js 18 or higher
- pnpm (preferred) or npm

### Installation

1. Clone the repository
```bash
git clone <repository-url>
cd frames-testing-app
```

2. Install dependencies
```bash
pnpm install
```

3. Run the development server
```bash
pnpm dev
```

4. Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## How It Works

The application consists of two main parts:

1. **Parent Application (Next.js)**: Contains the control panel and hosts the iframe
2. **Mock Iframe**: A simple HTML page that communicates with the parent
