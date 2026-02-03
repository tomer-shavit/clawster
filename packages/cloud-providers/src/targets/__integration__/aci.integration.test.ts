import { AciTarget } from "../aci/aci-target";
import type { DeploymentTarget } from "../../interface/deployment-target";
import {
  generateTestProfile,
  generateTestPort,
  buildTestConfig,
  cleanupTarget,
} from "./test-utils";

const HAS_AZURE_CREDS = !!(
  process.env.AZURE_SUBSCRIPTION_ID &&
  process.env.AZURE_RESOURCE_GROUP &&
  (process.env.AZURE_CLIENT_ID || process.env.AZURE_USE_DEFAULT_CREDENTIAL)
);

(HAS_AZURE_CREDS ? describe : describe.skip)(
  "ACI Target Integration",
  () => {
    let target: DeploymentTarget;
    let profile: string;
    let port: number;

    beforeAll(() => {
      profile = generateTestProfile();
      port = generateTestPort();

      target = new AciTarget({
        subscriptionId: process.env.AZURE_SUBSCRIPTION_ID!,
        resourceGroup: process.env.AZURE_RESOURCE_GROUP!,
        region: process.env.AZURE_REGION || "eastus",
        clientId: process.env.AZURE_CLIENT_ID,
        clientSecret: process.env.AZURE_CLIENT_SECRET,
        tenantId: process.env.AZURE_TENANT_ID,
        keyVaultName: process.env.AZURE_KEY_VAULT_NAME,
        logAnalyticsWorkspaceId: process.env.AZURE_LOG_ANALYTICS_WORKSPACE_ID,
        logAnalyticsWorkspaceKey: process.env.AZURE_LOG_ANALYTICS_WORKSPACE_KEY,
      });
    });

    afterAll(async () => {
      if (target) {
        await cleanupTarget(target);
      }
    });

    it("should install (create container group) successfully", async () => {
      const result = await target.install({
        profileName: profile,
        port,
      });

      expect(result.success).toBe(true);
      expect(result.instanceId).toBeTruthy();
    });

    it("should configure with test config", async () => {
      const testConfig = buildTestConfig(profile, port);
      const result = await target.configure(testConfig);

      expect(result.success).toBe(true);
    });

    it("should start the container group", async () => {
      await expect(target.start()).resolves.not.toThrow();
    });

    it("should report status", async () => {
      // ACI container groups take time to start
      await new Promise((r) => setTimeout(r, 30_000));

      const status = await target.getStatus();
      expect(["running", "stopped", "error"]).toContain(status.state);
    });

    it("should provide endpoint", async () => {
      const endpoint = await target.getEndpoint();
      expect(endpoint.port).toBeGreaterThan(0);
    });

    it("should stop gracefully", async () => {
      await expect(target.stop()).resolves.not.toThrow();
    });

    it("should destroy cleanly", async () => {
      await expect(target.destroy()).resolves.not.toThrow();
    });
  },
);
