# AI API Keys Setup Guide

## Overview

AURA uses AI models (OpenAI GPT-4o and Anthropic Claude 3.5 Sonnet) to generate tests and analyze code. **API keys are required** for the AI features to work properly.

## Current Status

The project **is designed to send requests to AI models**, but it requires API keys to be configured. Without API keys, the system falls back to template/mock generation.

## Setup Instructions

### 1. Get API Keys

#### OpenAI API Key
1. Go to https://platform.openai.com/api-keys
2. Sign up or log in
3. Create a new API key
4. Copy the key (starts with `sk-...`)

#### Anthropic (Claude) API Key
1. Go to https://console.anthropic.com/
2. Sign up or log in
3. Navigate to API Keys section
4. Create a new API key
5. Copy the key (starts with `sk-ant-...`)

### 2. Configure Environment Variables

Create a `.env` file in the `backend/` directory:

```bash
cd backend
touch .env
```

Add your API keys to the `.env` file:

```env
# OpenAI API Configuration
OPENAI_API_KEY=sk-your-openai-key-here

# Anthropic (Claude) API Configuration
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key-here

# AI Model Preferences
PREFERRED_AI_PROVIDER=openai
OPENAI_MODEL=gpt-4o
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022
```

### 3. Verify Configuration

Check if API keys are configured by calling the models endpoint:

```bash
curl http://localhost:8000/api/v1/models/current
```

You should see:
```json
{
  "openai_available": true,
  "anthropic_available": true,
  ...
}
```

If `openai_available` or `anthropic_available` is `false`, the API key is not configured correctly.

## How It Works

### With API Keys Configured
1. ✅ **Real AI Requests**: The system sends actual requests to OpenAI/Anthropic APIs
2. ✅ **Complete Test Generation**: AI generates full, runnable test code
3. ✅ **Intelligent Analysis**: AI-powered code analysis and issue detection
4. ✅ **Model Selection**: You can choose between different AI models

### Without API Keys (Fallback Mode)
1. ⚠️ **Template Generation**: Falls back to basic template tests
2. ⚠️ **Limited Analysis**: Uses pattern-based analysis only
3. ⚠️ **No AI Features**: Advanced AI features won't work

## Testing API Connection

### Check Backend Logs

When you generate a test, check the backend console. You should see:
- **With API keys**: Actual API requests being made
- **Without API keys**: "Error generating tests with OpenAI/Claude" messages, then fallback to templates

### Test API Endpoint

```bash
# Test if OpenAI is working
curl -X POST http://localhost:8000/api/v1/tests/generate \
  -H "Content-Type: application/json" \
  -d '{
    "code": "def add(a, b): return a + b",
    "language": "python"
  }'
```

If API keys are configured, you'll get complete test code. If not, you'll get template code.

## Troubleshooting

### Issue: Tests are showing templates/placeholders

**Solution**: API keys are not configured. Follow the setup instructions above.

### Issue: "OpenAI API key not configured" error

**Solution**: 
1. Check that `.env` file exists in `backend/` directory
2. Verify the API key is correct (no extra spaces)
3. Restart the backend server after adding keys

### Issue: API requests failing

**Possible causes**:
1. Invalid API key
2. Insufficient API credits/quota
3. Network issues
4. API service outage

**Solution**: Check API key validity and account status on the provider's dashboard.

## Cost Considerations

- **OpenAI GPT-4o**: ~$2.50 per 1M input tokens, ~$10 per 1M output tokens
- **Anthropic Claude 3.5 Sonnet**: ~$3 per 1M input tokens, ~$15 per 1M output tokens

For typical test generation:
- Small file (< 100 lines): ~$0.01-0.05 per generation
- Medium file (100-500 lines): ~$0.05-0.20 per generation
- Large file (500+ lines): ~$0.20-0.50 per generation

## Security Notes

⚠️ **Never commit `.env` file to git!**

The `.env` file is already in `.gitignore` to prevent accidental commits. Always keep your API keys secret.

