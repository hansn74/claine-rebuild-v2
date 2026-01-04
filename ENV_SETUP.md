# Environment Variable Setup

This document describes how to set up environment variables for the Claine v2 project.

## Local Development

1. **Copy the example environment file:**

   ```bash
   cp .env.example .env
   ```

2. **Edit `.env` and set values for your environment:**

   ```bash
   VITE_APP_NAME=Claine (Dev)
   VITE_API_URL=https://gmail.googleapis.com
   ```

3. **Restart the development server** to load new environment variables:
   ```bash
   npm run dev
   ```

## Environment Variables

### Required Variables

- `VITE_APP_NAME`: Application name displayed in the UI (e.g., "Claine" or "Claine (Dev)")

### Optional Variables

- `VITE_API_URL`: Gmail API base URL (default: `https://gmail.googleapis.com`)
  - Development: Use local mock server or test endpoint
  - Production: `https://gmail.googleapis.com`

## GitHub Actions (CI)

Environment variables for CI builds are configured in `.github/workflows/ci.yml`.

To add secrets:

1. Go to **Repository Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**
3. Add name (e.g., `VITE_API_URL`) and value
4. Reference in workflow: `${{ secrets.VITE_API_URL }}`

See `.github/workflows/ci.yml` for current configuration.

## Vercel Deployment

Environment variables for Vercel deployments should be configured in the Vercel dashboard.

To configure:

1. Go to your project in the **Vercel Dashboard**
2. Navigate to **Project Settings** → **Environment Variables**
3. Add variables for each environment:
   - **Production**: Live deployment on main branch
   - **Preview**: Pull request and branch deployments
   - **Development**: Local development (not typically needed)

### Required Vercel Variables

- `VITE_APP_NAME`: Set to "Claine" for production

### Future Variables (Epic 1+)

When Gmail API integration is added:

- `VITE_API_URL`: Gmail API endpoint (default already set)

## Troubleshooting

### Error: Missing required environment variable

If you see this error:

```
Missing required environment variable: VITE_APP_NAME
```

**Solution:**

1. Ensure you have a `.env` file in the project root
2. Verify `.env` contains `VITE_APP_NAME=...`
3. Restart your development server

### Environment variables not updating

Vite loads `.env` files at startup. After changing environment variables:

1. Stop the dev server (Ctrl+C)
2. Restart: `npm run dev`

## Notes

- All client-side variables must use the `VITE_` prefix
- `.env` files are gitignored and should never be committed
- The `.env.example` file shows all available variables with placeholder values
- Environment variable validation runs on app startup (see `src/lib/env.ts`)

## References

- [Vite Environment Variables](https://vite.dev/guide/env-and-mode.html)
- [GitHub Actions Encrypted Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)
- Story documentation: `docs/stories/0-8-set-up-environment-variable-management.md`
