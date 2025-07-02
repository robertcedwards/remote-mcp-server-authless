import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

// Define our MCP agent with tools
export class MyMCP extends McpAgent {
	server = new McpServer({
		name: "Heygen MCP",
		version: "1.0.0",
	});

	async init(heygenApiKey: string) {
		// Simple addition tool
		this.server.tool(
			"add",
			{ a: z.number(), b: z.number() },
			async ({ a, b }: { a: number; b: number }) => ({
				content: [{ type: "text", text: String(a + b) }],
			})
		);

		// Calculator tool with multiple operations
		this.server.tool(
			"calculate",
			{
				operation: z.enum(["add", "subtract", "multiply", "divide"]),
				a: z.number(),
				b: z.number(),
			},
			async ({ operation, a, b }: { operation: string; a: number; b: number }) => {
				let result: number = 0;
				switch (operation) {
					case "add":
						result = a + b;
						break;
					case "subtract":
						result = a - b;
						break;
					case "multiply":
						result = a * b;
						break;
					case "divide":
						if (b === 0)
							return {
								content: [
									{
										type: "text",
										text: "Error: Cannot divide by zero",
									},
								],
							};
						result = a / b;
						break;
				}
				return { content: [{ type: "text", text: String(result) }] };
			}
		);

		// HeyGen video creation tool
		this.server.tool(
			"create_heygen_video",
			{
				avatar_id: z.string(),
				voice_id: z.string(),
				input_text: z.string(),
				background: z.string().optional(), // e.g., "#008000"
			},
			async (
				{
					avatar_id,
					voice_id,
					input_text,
					background,
				}: { avatar_id: string; voice_id: string; input_text: string; background?: string }
			) => {
				const HEYGEN_API_KEY = heygenApiKey;
				const body = {
					video_inputs: [
						{
							character: {
								type: "avatar",
								avatar_id,
								avatar_style: "normal",
							},
							voice: {
								type: "text",
								input_text,
								voice_id,
							},
							background: background
								? { type: "color", value: background }
								: undefined,
						},
					],
					dimension: {
						width: 1280,
						height: 720,
					},
				};
				try {
					const response = await fetch("https://api.heygen.com/v2/video/generate", {
						method: "POST",
						headers: {
							"X-Api-Key": HEYGEN_API_KEY,
							"Content-Type": "application/json",
						},
						body: JSON.stringify(body),
					});
					if (!response.ok) {
						const errorText = await response.text();
						return {
							content: [
								{
									type: "text",
									text: `HeyGen API error: ${response.status} ${errorText}`,
								},
							],
						};
					}
					const data = (await response.json()) as any;
					if (data.error) {
						return {
							content: [
								{
									type: "text",
									text: `HeyGen API error: ${JSON.stringify(data.error)}`,
								},
							],
						};
					}
					return {
						content: [
							{
								type: "text",
								text: `HeyGen video created! video_id: ${data.data.video_id}`,
							},
						],
					};
				} catch (err) {
					return {
						content: [
							{
								type: "text",
								text: `Request failed: ${err}`,
							},
						],
					};
				}
			}
		);
	}
}

export default {
	async fetch(request: Request, env: Env & { HEYGEN_API_KEY: string }, ctx: ExecutionContext) {
		const url = new URL(request.url);

		if (url.pathname === "/sse" || url.pathname === "/sse/message") {
			const mcp = new MyMCP();
			await mcp.init(env.HEYGEN_API_KEY);
			return mcp.server.fetch(request, env, ctx);
		}

		if (url.pathname === "/mcp") {
			const mcp = new MyMCP();
			await mcp.init(env.HEYGEN_API_KEY);
			return mcp.server.fetch(request, env, ctx);
		}

		return new Response("Not found", { status: 404 });
	},
};
