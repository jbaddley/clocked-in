---
name: azure-login
description: Sign in to Azure CLI with this repo's service principal from local .env (AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_TENANT_ID). Use when the user or agent needs az login, App Service, Key Vault, or other Azure actions for ClockedIn.
---

# Azure login

Sign in as the `clockedin-cli-agent` service principal before any `az` command that needs a subscription.

## Login

From the repo root:

```bash
.cursor/skills/azure-login/scripts/login.sh
```

The script reads gitignored `.env` and runs `az login --service-principal`. Do not echo `AZURE_CLIENT_SECRET`. Do not pass `--query` that would print the secret.

If the script fails because variables are missing, tell the user to set `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, and `AZURE_TENANT_ID` in `.env`. Do not invent values.

If `az` is not installed: `brew install azure-cli`.

## After login

Confirm with `az account show` (subscription name and id only). Then run the requested Azure commands.

## Do not

- Commit `.env` or paste the client secret into chat, files, or GitHub
- Put these credentials in App Service settings (they are for local CLI only)
- Use interactive `az login` when the service principal vars are present
