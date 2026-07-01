import { describe, expect, test, vi } from "vitest";
import { OpenAICompatibleVisionProvider } from "../src/providers/openai-compatible.js";

const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";
const PNG_DATA_URL = `data:image/png;base64,${PNG_BASE64}`;

describe("OpenAICompatibleVisionProvider", () => {
  test("sends OpenAI-compatible text and base64 image_url payload", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          choices: [{ message: { content: "{\"summary\":\"ok\"}" } }],
          usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 }
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    const provider = new OpenAICompatibleVisionProvider(
      {
        baseUrl: "https://api.example.com/v1",
        apiKey: "secret-key",
        model: "vision-model",
        headers: { "X-Test": "yes" },
        temperature: 0.1,
        maxTokens: 123,
        timeoutMs: 10_000
      },
      fetchMock
    );

    const result = await provider.analyze({
      imageDataUrl: PNG_DATA_URL,
      systemPrompt: "system",
      userPrompt: "user"
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const call = fetchMock.mock.calls.at(0);
    expect(call).toBeDefined();
    const [url, init] = call as unknown as [string, RequestInit];
    expect(url).toBe("https://api.example.com/v1/chat/completions");
    expect(init.headers).toMatchObject({
      Authorization: "Bearer secret-key",
      "Content-Type": "application/json",
      "X-Test": "yes"
    });

    const body = JSON.parse(String(init.body));
    expect(body.model).toBe("vision-model");
    expect(body.messages[1].content).toEqual(
      expect.arrayContaining([
        { type: "text", text: "user" },
        expect.objectContaining({
          type: "image_url",
          image_url: expect.objectContaining({
            url: PNG_DATA_URL
          })
        })
      ])
    );
    expect(consoleSpy).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      text: "{\"summary\":\"ok\"}",
      usage: { promptTokens: 1, completionTokens: 2, totalTokens: 3 }
    });
  });

  test("sends multiple base64 images as multiple image_url parts", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ choices: [{ message: { content: "{\"comparison\":\"ok\"}" } }] }), {
        status: 200,
        headers: { "content-type": "application/json" }
      })
    );
    const provider = new OpenAICompatibleVisionProvider(
      {
        baseUrl: "https://api.example.com/v1",
        apiKey: "secret-key",
        model: "vision-model",
        headers: {},
        temperature: 0.1,
        maxTokens: 123,
        timeoutMs: 10_000
      },
      fetchMock
    );

    await provider.analyze({
      imageDataUrls: [PNG_DATA_URL, PNG_DATA_URL],
      systemPrompt: "system",
      userPrompt: "compare"
    });

    const call = fetchMock.mock.calls.at(0);
    expect(call).toBeDefined();
    const [, init] = call as unknown as [string, RequestInit];
    const body = JSON.parse(String(init.body));
    const imageParts = body.messages[1].content.filter((part: { type: string }) => part.type === "image_url");
    expect(imageParts).toHaveLength(2);
    expect(imageParts[0].image_url.url).toBe(PNG_DATA_URL);
    expect(imageParts[1].image_url.url).toBe(PNG_DATA_URL);
  });
});
