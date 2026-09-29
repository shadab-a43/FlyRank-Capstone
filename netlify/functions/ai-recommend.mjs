const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "POST, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type",
};

function jsonResponse(statusCode, body) {
	return new Response(JSON.stringify(body), {
		status: statusCode,
		headers: {
			...corsHeaders,
			"Content-Type": "application/json",
		},
	});
}

function safeDiagnosticBody(value, redactions) {
	const sanitizedBody = redactions.reduce(
		(body, valueToRedact) => valueToRedact ? body.replaceAll(valueToRedact, "[redacted]") : body,
		value,
	);
	return sanitizedBody.slice(0, 1000);
}

const recommendationSchema = {
	type: "OBJECT",
	properties: {
		recommendations: {
			type: "ARRAY",
			minItems: 3,
			maxItems: 3,
			items: {
				type: "OBJECT",
				properties: {
					title: { type: "STRING" },
					year: { type: "INTEGER" },
					reason: { type: "STRING" },
					genres: {
						type: "ARRAY",
						items: { type: "STRING" },
					},
				},
				required: ["title", "year", "reason", "genres"],
			},
		},
	},
	required: ["recommendations"],
};

export default async function handler(request) {
	if (request.method === "OPTIONS") {
		return new Response(null, { status: 204, headers: corsHeaders });
	}

	if (request.method !== "POST") {
		return jsonResponse(405, { error: "Method not allowed" });
	}

	let body;
	try {
		body = await request.json();
	} catch {
		return jsonResponse(400, { error: "Invalid JSON body" });
	}

	if (typeof body?.prompt !== "string" || !body.prompt.trim()) {
		return jsonResponse(400, { error: "A non-empty prompt is required" });
	}

	const apiKey = process.env.GEMINI_API_KEY;
	if (!apiKey) {
		return jsonResponse(500, { error: "AI service is not configured" });
	}

	const prompt = body.prompt.trim();
	const recommendationPrompt = `Recommend exactly 3 movies for this request: ${prompt}. Keep each reason short and useful. Return only JSON matching the provided schema, with no Markdown or extra text.`;
	const diagnosticRedactions = [
		apiKey,
		prompt,
		JSON.stringify(prompt).slice(1, -1),
		recommendationPrompt,
	];

	try {
		const response = await fetch(
			"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent",
			{
			method: "POST",
			headers: {
				"x-goog-api-key": apiKey,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				contents: [
					{
						parts: [
							{
								text: recommendationPrompt,
							},
						],
					},
				],
				generationConfig: {
					responseMimeType: "application/json",
					responseSchema: recommendationSchema,
				},
			}),
			},
		);

		if (!response.ok) {
			const providerError = await response.text();
			console.error(
				response.status,
				response.statusText,
				safeDiagnosticBody(providerError, diagnosticRedactions),
			);
			return jsonResponse(502, { error: "AI recommendation request failed" });
		}

		const responseText = await response.text();
		let result;
		try {
			result = JSON.parse(responseText);
		} catch {
			console.error(
				"Gemini response JSON parse failed:",
				safeDiagnosticBody(responseText, diagnosticRedactions),
			);
			return jsonResponse(500, { error: "Unexpected error while generating recommendations" });
		}

		const recommendationText = result.candidates?.[0]?.content?.parts
			?.map((part) => part.text ?? "")
			.join("");
		if (typeof recommendationText !== "string" || !recommendationText.trim()) {
			return jsonResponse(502, { error: "AI recommendation response was invalid" });
		}

		let parsedRecommendation;
		try {
			parsedRecommendation = JSON.parse(recommendationText);
		} catch {
			console.error(
				"Gemini recommendation JSON parse failed:",
				safeDiagnosticBody(recommendationText, diagnosticRedactions),
			);
			return jsonResponse(502, { error: "AI recommendation response was invalid" });
		}

		const recommendations = parsedRecommendation?.recommendations;
		const isValidRecommendations =
			Array.isArray(recommendations) &&
			recommendations.length === 3 &&
			recommendations.every(
				(recommendation) =>
					typeof recommendation?.title === "string" &&
					recommendation.title.trim().length > 0 &&
					Number.isInteger(recommendation.year) &&
					typeof recommendation.reason === "string" &&
					recommendation.reason.trim().length > 0 &&
					Array.isArray(recommendation.genres) &&
					recommendation.genres.every(
						(genre) => typeof genre === "string" && genre.trim().length > 0,
					),
			);

		if (!isValidRecommendations) {
			return jsonResponse(502, { error: "AI recommendation response was invalid" });
		}

		return jsonResponse(200, { recommendations });
	} catch {
		return jsonResponse(500, { error: "Unexpected error while generating recommendations" });
	}
}
