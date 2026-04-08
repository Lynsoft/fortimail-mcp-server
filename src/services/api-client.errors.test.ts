import { describe, it, expect } from "vitest";
import { AxiosError } from "axios";
import { handleApiError } from "./api-client.js";

function axiosErr(status: number, data: unknown): AxiosError {
  const e = new AxiosError("fail");
  e.response = {
    status,
    data,
    statusText: "",
    headers: {},
    config: {} as never,
  };
  return e;
}

describe("handleApiError", () => {
  it("formats 401", () => {
    const t = handleApiError(axiosErr(401, {}));
    expect(t).toMatch(/FORTIMAIL_ENGINE_API_KEY/);
  });

  it("formats 403", () => {
    const t = handleApiError(axiosErr(403, {}));
    expect(t).toMatch(/Permission denied/);
  });

  it("formats 404", () => {
    const t = handleApiError(axiosErr(404, {}));
    expect(t).toMatch(/not found/i);
  });

  it("formats generic status with body", () => {
    const t = handleApiError(axiosErr(418, { x: 1 }));
    expect(t).toMatch(/418/);
  });

  it("formats non-Axios errors", () => {
    expect(handleApiError(new Error("plain"))).toMatch(/plain/);
  });
});
