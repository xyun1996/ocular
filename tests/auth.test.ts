import { describe, expect, test } from "vitest";
import { authorizeHeaders, createUnauthorizedResponse } from "../src/auth.js";

describe("HTTP auth", () => {
  test("accepts Authorization Bearer token", () => {
    expect(
      authorizeHeaders(
        new Headers({ Authorization: "Bearer secret-token" }),
        { token: "secret-token", headerName: "authorization", scheme: "Bearer" }
      )
    ).toBe(true);
  });

  test("rejects missing or wrong Authorization token", () => {
    expect(
      authorizeHeaders(new Headers(), { token: "secret-token", headerName: "authorization", scheme: "Bearer" })
    ).toBe(false);
    expect(
      authorizeHeaders(
        new Headers({ Authorization: "Bearer wrong" }),
        { token: "secret-token", headerName: "authorization", scheme: "Bearer" }
      )
    ).toBe(false);
  });

  test("accepts custom raw token header", () => {
    expect(
      authorizeHeaders(
        new Headers({ "x-mcp-token": "secret-token" }),
        { token: "secret-token", headerName: "x-mcp-token", scheme: "" }
      )
    ).toBe(true);
  });

  test("unauthorized response does not expose token details", () => {
    expect(createUnauthorizedResponse()).toEqual({
      error: "Unauthorized",
      message: "Missing or invalid MCP authentication token."
    });
  });
});
