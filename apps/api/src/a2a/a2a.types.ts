// A2A Protocol Types — Agent Card subset for Chunk 1
// Full JSON-RPC and Task types will be added in Chunk 2+

export interface AgentSkill {
  id: string;
  name: string;
  description?: string;
  tags?: string[];
  examples?: string[];
}

export interface AgentCapabilities {
  streaming: boolean;
  pushNotifications: boolean;
  stateTransitionHistory: boolean;
}

export interface AgentAuthentication {
  schemes: string[];
  credentials?: string;
}

export interface AgentCard {
  name: string;
  description: string;
  url: string;
  version: string;
  skills: AgentSkill[];
  capabilities: AgentCapabilities;
  authentication: AgentAuthentication;
  defaultInputModes: string[];
  defaultOutputModes: string[];
  provider?: {
    organization: string;
    url?: string;
  };
}
