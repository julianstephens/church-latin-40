# Ecclesiastical Latin: 40 Days to Sacred Language

All site design, development, and course content by [masaharumori7](https://github.com/masaharumori7/church-latin-40).

This fork adds authentication via Auth0 and data storage using PocketBase.

## Environment Configuration

### Required Environment Variables

This application requires the following environment variables to run:

1. **VITE_AUTH0_DOMAIN** - Your Auth0 application domain
   - Format: `your-domain.auth0.com` or `your-domain.region.auth0.com`
   - Get from: [Auth0 Dashboard](https://manage.auth0.com/dashboard)

2. **VITE_AUTH0_CLIENT_ID** - Your Auth0 application client ID
   - Get from: [Auth0 Dashboard](https://manage.auth0.com/dashboard)

3. **VITE_POCKETBASE_URL** - URL where your PocketBase instance is running
   - Local development: `http://localhost:8080`
   - Production: `https://your-pb-instance.com`

### Optional Environment Variables

- **VITE_GITHUB_ISSUES_URL** - URL to your GitHub issues page (used in error boundary)

### Setup Instructions

1. Copy `.env.example` to `.env.local`:

   ```bash
   cp .env.example .env.local
   ```

2. Update `.env.local` with your actual configuration values:

   ```bash
   VITE_AUTH0_DOMAIN=your-domain.auth0.com
   VITE_AUTH0_CLIENT_ID=your-client-id
   VITE_POCKETBASE_URL=http://localhost:8090
   ```

3. The application will automatically validate your environment configuration on startup and provide detailed error messages if any required variables are missing or incorrectly formatted.

### Environment Validation

The application includes built-in environment validation that checks:

- ✓ All required variables are present
- ✓ Auth0 domain format is valid
- ✓ Auth0 client ID has reasonable length
- ✓ PocketBase URL is a valid URL with proper protocol
- ✓ PocketBase collection name follows naming conventions

If validation fails, the application will display detailed error messages indicating which variables need to be fixed and what the correct format should be.
