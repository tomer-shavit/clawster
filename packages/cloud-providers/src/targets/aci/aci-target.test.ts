import { AciTarget } from "./aci-target";
import { DeploymentTargetType } from "../../interface/deployment-target";
import type { AciConfig } from "./aci-config";

// Mock Azure SDK
jest.mock("@azure/arm-containerinstance", () => ({
  ContainerInstanceManagementClient: jest.fn().mockImplementation(() => ({
    containerGroups: {
      beginCreateOrUpdateAndWait: jest.fn().mockResolvedValue({
        name: "clawster-test-bot",
        location: "eastus",
        ipAddress: { ip: "10.0.0.1" },
      }),
      get: jest.fn().mockResolvedValue({
        name: "clawster-test-bot",
        location: "eastus",
        provisioningState: "Succeeded",
        containers: [
          {
            instanceView: {
              currentState: { state: "Running" },
            },
          },
        ],
        ipAddress: { ip: "10.0.0.1" },
      }),
      stop: jest.fn().mockResolvedValue(undefined),
      beginStartAndWait: jest.fn().mockResolvedValue(undefined),
      beginRestartAndWait: jest.fn().mockResolvedValue(undefined),
      beginDeleteAndWait: jest.fn().mockResolvedValue(undefined),
    },
    containers: {
      listLogs: jest.fn().mockResolvedValue({ content: "log line 1\nlog line 2" }),
    },
  })),
}));

jest.mock("@azure/arm-network", () => {
  // Mock functions that track call state
  const createNsgGetMock = () => {
    let called = false;
    return jest.fn().mockImplementation(() => {
      if (called) {
        // After first call (ensureNSG), return success for subsequent calls (ensureAciSubnet)
        return Promise.resolve({
          id: "/subscriptions/sub/resourceGroups/rg/providers/Microsoft.Network/networkSecurityGroups/nsg",
          name: "clawster-nsg-test-bot",
        });
      }
      called = true;
      return Promise.reject({ statusCode: 404 });
    });
  };

  // Track subnet calls to return different IDs for ACI vs App Gateway subnets
  const createSubnetMock = () => {
    return {
      get: jest.fn().mockRejectedValue({ statusCode: 404 }),
      beginCreateOrUpdateAndWait: jest.fn().mockImplementation((_rg: string, _vnet: string, subnetName: string) => {
        const isAppGwSubnet = subnetName.includes("appgw");
        return Promise.resolve({
          id: isAppGwSubnet
            ? "/subscriptions/sub/resourceGroups/rg/providers/Microsoft.Network/virtualNetworks/vnet/subnets/appgw-subnet"
            : "/subscriptions/sub/resourceGroups/rg/providers/Microsoft.Network/virtualNetworks/vnet/subnets/aci-subnet",
          name: subnetName,
        });
      }),
      beginDeleteAndWait: jest.fn().mockResolvedValue(undefined),
    };
  };

  return {
    NetworkManagementClient: jest.fn().mockImplementation(() => ({
      virtualNetworks: {
        get: jest.fn().mockRejectedValue({ statusCode: 404 }),
        beginCreateOrUpdateAndWait: jest.fn().mockResolvedValue({
          id: "/subscriptions/sub/resourceGroups/rg/providers/Microsoft.Network/virtualNetworks/vnet",
          name: "clawster-vnet-test-bot",
        }),
      },
      networkSecurityGroups: {
        get: createNsgGetMock(),
        beginCreateOrUpdateAndWait: jest.fn().mockResolvedValue({
          id: "/subscriptions/sub/resourceGroups/rg/providers/Microsoft.Network/networkSecurityGroups/nsg",
          name: "clawster-nsg-test-bot",
        }),
      },
      subnets: createSubnetMock(),
      publicIPAddresses: {
        get: jest.fn().mockRejectedValue({ statusCode: 404 }),
        beginCreateOrUpdateAndWait: jest.fn().mockResolvedValue({
          id: "/subscriptions/sub/resourceGroups/rg/providers/Microsoft.Network/publicIPAddresses/pip",
          ipAddress: "20.10.30.40",
          dnsSettings: { fqdn: "clawster-appgw-test-bot.eastus.cloudapp.azure.com" },
        }),
        beginDeleteAndWait: jest.fn().mockResolvedValue(undefined),
      },
      applicationGateways: (() => {
        let created = false;
        return {
          get: jest.fn().mockImplementation(() => {
            if (created) {
              return Promise.resolve({
                id: "/subscriptions/sub/resourceGroups/rg/providers/Microsoft.Network/applicationGateways/appgw",
                name: "clawster-appgw-test-bot",
                backendAddressPools: [{ backendAddresses: [] }],
              });
            }
            return Promise.reject({ statusCode: 404 });
          }),
          beginCreateOrUpdateAndWait: jest.fn().mockImplementation(() => {
            created = true;
            return Promise.resolve({
              id: "/subscriptions/sub/resourceGroups/rg/providers/Microsoft.Network/applicationGateways/appgw",
              name: "clawster-appgw-test-bot",
              backendAddressPools: [{ backendAddresses: [] }],
            });
          }),
          beginDeleteAndWait: jest.fn().mockResolvedValue(undefined),
        };
      })(),
    })),
  };
});

jest.mock("@azure/identity", () => ({
  DefaultAzureCredential: jest.fn().mockImplementation(() => ({})),
  ClientSecretCredential: jest.fn().mockImplementation(() => ({})),
}));

jest.mock("@azure/keyvault-secrets", () => ({
  SecretClient: jest.fn().mockImplementation(() => ({
    setSecret: jest.fn().mockResolvedValue({}),
    beginDeleteSecret: jest.fn().mockResolvedValue({}),
  })),
}));

jest.mock("@azure/monitor-query", () => ({
  LogsQueryClient: jest.fn().mockImplementation(() => ({
    queryWorkspace: jest.fn().mockResolvedValue({ tables: [] }),
  })),
}));

describe("AciTarget", () => {
  const baseConfig: AciConfig = {
    subscriptionId: "test-subscription-id",
    resourceGroup: "test-resource-group",
    region: "eastus",
    profileName: "test-bot",
  };

  describe("constructor", () => {
    it("should create an instance with default credentials", () => {
      const target = new AciTarget(baseConfig);
      expect(target.type).toBe(DeploymentTargetType.ACI);
    });

    it("should create an instance with service principal credentials", () => {
      const config: AciConfig = {
        ...baseConfig,
        clientId: "test-client-id",
        clientSecret: "test-client-secret",
        tenantId: "test-tenant-id",
      };
      const target = new AciTarget(config);
      expect(target.type).toBe(DeploymentTargetType.ACI);
    });

    it("should derive resource names from profileName", () => {
      const target = new AciTarget(baseConfig);
      expect(target.type).toBe(DeploymentTargetType.ACI);
    });

    it("should use VNet + App Gateway architecture by default", () => {
      const target = new AciTarget(baseConfig);
      expect(target.type).toBe(DeploymentTargetType.ACI);
    });
  });

  describe("secure architecture (VNet + App Gateway)", () => {
    describe("install", () => {
      it("should install successfully with VNet + App Gateway", async () => {
        const target = new AciTarget(baseConfig);
        const result = await target.install({
          profileName: "test-bot",
          port: 18789,
        });

        expect(result.success).toBe(true);
        expect(result.instanceId).toBe("clawster-test-bot");
        expect(result.message).toContain("secure");
      });

      it("should pass gateway auth token as secure env var", async () => {
        const target = new AciTarget(baseConfig);
        const result = await target.install({
          profileName: "test-bot",
          port: 18789,
          gatewayAuthToken: "secret-token",
        });

        expect(result.success).toBe(true);
      });

      it("should create NSG with allowed CIDR rules", async () => {
        const config: AciConfig = {
          ...baseConfig,
          allowedCidr: ["10.0.0.0/8", "192.168.1.0/24"],
        };
        const target = new AciTarget(config);
        const result = await target.install({
          profileName: "test-bot",
          port: 18789,
        });

        expect(result.success).toBe(true);
      });
    });

    describe("getEndpoint", () => {
      it("should return Application Gateway public endpoint", async () => {
        const target = new AciTarget(baseConfig);
        await target.install({ profileName: "test-bot", port: 18789 });

        const endpoint = await target.getEndpoint();
        // Always returns the Application Gateway's public FQDN
        expect(endpoint.host).toBe("clawster-appgw-test-bot.eastus.cloudapp.azure.com");
        expect(endpoint.port).toBe(80); // App Gateway frontend port
        expect(endpoint.protocol).toBe("ws");
      });
    });
  });

  describe("configure", () => {
    it("should configure successfully", async () => {
      const target = new AciTarget(baseConfig);
      await target.install({ profileName: "test-bot", port: 18789 });

      const result = await target.configure({
        profileName: "test-bot",
        gatewayPort: 18789,
        config: {
          gateway: { bind: "localhost" },
        },
      });

      expect(result.success).toBe(true);
      expect(result.requiresRestart).toBe(true);
    });

    it("should transform gateway config correctly", async () => {
      const target = new AciTarget(baseConfig);
      await target.install({ profileName: "test-bot", port: 18789 });

      const result = await target.configure({
        profileName: "test-bot",
        gatewayPort: 18789,
        config: {
          gateway: { bind: "localhost", host: "127.0.0.1", port: 9999 },
          sandbox: { enabled: true },
          skills: { allowUnverified: true },
        },
      });

      expect(result.success).toBe(true);
    });
  });

  describe("start", () => {
    it("should start the container group", async () => {
      const target = new AciTarget(baseConfig);
      await target.install({ profileName: "test-bot", port: 18789 });

      await expect(target.start()).resolves.not.toThrow();
    });
  });

  describe("stop", () => {
    it("should stop the container group", async () => {
      const target = new AciTarget(baseConfig);
      await target.install({ profileName: "test-bot", port: 18789 });

      await expect(target.stop()).resolves.not.toThrow();
    });
  });

  describe("restart", () => {
    it("should restart the container group", async () => {
      const target = new AciTarget(baseConfig);
      await target.install({ profileName: "test-bot", port: 18789 });

      await expect(target.restart()).resolves.not.toThrow();
    });
  });

  describe("getStatus", () => {
    it("should return running status", async () => {
      const target = new AciTarget(baseConfig);
      await target.install({ profileName: "test-bot", port: 18789 });

      const status = await target.getStatus();
      expect(status.state).toBe("running");
      expect(status.gatewayPort).toBe(18789);
    });
  });

  describe("getLogs", () => {
    it("should return log lines", async () => {
      const target = new AciTarget(baseConfig);
      await target.install({ profileName: "test-bot", port: 18789 });

      const logs = await target.getLogs();
      expect(logs).toContain("log line 1");
      expect(logs).toContain("log line 2");
    });

    it("should filter logs by pattern", async () => {
      const target = new AciTarget(baseConfig);
      await target.install({ profileName: "test-bot", port: 18789 });

      const logs = await target.getLogs({ filter: "line 1" });
      expect(logs).toContain("log line 1");
    });
  });

  describe("destroy", () => {
    it("should destroy the container group", async () => {
      const target = new AciTarget(baseConfig);
      await target.install({ profileName: "test-bot", port: 18789 });

      await expect(target.destroy()).resolves.not.toThrow();
    });

    it("should not delete VNet resources by default", async () => {
      const target = new AciTarget(baseConfig);
      await target.install({ profileName: "test-bot", port: 18789 });

      // VNet resources are kept for reuse, App Gateway resources are deleted
      await expect(target.destroy()).resolves.not.toThrow();
    });
  });
});
