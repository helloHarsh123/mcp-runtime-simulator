# Security Advisory

## Incident Summary
On March 5, 2026, it was discovered that sensitive API keys and credentials were exposed in the repository history. This affects the following services:

- Google Gemini API Key
- Azure OpenAI API Key and Endpoint
- GitHub Personal Access Token
- OpenAI API Key

## Immediate Actions Taken

1. **Hardcoded credentials removed**: The mcp.json file has been updated to use environment variables instead of hardcoded database credentials.

2. **Repository updated**: Commit `08a6acf` removes the sensitive information from the codebase.

## Required Actions

### 1. API Key Rotation
**IMMEDIATE ACTION REQUIRED**: All exposed API keys must be rotated immediately:

- **Google Gemini API Key**: Generate a new key in the Google Cloud Console
- **Azure OpenAI**: Regenerate the API key in the Azure portal
- **GitHub Personal Access Token**: Generate a new token in GitHub Settings > Developer settings > Personal access tokens
- **OpenAI API Key**: Generate a new key in your OpenAI account dashboard

### 2. Environment Setup
Create a proper `.env.local` file with your new credentials:

```bash
GEMINI_API_KEY=your_new_key_here
AZURE_OPENAI_ENDPOINT=your_endpoint_here
AZURE_OPENAI_KEY=your_new_key_here
AZURE_OPENAI_DEPLOYMENT=your_deployment_name
GITHUB_PERSONAL_ACCESS_TOKEN=your_new_token_here
OPENAI_API_KEY=your_new_key_here
PGUSER=your_postgres_user
PGPASSWORD=your_postgres_password
PGDATABASE=your_database_name
PGHOST=localhost
PGPORT=5432
```

### 3. Database Credentials
For PostgreSQL connection, set the following environment variables:
- PGUSER
- PGPASSWORD
- PGDATABASE
- PGHOST (optional, defaults to localhost)
- PGPORT (optional, defaults to 5432)

## Prevention Measures

1. **Never commit sensitive information** to version control
2. **Use environment variables** for all credentials and API keys
3. **Regular security audits** of codebase
4. **Implement pre-commit hooks** to scan for secrets
5. **Use secret scanning tools** to detect exposed credentials

## Contact
If you have any questions or need assistance with rotating credentials, please contact the repository maintainers.

**Last Updated**: March 5, 2026