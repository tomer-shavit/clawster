import {
  buildGatewayProvider,
  rewriteModelRef,
  buildFallbackChain,
  injectGatewayIntoConfig,
} from "../provider-builder";
import type { AiGatewaySettings } from "../config";
import type { OpenClawFullConfig } from "../../openclaw-config";

describe("ai-gateway/provider-builder", () => {
  const baseSettings: AiGatewaySettings = {
    enabled: true,
    providerName: "vercel-ai-gateway",
    gatewayUrl: "https://gateway.vercel.ai/v1/proxy",
    gatewayApiKey: "gw-key-123",
    api: "anthropic-messages",
  };

  const baseConfig: OpenClawFullConfig = {
    channels: {},
    agents: {
      defaults: {
        model: {
          primary: "anthropic/claude-sonnet-4-20250514",
          fallbacks: ["openai/gpt-4o"],
        },
      },
    },
  };

  describe("buildGatewayProvider", () => {
    it("builds a provider config from settings", () => {
      const provider = buildGatewayProvider(baseSettings);

      expect(provider.baseUrl).toBe("https://gateway.vercel.ai/v1/proxy");
      expect(provider.apiKey).toBe("gw-key-123");
      expect(provider.auth).toBe("api_key");
      expect(provider.api).toBe("anthropic-messages");
    });

    it("throws when gatewayUrl is missing", () => {
      const settings: AiGatewaySettings = {
        ...baseSettings,
        gatewayUrl: undefined,
      };

      expect(() => buildGatewayProvider(settings)).toThrow(
        "AI Gateway URL is required when gateway is enabled"
      );
    });

    it("uses the specified API type", () => {
      const settings: AiGatewaySettings = {
        ...baseSettings,
        api: "openai-completions",
      };
      const provider = buildGatewayProvider(settings);
      expect(provider.api).toBe("openai-completions");
    });

    it("handles missing apiKey gracefully", () => {
      const settings: AiGatewaySettings = {
        ...baseSettings,
        gatewayApiKey: undefined,
      };
      const provider = buildGatewayProvider(settings);
      expect(provider.apiKey).toBeUndefined();
    });
  });

  describe("rewriteModelRef", () => {
    it("prepends the gateway provider name", () => {
      const result = rewriteModelRef(
        "anthropic/claude-sonnet-4-20250514",
        "vercel-ai-gateway"
      );
      expect(result).toBe("vercel-ai-gateway/anthropic/claude-sonnet-4-20250514");
    });

    it("works with custom provider names", () => {
      const result = rewriteModelRef(
        "openai/gpt-4o",
        "cloudflare-ai-gateway"
      );
      expect(result).toBe("cloudflare-ai-gateway/openai/gpt-4o");
    });
  });

  describe("buildFallbackChain", () => {
    it("creates fallback chain with original ref first", () => {
      const result = buildFallbackChain("anthropic/claude-sonnet-4-20250514");
      expect(result).toEqual(["anthropic/claude-sonnet-4-20250514"]);
    });

    it("appends existing fallbacks without duplicates", () => {
      const result = buildFallbackChain(
        "anthropic/claude-sonnet-4-20250514",
        ["openai/gpt-4o", "anthropic/claude-sonnet-4-20250514"]
      );
      expect(result).toEqual([
        "anthropic/claude-sonnet-4-20250514",
        "openai/gpt-4o",
      ]);
    });

    it("preserves existing fallbacks order", () => {
      const result = buildFallbackChain(
        "anthropic/claude-sonnet-4-20250514",
        ["openai/gpt-4o", "google/gemini-pro"]
      );
      expect(result).toEqual([
        "anthropic/claude-sonnet-4-20250514",
        "openai/gpt-4o",
        "google/gemini-pro",
      ]);
    });
  });

  describe("injectGatewayIntoConfig", () => {
    it("injects gateway provider and rewrites model ref when enabled", () => {
      const result = injectGatewayIntoConfig(baseConfig, baseSettings);

      // Should have models.providers with the gateway entry
      expect(result.models?.providers?.["vercel-ai-gateway"]).toBeDefined();
      expect(result.models.providers["vercel-ai-gateway"].baseUrl).toBe(
        "https://gateway.vercel.ai/v1/proxy"
      );

      // Model ref should be rewritten
      expect(result.agents?.defaults?.model?.primary).toBe(
        "vercel-ai-gateway/anthropic/claude-sonnet-4-20250514"
      );

      // Fallbacks should include original direct ref
      expect(result.agents?.defaults?.model?.fallbacks).toContain(
        "anthropic/claude-sonnet-4-20250514"
      );
      // And the original fallback
      expect(result.agents?.defaults?.model?.fallbacks).toContain("openai/gpt-4o");
    });

    it("returns config unchanged when disabled", () => {
      const settings: AiGatewaySettings = {
        ...baseSettings,
        enabled: false,
      };
      const result = injectGatewayIntoConfig(baseConfig, settings);
      expect(result).toEqual(baseConfig);
    });

    it("returns config unchanged when gatewayUrl is missing", () => {
      const settings: AiGatewaySettings = {
        ...baseSettings,
        gatewayUrl: undefined,
      };
      const result = injectGatewayIntoConfig(baseConfig, settings);
      expect(result).toEqual(baseConfig);
    });

    it("handles config with no model specified", () => {
      const configNoModel: OpenClawFullConfig = {
        channels: {},
      };
      const result = injectGatewayIntoConfig(configNoModel, baseSettings);

      // Should still add the gateway provider
      expect(result.models?.providers?.["vercel-ai-gateway"]).toBeDefined();

      // But should not crash on missing model
      expect(result.agents?.defaults?.model).toBeUndefined();
    });

    it("preserves existing models.providers", () => {
      const configWithProviders: OpenClawFullConfig = {
        ...baseConfig,
        models: {
          providers: {
            "custom-provider": {
              baseUrl: "https://custom.example.com",
              auth: "api_key",
              api: "openai-completions",
            },
          },
        },
      };

      const result = injectGatewayIntoConfig(configWithProviders, baseSettings);

      // Both providers should exist
      expect(result.models.providers["custom-provider"]).toBeDefined();
      expect(result.models.providers["vercel-ai-gateway"]).toBeDefined();
    });

    it("uses custom provider name", () => {
      const settings: AiGatewaySettings = {
        ...baseSettings,
        providerName: "cloudflare-ai-gateway",
      };
      const result = injectGatewayIntoConfig(baseConfig, settings);

      expect(result.models?.providers?.["cloudflare-ai-gateway"]).toBeDefined();
      expect(result.agents?.defaults?.model?.primary).toBe(
        "cloudflare-ai-gateway/anthropic/claude-sonnet-4-20250514"
      );
    });
  });
});
