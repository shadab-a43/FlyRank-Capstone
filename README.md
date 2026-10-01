# Movie Recommendation & Watchlist — AI-Powered Movie Discovery

## Overview

A responsive movie-discovery application for searching the OMDb catalog, viewing movie details, filtering search results by genre, and saving movies to a watchlist stored in the browser. It also accepts a natural-language prompt and returns AI-powered movie recommendations.

## Key Features

- Search for movies, series, and episodes using OMDb.
- Open a result to view its movie details.
- Save and remove movies from a watchlist persisted with `localStorage`.
- Filter search results by genre.
- Request movie recommendations with a natural-language prompt.
- Request structured AI output containing exactly three recommendations.
- Show loading and user-facing error states, and reject malformed recommendation responses.
- Use a responsive layout, keyboard-visible focus styles, and screen-reader status/error announcements.

## AI Integration

The recommendation request follows this flow:

```text
React frontend
  -> Netlify Function
  -> Gemini API
  -> structured JSON response
  -> validated recommendations
  -> React recommendation cards
```

The frontend sends the user's prompt to the Netlify Function. The function calls Gemini with a structured response schema, validates the returned data, and sends valid recommendations back to the frontend. The Gemini API key is read by the function from the server-side `GEMINI_API_KEY` environment variable; it is not hardcoded in the frontend.

## AI Response Structure

The function requests and validates exactly three recommendations. Each recommendation contains:

- `title`: movie title
- `year`: release year as an integer
- `reason`: a short explanation of why it matches
- `genres`: an array of genre strings

Responses with an unexpected shape or invalid recommendation data are rejected rather than rendered.

## Tech Stack

- React 19 and TypeScript
- Vite for the frontend development server and build
- React Router for client-side routes
- CSS for application styling
- OMDb API for movie search and details
- Netlify Functions and Netlify redirects for the AI endpoint
- Gemini API for AI recommendations
- Node.js built-in test runner and `oxlint` for automated tests and linting

## Project Structure

```text
.
├── netlify/
│   └── functions/
│       └── ai-recommend.mjs
├── public/
│   └── robots.txt
├── src/
│   ├── services/
│   │   └── omdbApi.ts
│   ├── types/
│   │   └── movie.ts
│   ├── App.tsx
│   ├── main.tsx
│   ├── styles.css
│   ├── validation.ts
│   └── vite-env.d.ts
├── tests/
│   └── validation.test.js
├── .env.example
├── index.html
├── LICENSE
├── netlify.toml
├── package.json
├── package-lock.json
├── tsconfig.json
├── tsconfig.test.json
└── vite.config.ts
```

## Local Setup

1. Install Node.js, which includes npm.
2. Install the project dependencies:

	```sh
	npm install
	```

3. Copy `.env.example` to `.env` and replace its placeholder values with your own OMDb and Gemini credentials. The required variable names are `VITE_OMDB_API_KEY` and `GEMINI_API_KEY`. `.env` is ignored by Git; do not commit it. Keep `GEMINI_API_KEY` server-side and configure it in Netlify's environment for deployment.
4. Start the Vite frontend development server:

	```sh
	npm run dev
	```

	Vite serves the frontend; it does not run the Netlify Function. To exercise the AI endpoint locally, use the Netlify CLI and its local development command, `netlify dev`.

5. Run automated tests:

	```sh
	npm test
	```

6. Run lint:

	```sh
	npm run lint
	```

7. Build the production frontend:

	```sh
	npm run build
	```

## Testing

The current automated test suite has **16 passing tests**. AI handler tests replace `fetch` with a stub, so tests do not make real Gemini API calls or require a real Gemini API key.

## Accessibility & Performance

The latest Lighthouse results are:

| Category | Score |
|---|---:|
| Performance | 100 |
| Accessibility | 100 |
| Best Practices | 100 |
| SEO | 100 |

## Deployment

The application is deployed on Netlify, with `capstone-ai` as the production branch. Netlify routes `/api/ai-recommend` to the `ai-recommend` function. Visit the [production site](https://flyrank-movie-recommendation.netlify.app/).

## Limitations

- AI recommendations depend on the availability of the external Gemini service and may be imperfect.
- Movie search and details depend on the availability of the OMDb service.

## Future Improvements

- Add browser-level tests for the main search, watchlist, and recommendation workflows.
- Add pagination for larger movie search result sets.
- Improve recommendation controls, such as allowing users to refine or regenerate results.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for the full license text.
