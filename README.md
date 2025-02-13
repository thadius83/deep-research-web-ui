# Deep Research Web UI

This is an enhanced web UI fork of [dzhng/deep-research](https://github.com/dzhng/deep-research), building upon the excellent web interface implementation by [AnotiaWang](https://github.com/AnotiaWang/deep-research-web-ui). Our fork adds Docker support, enhanced configuration options, and improved security features.

## Features

- 🔒 Bring Your Own API Key
- 🔄 Stream AI responses for realtime feedback
- 🌳 Visualization of the research process using a tree structure
- 🐳 Docker support for easy deployment
- ⚙️ Flexible configuration via UI or environment variables
- 🔐 Enhanced API key security (keys are wiped when endpoints change)

### Available Providers

- **AI**: OpenAI compatible APIs
- **Web Search**: 
  - Tavily (1000 credits/month free quota)
  - Firecrawl (self-hosted option)
  - [Custom Firecrawl with Google Search](https://github.com/thadius83/firecrawl-customgoogle) - A modified version of Firecrawl that provides direct Google search support without requiring credits or payments

## Quick Start

### Using Docker

1. Clone the repository and create your environment file:
```bash
git clone https://github.com/thadius83/deep-research-web-ui.git
cd deep-research-web-ui
cp .env.example .env
```

2. Configure your environment variables in `.env`

3. Build and run with Docker:
```bash
docker compose up --build
```

The application will be available at `http://localhost:5006`

### Standalone Setup

Install dependencies:
```bash
# Using pnpm (recommended)
pnpm install

# Or npm
npm install

# Or yarn
yarn install
```

Start the development server:
```bash
pnpm dev    # or npm run dev / yarn dev
```

The application will be available at `http://localhost:3000`

## Configuration

### Environment Variables

Key environment variables:

```bash
# AI Provider Settings
OPENAI_KEY=""                   # Your OpenAI API key
OPENAI_ENDPOINT=""             # Optional: Custom endpoint for OpenAI-compatible APIs
OPENAI_MODEL=""                # Model to use (e.g., "gpt-4", "deepseek-r1:32b")
CONTEXT_SIZE="128000"          # Optional: Context size for the model

# Web Search Provider Settings
DEFAULT_SEARCH_PROVIDER=""     # Default search provider ("tavily" or "firecrawl")

# Tavily Settings
TAVILY_KEY=""                  # Your Tavily API key
TAVILY_BASE_URL=""            # Optional: Custom Tavily API endpoint

# Firecrawl Settings
FIRECRAWL_KEY=""              # Your Firecrawl API key
FIRECRAWL_BASE_URL=""         # Optional: Custom Firecrawl endpoint
```

### Security Features

- API keys can be set via environment variables or the UI
- When changing API endpoints in the UI, associated API keys are automatically wiped for security
- No data is stored remotely - all operations happen in your browser
- Environment variables take precedence over UI settings

## Development

### Production Build

Build the application:
```bash
pnpm build    # or npm run build / yarn build
```

Preview production build:
```bash
pnpm preview  # or npm run preview / yarn preview
```

### Docker Production Build

For production deployment with Docker:
```bash
docker compose -f docker-compose.yml up -d
```

## Additional Resources

- [Nuxt.js Deployment Documentation](https://nuxt.com/docs/getting-started/deployment)
- [Original Deep Research Repository](https://github.com/dzhng/deep-research)

## License

MIT
