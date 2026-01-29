import {
  PolicyPack,
  PolicyViolation,
  PolicySeverity,
} from "./policy-pack";

// ── Moltbot config shape (used for evaluation) ─────────────────────────
export interface MoltbotConfig {
  gateway?: {
    port?: number;
    auth?: {
      token?: string;
      password?: string;
    };
  };
  channels?: Array<{
    name?: string;
    dmPolicy?: string;
    groupPolicy?: string;
    [key: string]: unknown;
  }>;
  tools?: {
    profile?: string;
    elevated?: {
      enabled?: boolean;
      allowFrom?: string[];
    };
  };
  agents?: {
    defaults?: {
      sandbox?: {
        mode?: string;
      };
      workspace?: string;
      model?: {
        maxTokens?: number;
        temperature?: number;
        [key: string]: unknown;
      };
    };
  };
  filePermissions?: {
    configFileMode?: string;
    stateDirMode?: string;
  };
  [key: string]: unknown;
}

// ── Evaluation context ──────────────────────────────────────────────────
export interface MoltbotEvaluationContext {
  environment: "dev" | "staging" | "prod";
  /** Other instances used for cross-instance checks */
  otherInstances?: Array<{
    instanceId: string;
    workspace?: string;
    gatewayPort?: number;
  }>;
}

// ── Rule evaluation result ──────────────────────────────────────────────
export interface MoltbotRuleResult {
  passed: boolean;
  violation?: PolicyViolation;
}

// ── Built-in Moltbot Policy Packs ───────────────────────────────────────

export const MOLTBOT_SECURITY_BASELINE: PolicyPack = {
  id: "builtin-moltbot-security-baseline",
  name: "Moltbot Security Baseline",
  description: "Essential security policies for all Moltbot instances",
  isBuiltin: true,
  autoApply: true,
  rules: [
    {
      id: "moltbot-require-gateway-auth",
      name: "Require Gateway Authentication",
      description: "Gateway must have token or password authentication configured",
      type: "require_gateway_auth",
      severity: "ERROR",
      targetResourceTypes: ["instance"],
      enabled: true,
      allowOverride: false,
      config: {
        type: "require_gateway_auth",
        enabled: true,
      },
    },
    {
      id: "moltbot-require-dm-policy",
      name: "Require DM Policy",
      description: "DM policy must not be 'open' for security",
      type: "require_dm_policy",
      severity: "ERROR",
      targetResourceTypes: ["instance"],
      enabled: true,
      allowOverride: false,
      config: {
        type: "require_dm_policy",
        forbiddenValues: ["open"],
      },
    },
    {
      id: "moltbot-forbid-elevated-tools",
      name: "Restrict Elevated Tools",
      description: "Elevated tools must have allowFrom restrictions",
      type: "forbid_elevated_tools",
      severity: "WARNING",
      targetResourceTypes: ["instance"],
      enabled: true,
      allowOverride: true,
      config: {
        type: "forbid_elevated_tools",
        enabled: true,
      },
    },
    {
      id: "moltbot-require-workspace-isolation",
      name: "Require Workspace Isolation",
      description: "Each instance must have a unique workspace directory",
      type: "require_workspace_isolation",
      severity: "ERROR",
      targetResourceTypes: ["instance"],
      enabled: true,
      allowOverride: false,
      config: {
        type: "require_workspace_isolation",
        enabled: true,
      },
    },
  ],
  isEnforced: true,
  priority: 100,
  version: "1.0.0",
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: "system",
};

export const MOLTBOT_PRODUCTION_HARDENING: PolicyPack = {
  id: "builtin-moltbot-production-hardening",
  name: "Moltbot Production Hardening",
  description: "Production-specific security hardening for Moltbot instances",
  isBuiltin: true,
  autoApply: true,
  targetEnvironments: ["prod"],
  rules: [
    {
      id: "moltbot-require-sandbox",
      name: "Require Docker Sandbox",
      description: "Docker sandbox must be enabled in production",
      type: "require_sandbox",
      severity: "ERROR",
      targetResourceTypes: ["instance"],
      targetEnvironments: ["prod"],
      enabled: true,
      allowOverride: false,
      config: {
        type: "require_sandbox",
        enabled: true,
        allowedModes: ["docker", "container"],
      },
    },
    {
      id: "moltbot-limit-tool-profile",
      name: "Limit Tool Profile",
      description: "'full' tool profile is not allowed in production",
      type: "limit_tool_profile",
      severity: "WARNING",
      targetResourceTypes: ["instance"],
      targetEnvironments: ["prod"],
      enabled: true,
      allowOverride: true,
      config: {
        type: "limit_tool_profile",
        forbiddenProfiles: ["full"],
      },
    },
    {
      id: "moltbot-require-model-guardrails",
      name: "Require Model Guardrails",
      description: "Model configuration must meet production standards",
      type: "require_model_guardrails",
      severity: "WARNING",
      targetResourceTypes: ["instance"],
      targetEnvironments: ["prod"],
      enabled: true,
      allowOverride: true,
      config: {
        type: "require_model_guardrails",
        enabled: true,
        requireMaxTokens: true,
        requireTemperatureLimit: true,
        maxTemperature: 1.0,
      },
    },
    {
      id: "moltbot-forbid-open-group-policy",
      name: "Forbid Open Group Policy",
      description: "Group policy must not be 'open' in production",
      type: "forbid_open_group_policy",
      severity: "ERROR",
      targetResourceTypes: ["instance"],
      targetEnvironments: ["prod"],
      enabled: true,
      allowOverride: false,
      config: {
        type: "forbid_open_group_policy",
        forbiddenValues: ["open"],
      },
    },
  ],
  isEnforced: true,
  priority: 200,
  version: "1.0.0",
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: "system",
};

export const MOLTBOT_CHANNEL_SAFETY: PolicyPack = {
  id: "builtin-moltbot-channel-safety",
  name: "Moltbot Channel Safety",
  description: "Channel-level safety policies for Moltbot instances",
  isBuiltin: true,
  autoApply: true,
  rules: [
    {
      id: "moltbot-channel-dm-policy",
      name: "Channel DM Policy",
      description: "DM policy in production must be 'pairing' or 'allowlist'",
      type: "require_dm_policy",
      severity: "WARNING",
      targetResourceTypes: ["instance"],
      enabled: true,
      allowOverride: true,
      config: {
        type: "require_dm_policy",
        forbiddenValues: ["open"],
        allowedValues: ["pairing", "allowlist"],
      },
    },
    {
      id: "moltbot-require-port-spacing",
      name: "Require Port Spacing",
      description: "Gateway ports must have at least 20 port gap between instances",
      type: "require_port_spacing",
      severity: "ERROR",
      targetResourceTypes: ["instance"],
      enabled: true,
      allowOverride: false,
      config: {
        type: "require_port_spacing",
        minimumGap: 20,
      },
    },
  ],
  isEnforced: true,
  priority: 150,
  version: "1.0.0",
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: "system",
};

export const BUILTIN_MOLTBOT_POLICY_PACKS: PolicyPack[] = [
  MOLTBOT_SECURITY_BASELINE,
  MOLTBOT_PRODUCTION_HARDENING,
  MOLTBOT_CHANNEL_SAFETY,
];

// ── Evaluation functions ────────────────────────────────────────────────

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

export function evaluateRequireGatewayAuth(
  config: MoltbotConfig,
  ruleConfig: { enabled?: boolean; message?: string },
): MoltbotRuleResult {
  if (ruleConfig.enabled === false) {
    return { passed: true };
  }

  const hasToken = !!config.gateway?.auth?.token;
  const hasPassword = !!config.gateway?.auth?.password;

  if (!hasToken && !hasPassword) {
    return {
      passed: false,
      violation: {
        ruleId: "require_gateway_auth",
        ruleName: "Require Gateway Authentication",
        severity: "ERROR",
        message: ruleConfig.message || "Gateway must have token or password authentication configured",
        field: "gateway.auth",
        currentValue: config.gateway?.auth,
      },
    };
  }

  return { passed: true };
}

export function evaluateRequireDmPolicy(
  config: MoltbotConfig,
  ruleConfig: { forbiddenValues?: string[]; allowedValues?: string[]; message?: string },
): MoltbotRuleResult {
  const forbidden = ruleConfig.forbiddenValues || ["open"];
  const allowed = ruleConfig.allowedValues;
  const channels = config.channels || [];

  for (const channel of channels) {
    const dmPolicy = channel.dmPolicy;
    if (!dmPolicy) continue;

    if (forbidden.includes(dmPolicy)) {
      return {
        passed: false,
        violation: {
          ruleId: "require_dm_policy",
          ruleName: "Require DM Policy",
          severity: "ERROR",
          message: ruleConfig.message || `DM policy '${dmPolicy}' is not allowed. Forbidden values: ${forbidden.join(", ")}`,
          field: "channels.dmPolicy",
          currentValue: dmPolicy,
          suggestedValue: allowed ? allowed[0] : "pairing",
        },
      };
    }

    if (allowed && !allowed.includes(dmPolicy)) {
      return {
        passed: false,
        violation: {
          ruleId: "require_dm_policy",
          ruleName: "Require DM Policy",
          severity: "ERROR",
          message: ruleConfig.message || `DM policy '${dmPolicy}' is not in allowed values: ${allowed.join(", ")}`,
          field: "channels.dmPolicy",
          currentValue: dmPolicy,
          suggestedValue: allowed[0],
        },
      };
    }
  }

  return { passed: true };
}

export function evaluateRequireConfigPermissions(
  config: MoltbotConfig,
  ruleConfig: { configFileMode?: string; stateDirMode?: string; message?: string },
): MoltbotRuleResult {
  const expectedConfigMode = ruleConfig.configFileMode || "600";
  const expectedStateDirMode = ruleConfig.stateDirMode || "700";

  const configMode = config.filePermissions?.configFileMode;
  const stateMode = config.filePermissions?.stateDirMode;

  if (configMode && configMode !== expectedConfigMode) {
    return {
      passed: false,
      violation: {
        ruleId: "require_config_permissions",
        ruleName: "Require Config Permissions",
        severity: "ERROR",
        message: ruleConfig.message || `Config file permissions must be ${expectedConfigMode}, got ${configMode}`,
        field: "filePermissions.configFileMode",
        currentValue: configMode,
        suggestedValue: expectedConfigMode,
      },
    };
  }

  if (stateMode && stateMode !== expectedStateDirMode) {
    return {
      passed: false,
      violation: {
        ruleId: "require_config_permissions",
        ruleName: "Require Config Permissions",
        severity: "ERROR",
        message: ruleConfig.message || `State directory permissions must be ${expectedStateDirMode}, got ${stateMode}`,
        field: "filePermissions.stateDirMode",
        currentValue: stateMode,
        suggestedValue: expectedStateDirMode,
      },
    };
  }

  return { passed: true };
}

export function evaluateForbidElevatedTools(
  config: MoltbotConfig,
  ruleConfig: { enabled?: boolean; message?: string },
): MoltbotRuleResult {
  if (ruleConfig.enabled === false) {
    return { passed: true };
  }

  const elevated = config.tools?.elevated;
  if (elevated?.enabled && (!elevated.allowFrom || elevated.allowFrom.length === 0)) {
    return {
      passed: false,
      violation: {
        ruleId: "forbid_elevated_tools",
        ruleName: "Restrict Elevated Tools",
        severity: "WARNING",
        message: ruleConfig.message || "Elevated tools are enabled but no allowFrom restrictions are configured",
        field: "tools.elevated.allowFrom",
        currentValue: elevated.allowFrom,
      },
    };
  }

  return { passed: true };
}

export function evaluateRequireSandbox(
  config: MoltbotConfig,
  ruleConfig: { enabled?: boolean; allowedModes?: string[]; message?: string },
): MoltbotRuleResult {
  if (ruleConfig.enabled === false) {
    return { passed: true };
  }

  const sandboxMode = config.agents?.defaults?.sandbox?.mode;
  const allowedModes = ruleConfig.allowedModes || ["docker", "container"];

  if (!sandboxMode || sandboxMode === "off") {
    return {
      passed: false,
      violation: {
        ruleId: "require_sandbox",
        ruleName: "Require Docker Sandbox",
        severity: "ERROR",
        message: ruleConfig.message || `Sandbox mode must be one of: ${allowedModes.join(", ")}. Got: ${sandboxMode || "none"}`,
        field: "agents.defaults.sandbox.mode",
        currentValue: sandboxMode,
        suggestedValue: allowedModes[0],
      },
    };
  }

  if (!allowedModes.includes(sandboxMode)) {
    return {
      passed: false,
      violation: {
        ruleId: "require_sandbox",
        ruleName: "Require Docker Sandbox",
        severity: "ERROR",
        message: ruleConfig.message || `Sandbox mode '${sandboxMode}' is not allowed. Use one of: ${allowedModes.join(", ")}`,
        field: "agents.defaults.sandbox.mode",
        currentValue: sandboxMode,
        suggestedValue: allowedModes[0],
      },
    };
  }

  return { passed: true };
}

export function evaluateLimitToolProfile(
  config: MoltbotConfig,
  ruleConfig: { forbiddenProfiles?: string[]; message?: string },
): MoltbotRuleResult {
  const forbidden = ruleConfig.forbiddenProfiles || ["full"];
  const profile = config.tools?.profile;

  if (profile && forbidden.includes(profile)) {
    return {
      passed: false,
      violation: {
        ruleId: "limit_tool_profile",
        ruleName: "Limit Tool Profile",
        severity: "WARNING",
        message: ruleConfig.message || `Tool profile '${profile}' is not allowed. Forbidden profiles: ${forbidden.join(", ")}`,
        field: "tools.profile",
        currentValue: profile,
        suggestedValue: "standard",
      },
    };
  }

  return { passed: true };
}

export function evaluateRequireModelGuardrails(
  config: MoltbotConfig,
  ruleConfig: {
    enabled?: boolean;
    requireMaxTokens?: boolean;
    requireTemperatureLimit?: boolean;
    maxTemperature?: number;
    message?: string;
  },
): MoltbotRuleResult {
  if (ruleConfig.enabled === false) {
    return { passed: true };
  }

  const model = config.agents?.defaults?.model;

  if (ruleConfig.requireMaxTokens !== false && (!model || model.maxTokens === undefined)) {
    return {
      passed: false,
      violation: {
        ruleId: "require_model_guardrails",
        ruleName: "Require Model Guardrails",
        severity: "WARNING",
        message: ruleConfig.message || "Model maxTokens must be configured in production",
        field: "agents.defaults.model.maxTokens",
        currentValue: model?.maxTokens,
      },
    };
  }

  const maxTemp = ruleConfig.maxTemperature ?? 1.0;
  if (ruleConfig.requireTemperatureLimit !== false && model?.temperature !== undefined && model.temperature > maxTemp) {
    return {
      passed: false,
      violation: {
        ruleId: "require_model_guardrails",
        ruleName: "Require Model Guardrails",
        severity: "WARNING",
        message: ruleConfig.message || `Model temperature ${model.temperature} exceeds maximum ${maxTemp}`,
        field: "agents.defaults.model.temperature",
        currentValue: model.temperature,
        suggestedValue: maxTemp,
      },
    };
  }

  return { passed: true };
}

export function evaluateRequireWorkspaceIsolation(
  config: MoltbotConfig,
  ruleConfig: { enabled?: boolean; message?: string },
  context?: MoltbotEvaluationContext,
): MoltbotRuleResult {
  if (ruleConfig.enabled === false) {
    return { passed: true };
  }

  const workspace = config.agents?.defaults?.workspace;

  if (!workspace) {
    return {
      passed: false,
      violation: {
        ruleId: "require_workspace_isolation",
        ruleName: "Require Workspace Isolation",
        severity: "ERROR",
        message: ruleConfig.message || "Instance must have a unique workspace directory configured",
        field: "agents.defaults.workspace",
        currentValue: workspace,
      },
    };
  }

  if (context?.otherInstances) {
    const duplicate = context.otherInstances.find((inst) => inst.workspace === workspace);
    if (duplicate) {
      return {
        passed: false,
        violation: {
          ruleId: "require_workspace_isolation",
          ruleName: "Require Workspace Isolation",
          severity: "ERROR",
          message: ruleConfig.message || `Workspace '${workspace}' is already used by instance '${duplicate.instanceId}'`,
          field: "agents.defaults.workspace",
          currentValue: workspace,
        },
      };
    }
  }

  return { passed: true };
}

export function evaluateRequirePortSpacing(
  config: MoltbotConfig,
  ruleConfig: { minimumGap?: number; message?: string },
  context?: MoltbotEvaluationContext,
): MoltbotRuleResult {
  const minimumGap = ruleConfig.minimumGap ?? 20;
  const port = config.gateway?.port;

  if (port === undefined || !context?.otherInstances) {
    return { passed: true };
  }

  for (const other of context.otherInstances) {
    if (other.gatewayPort === undefined) continue;
    const gap = Math.abs(port - other.gatewayPort);
    if (gap < minimumGap && gap > 0) {
      return {
        passed: false,
        violation: {
          ruleId: "require_port_spacing",
          ruleName: "Require Port Spacing",
          severity: "ERROR",
          message: ruleConfig.message || `Port ${port} is only ${gap} away from instance '${other.instanceId}' (port ${other.gatewayPort}). Minimum gap is ${minimumGap}`,
          field: "gateway.port",
          currentValue: port,
        },
      };
    }
  }

  return { passed: true };
}

export function evaluateForbidOpenGroupPolicy(
  config: MoltbotConfig,
  ruleConfig: { forbiddenValues?: string[]; message?: string },
): MoltbotRuleResult {
  const forbidden = ruleConfig.forbiddenValues || ["open"];
  const channels = config.channels || [];

  for (const channel of channels) {
    const groupPolicy = channel.groupPolicy;
    if (!groupPolicy) continue;

    if (forbidden.includes(groupPolicy)) {
      return {
        passed: false,
        violation: {
          ruleId: "forbid_open_group_policy",
          ruleName: "Forbid Open Group Policy",
          severity: "ERROR",
          message: ruleConfig.message || `Group policy '${groupPolicy}' is not allowed. Forbidden values: ${forbidden.join(", ")}`,
          field: "channels.groupPolicy",
          currentValue: groupPolicy,
          suggestedValue: "allowlist",
        },
      };
    }
  }

  return { passed: true };
}

// ── Main evaluation dispatcher ──────────────────────────────────────────

export function evaluateMoltbotRule(
  ruleType: string,
  config: MoltbotConfig,
  ruleConfig: Record<string, unknown>,
  context?: MoltbotEvaluationContext,
): MoltbotRuleResult {
  switch (ruleType) {
    case "require_gateway_auth":
      return evaluateRequireGatewayAuth(config, ruleConfig as any);
    case "require_dm_policy":
      return evaluateRequireDmPolicy(config, ruleConfig as any);
    case "require_config_permissions":
      return evaluateRequireConfigPermissions(config, ruleConfig as any);
    case "forbid_elevated_tools":
      return evaluateForbidElevatedTools(config, ruleConfig as any);
    case "require_sandbox":
      return evaluateRequireSandbox(config, ruleConfig as any);
    case "limit_tool_profile":
      return evaluateLimitToolProfile(config, ruleConfig as any);
    case "require_model_guardrails":
      return evaluateRequireModelGuardrails(config, ruleConfig as any);
    case "require_workspace_isolation":
      return evaluateRequireWorkspaceIsolation(config, ruleConfig as any, context);
    case "require_port_spacing":
      return evaluateRequirePortSpacing(config, ruleConfig as any, context);
    case "forbid_open_group_policy":
      return evaluateForbidOpenGroupPolicy(config, ruleConfig as any);
    default:
      return { passed: true };
  }
}

// ── Full pack evaluation ────────────────────────────────────────────────

export interface MoltbotPolicyEvaluationResult {
  packId: string;
  packName: string;
  instanceId: string;
  valid: boolean;
  violations: PolicyViolation[];
  warnings: PolicyViolation[];
  evaluatedAt: Date;
}

export function evaluateMoltbotPolicyPack(
  pack: PolicyPack,
  instanceId: string,
  config: MoltbotConfig,
  context?: MoltbotEvaluationContext,
): MoltbotPolicyEvaluationResult {
  const violations: PolicyViolation[] = [];
  const warnings: PolicyViolation[] = [];

  for (const rule of pack.rules) {
    if (!rule.enabled) continue;

    // Check environment targeting
    if (rule.targetEnvironments && context?.environment) {
      if (!rule.targetEnvironments.includes(context.environment)) {
        continue;
      }
    }

    const result = evaluateMoltbotRule(rule.type, config, rule.config as Record<string, unknown>, context);

    if (!result.passed && result.violation) {
      const violation: PolicyViolation = {
        ...result.violation,
        ruleId: rule.id,
        ruleName: rule.name,
        severity: rule.severity,
      };

      if (rule.severity === "ERROR") {
        violations.push(violation);
      } else {
        warnings.push(violation);
      }
    }
  }

  return {
    packId: pack.id,
    packName: pack.name,
    instanceId,
    valid: violations.length === 0,
    violations,
    warnings,
    evaluatedAt: new Date(),
  };
}
