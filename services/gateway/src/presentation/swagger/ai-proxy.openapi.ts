import type { OpenAPIObject } from '@nestjs/swagger';

const PROXY_NOTE =
  'Proxied to the AI service. Request handling, validation, and business logic are owned by @auvora/ai-service.';

function proxyPath(method: string, summary: string, tag: string) {
  return {
    [method.toLowerCase()]: {
      tags: [tag],
      summary,
      description: PROXY_NOTE,
      responses: {
        default: {
          description: 'Response forwarded from AI service',
        },
      },
    },
  };
}

export function buildAiProxyOpenApiPaths(): OpenAPIObject['paths'] {
  const userTag = 'ai-proxy';
  const adminTag = 'ai-admin-proxy';

  return {
    '/api/v1/ai/chat': proxyPath('post', 'Send a chat message', userTag),
    '/api/v1/ai/conversations': proxyPath('get', 'List own conversations', userTag),
    '/api/v1/ai/conversations/{id}': proxyPath('get', 'Get conversation with messages', userTag),
    '/api/v1/ai/knowledge/search': proxyPath('post', 'Search knowledge base', userTag),
    '/api/v1/ai/assistants': proxyPath('get', 'List available assistants', userTag),
    '/api/v1/ai/messages/{id}/feedback': proxyPath('post', 'Submit message feedback', userTag),
    '/api/v1/admin/ai/dashboard': proxyPath('get', 'AI platform dashboard', adminTag),
    '/api/v1/admin/ai/providers': {
      ...proxyPath('get', 'List AI providers', adminTag),
      ...proxyPath('post', 'Upsert AI provider (existing providerType)', adminTag),
    },
    '/api/v1/admin/ai/providers/{code}': proxyPath('patch', 'Update AI provider priority/name/model', adminTag),
    '/api/v1/admin/ai/providers/{code}/enable': proxyPath('post', 'Enable AI provider', adminTag),
    '/api/v1/admin/ai/providers/{code}/disable': proxyPath('post', 'Disable AI provider', adminTag),
    '/api/v1/admin/ai/prompts': proxyPath('get', 'List prompt templates', adminTag),
    '/api/v1/admin/ai/prompts/{id}/submit': proxyPath('post', 'Submit prompt for approval', adminTag),
    '/api/v1/admin/ai/prompts/{id}/approve': proxyPath('post', 'Approve prompt template', adminTag),
    '/api/v1/admin/ai/prompts/{id}/reject': proxyPath('post', 'Reject pending prompt', adminTag),
    '/api/v1/admin/ai/prompts/{id}/rollback': proxyPath('post', 'Rollback prompt to prior version', adminTag),
    '/api/v1/admin/ai/knowledge/sources': proxyPath('get', 'List knowledge sources', adminTag),
    '/api/v1/admin/ai/usage': proxyPath('get', 'AI usage, latency, cache hit rate & estimated cost', adminTag),
    '/api/v1/admin/ai/conversations': proxyPath('get', 'Admin conversation browser', adminTag),
  };
}
