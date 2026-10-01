import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveTheme, validateSettings } from '../.test-build/validation.js';
import aiRecommendHandler from '../netlify/functions/ai-recommend.mjs';

const TEST_API_KEY_PLACEHOLDER = 'test-only-placeholder';
const validRecommendations = [
  {
    title: 'Arrival',
    year: 2016,
    reason: 'Thoughtful science fiction with a strong emotional story.',
    genres: ['Science Fiction', 'Drama'],
  },
  {
    title: 'The Martian',
    year: 2015,
    reason: 'An adventurous space survival story.',
    genres: ['Science Fiction', 'Adventure'],
  },
  {
    title: 'Contact',
    year: 1997,
    reason: 'A curious, character-focused first-contact story.',
    genres: ['Science Fiction', 'Drama'],
  },
];

async function withTestGlobals(apiKey, fetchStub, runTest) {
  const previousApiKey = process.env.GEMINI_API_KEY;
  const previousFetch = globalThis.fetch;

  if (apiKey === null) {
    delete process.env.GEMINI_API_KEY;
  } else {
    process.env.GEMINI_API_KEY = apiKey;
  }
  globalThis.fetch = fetchStub;

  try {
    await runTest();
  } finally {
    globalThis.fetch = previousFetch;
    if (previousApiKey === undefined) {
      delete process.env.GEMINI_API_KEY;
    } else {
      process.env.GEMINI_API_KEY = previousApiKey;
    }
  }
}

function createRequest(method, body) {
  return new Request('http://localhost/api/ai-recommend', {
    method,
    ...(body === undefined
      ? {}
      : { body, headers: { 'Content-Type': 'application/json' } }),
  });
}

function createGeminiResponse(recommendations) {
  return new Response(
    JSON.stringify({
      candidates: [
        {
          content: {
            parts: [{ text: JSON.stringify({ recommendations }) }],
          },
        },
      ],
    }),
    { status: 200 },
  );
}

function createGeminiPayloadResponse(payload) {
  return new Response(JSON.stringify(payload), { status: 200 });
}

async function assertInvalidGeminiResponse(geminiResponse) {
  await withTestGlobals(TEST_API_KEY_PLACEHOLDER, async () => geminiResponse, async () => {
    const response = await aiRecommendHandler(
      createRequest('POST', JSON.stringify({ prompt: 'Adventure in space' })),
    );

    assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), {
      error: 'AI recommendation response was invalid',
    });
  });
}

const validValues = {
  name: 'Shadab',
  email: 'shadab@example.com',
  theme: 'system',
};

test('requires a name', () => {
  const errors = validateSettings({ ...validValues, name: '  ' });

  assert.equal(errors.name, 'Name is required.');
});

test('requires an email', () => {
  const errors = validateSettings({ ...validValues, email: '' });

  assert.equal(errors.email, 'Email is required.');
});

test('rejects an invalid email format', () => {
  const errors = validateSettings({ ...validValues, email: 'not-an-email' });

  assert.equal(errors.email, 'Enter a valid email address.');
});

test('accepts valid settings for every theme option', () => {
  for (const theme of ['light', 'dark', 'system']) {
    assert.deepEqual(validateSettings({ ...validValues, theme }), {});
  }
});

test('resolves light and dark themes directly', () => {
  assert.equal(resolveTheme('light', true), 'light');
  assert.equal(resolveTheme('dark', false), 'dark');
});

test('resolves the system theme from the system preference', () => {
  assert.equal(resolveTheme('system', false), 'light');
  assert.equal(resolveTheme('system', true), 'dark');
});

test('AI recommendation OPTIONS requests return 204', async () => {
  const response = await aiRecommendHandler(createRequest('OPTIONS'));

  assert.equal(response.status, 204);
});

test('AI recommendation rejects non-POST requests with 405', async () => {
  const response = await aiRecommendHandler(createRequest('GET'));

  assert.equal(response.status, 405);
});

test('AI recommendation rejects invalid JSON with 400', async () => {
  const response = await aiRecommendHandler(createRequest('POST', '{'));

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: 'Invalid JSON body' });
});

test('AI recommendation rejects missing and empty prompts with 400', async () => {
  await withTestGlobals(TEST_API_KEY_PLACEHOLDER, async () => {
    assert.fail('Fetch should not be called for an invalid prompt.');
  }, async () => {
    const missingPromptResponse = await aiRecommendHandler(
      createRequest('POST', JSON.stringify({})),
    );
    const emptyPromptResponse = await aiRecommendHandler(
      createRequest('POST', JSON.stringify({ prompt: '  ' })),
    );

    assert.equal(missingPromptResponse.status, 400);
    assert.equal(emptyPromptResponse.status, 400);
  });
});

test('AI recommendation returns 500 when GEMINI_API_KEY is missing', async () => {
  let fetchCalls = 0;

  await withTestGlobals(null, async () => {
    fetchCalls += 1;
    throw new Error('Unexpected fetch call');
  }, async () => {
    const response = await aiRecommendHandler(
      createRequest('POST', JSON.stringify({ prompt: 'Recommend science fiction' })),
    );

    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { error: 'AI service is not configured' });
  });

  assert.equal(fetchCalls, 0);
});

test('AI recommendation returns three validated recommendations on success', async () => {
  let fetchCalls = 0;

  await withTestGlobals(TEST_API_KEY_PLACEHOLDER, async () => {
    fetchCalls += 1;
    return createGeminiResponse(validRecommendations);
  }, async () => {
    const response = await aiRecommendHandler(
      createRequest('POST', JSON.stringify({ prompt: 'Adventure in space' })),
    );
    const result = await response.json();

    assert.equal(response.status, 200);
    assert.equal(result.recommendations.length, 3);
    assert.deepEqual(result.recommendations, validRecommendations);
  });

  assert.equal(fetchCalls, 1);
});

test('AI recommendation rejects an invalid Gemini response', async () => {
  await assertInvalidGeminiResponse(createGeminiResponse(validRecommendations.slice(0, 2)));
});

test('AI recommendation rejects Gemini responses with malformed envelopes or unusable content', async () => {
  await assertInvalidGeminiResponse(new Response('{', { status: 200 }));
  await assertInvalidGeminiResponse(createGeminiPayloadResponse({}));
  await assertInvalidGeminiResponse(createGeminiPayloadResponse({ candidates: [] }));
  await assertInvalidGeminiResponse(
    createGeminiPayloadResponse({ candidates: [{ content: { parts: [] } }] }),
  );
  await assertInvalidGeminiResponse(
    createGeminiPayloadResponse({ candidates: [{ content: { parts: [{ text: 42 }] } }] }),
  );
  await assertInvalidGeminiResponse(
    createGeminiPayloadResponse({ candidates: [{ content: { parts: [{ text: '{' }] } }] }),
  );
});

test('AI recommendation rejects invalid recommendation counts and fields', async () => {
  const invalidRecommendations = [
    validRecommendations.concat(validRecommendations[0]),
    validRecommendations.map((recommendation, index) =>
      index === 0 ? { ...recommendation, title: '  ' } : recommendation,
    ),
    validRecommendations.map((recommendation, index) =>
      index === 0 ? { ...recommendation, reason: '' } : recommendation,
    ),
    validRecommendations.map((recommendation, index) =>
      index === 0 ? { ...recommendation, year: '2016' } : recommendation,
    ),
    validRecommendations.map((recommendation, index) =>
      index === 0 ? { ...recommendation, genres: undefined } : recommendation,
    ),
    validRecommendations.map((recommendation, index) =>
      index === 0 ? { ...recommendation, genres: 'Drama' } : recommendation,
    ),
    validRecommendations.map((recommendation, index) =>
      index === 0 ? { ...recommendation, genres: ['Drama', 42] } : recommendation,
    ),
    validRecommendations.map((recommendation, index) =>
      index === 0 ? { ...recommendation, genres: ['Drama', '  '] } : recommendation,
    ),
  ];

  for (const recommendations of invalidRecommendations) {
    await assertInvalidGeminiResponse(createGeminiResponse(recommendations));
  }
});

test('AI recommendation returns a generic error when Gemini request fails', async () => {
  await withTestGlobals(
    TEST_API_KEY_PLACEHOLDER,
    async () => new Response('provider error details', { status: 503 }),
    async () => {
      const response = await aiRecommendHandler(
        createRequest('POST', JSON.stringify({ prompt: 'Adventure in space' })),
      );

      assert.equal(response.status, 502);
      assert.deepEqual(await response.json(), {
        error: 'AI recommendation request failed',
      });
    },
  );
});