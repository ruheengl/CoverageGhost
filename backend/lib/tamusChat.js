function getRequiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function getApiBaseUrl() {
  return (process.env.TAMUS_AI_CHAT_API_ENDPOINT || 'https://chat-api.tamu.ai').replace(/\/$/, '');
}

function getDefaultModel() {
  return process.env.TAMUS_AI_CHAT_MODEL || 'protected.gemini-2.0-flash-lite';
}

function normalizeMessageContent(content) {
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item?.type === 'text') return item.text || '';
        return '';
      })
      .join('\n')
      .trim();
  }

  return '';
}

function extractTextResponse(data) {
  const content = data?.choices?.[0]?.message?.content;
  const text = normalizeMessageContent(content);

  if (!text) {
    throw new Error(`Unexpected TAMUS AI response format: ${JSON.stringify(data)}`);
  }

  return text;
}

async function createChatCompletion({ messages, model = getDefaultModel(), temperature = 0 }) {
  const apiKey = getRequiredEnv('TAMUS_AI_CHAT_API_KEY');
  const response = await fetch(`${getApiBaseUrl()}/api/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      stream: false,
      temperature,
      messages,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error?.message || data?.message || `TAMUS AI request failed with status ${response.status}`);
  }

  return data;
}

function parseJsonResponse(text) {
  return JSON.parse(text.replace(/```json|```/g, '').trim());
}

function buildImageMessage({ promptText, imageBase64, mediaType = 'image/jpeg' }) {
  return {
    role: 'user',
    content: [
      {
        type: 'text',
        text: promptText,
      },
      {
        type: 'image_url',
        image_url: {
          url: `data:${mediaType};base64,${imageBase64}`,
        },
      },
    ],
  };
}

module.exports = {
  buildImageMessage,
  createChatCompletion,
  extractTextResponse,
  parseJsonResponse,
};
