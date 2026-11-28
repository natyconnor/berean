import { describe, expect, it } from "vitest";
import { chooseBuildId } from "../../shared/build-id";

describe("chooseBuildId", () => {
  it("prefers a non-empty VERCEL_DEPLOYMENT_ID", () => {
    expect(
      chooseBuildId(
        {
          VERCEL_DEPLOYMENT_ID: "dpl_abc",
          VERCEL_GIT_COMMIT_SHA: "vercelsha",
          GITHUB_SHA: "githubsha",
        },
        "1.0.0",
      ),
    ).toBe("dpl_abc");
  });

  it("skips empty Vercel values and uses GITHUB_SHA", () => {
    expect(
      chooseBuildId(
        {
          VERCEL_DEPLOYMENT_ID: "",
          VERCEL_GIT_COMMIT_SHA: "",
          GITHUB_SHA: "githubsha",
        },
        "1.0.0",
      ),
    ).toBe("githubsha");
  });

  it("treats whitespace-only values as missing", () => {
    expect(
      chooseBuildId(
        {
          VERCEL_DEPLOYMENT_ID: "  ",
          VERCEL_GIT_COMMIT_SHA: "\n",
          GITHUB_SHA: "githubsha",
        },
        "1.0.0",
      ),
    ).toBe("githubsha");
  });

  it("falls back to VERCEL_GIT_COMMIT_SHA before GITHUB_SHA", () => {
    expect(
      chooseBuildId(
        {
          VERCEL_DEPLOYMENT_ID: "",
          VERCEL_GIT_COMMIT_SHA: "vercelsha",
          GITHUB_SHA: "githubsha",
        },
        "1.0.0",
      ),
    ).toBe("vercelsha");
  });

  it("falls back to a dev id when nothing is set", () => {
    expect(chooseBuildId({ GITHUB_SHA: " " }, "1.0.0")).toBe("dev-1.0.0");
  });
});
