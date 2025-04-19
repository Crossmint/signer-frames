# Static Frames

A static web application framework for cryptographic utilities supporting Solana and EVM chains.

## Project Structure

```
├── dist/             # Compiled JS bundles
├── src/              # Source code
│   └── js/           # JavaScript source files
├── static/           # Static assets (served directly)
│   ├── css/          # CSS stylesheets
│   ├── js/           # JavaScript files
│   │   └── dist/     # Compiled JS for browser
│   ├── index.html    # Main HTML file (generated from template)
│   └── index.html.template # Template for HTML file
├── tests/            # Test files
├── .env.local        # Local environment variables (created from example)
└── .env.local.example # Example environment variables
```

## Development

### Prerequisites

- Node.js (v14+)
- pnpm 

### Setup

1. Clone the repository
2. Install dependencies:

```bash
pnpm install
```

3. Copy the environment file:

```bash
cp .env.local.example .env.local
```

4. Modify the `.env.local` file as needed

### Development Workflow

Run the development server:

```bash
pnpm dev
```

This will:
1. Set up environment variables
2. Build the JS bundle in development mode
3. Process HTML templates
4. Start a local server

The application will be available at http://localhost:3000

### Production Build

To create a production build:

```bash
pnpm serve:prod
```

This will:
1. Build optimized JS bundle
2. Copy assets to static directory
3. Process HTML templates with production variables
4. Start a server with the production build

## Testing

Run tests:

```bash
pnpm test
```

Watch mode:

```bash
pnpm test:watch
```

UI mode:

```bash
pnpm test:ui
```

Coverage report:

```bash
pnpm test:coverage
```

## License

MIT 