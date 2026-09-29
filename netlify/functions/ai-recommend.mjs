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
				contents: [{ parts: [{ text: body.prompt.trim() }] }],
			}),
			},
		);

		if (!response.ok) {
			return jsonResponse(502, { error: "AI recommendation request failed" });
		}

		const result = await response.json();
		const recommendation = result.candidates?.[0]?.content?.parts
			?.map((part) => part.text ?? "")
			.join("");
		if (typeof recommendation !== "string" || !recommendation.trim()) {
			return jsonResponse(502, { error: "AI recommendation response was invalid" });
		}

		return jsonResponse(200, { recommendation });
	} catch {
		return jsonResponse(500, { error: "Unexpected error while generating recommendations" });
	}
}
