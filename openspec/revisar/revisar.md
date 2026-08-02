# openclaw-configurator

- Que sólo se ponga el proveedor seleccionado en configurator, que pase lo mismo con Clawhub
- Revisar qué queda sobre Models (Ahora mismo , MiniMax y Ollama) : models y agents
```json
{
  "$schema": "https://docs.openclaw.ai/schema/openclaw.json",
  "bindings": [],
  "gateway": {
    "mode": "local",
    "auth": {
      "mode": "token",
      "token": "__GATEWAY_TOKEN__"
    },
    "controlUi": {
      "allowInsecureAuth": true,
      "dangerouslyDisableDeviceAuth": true
    },
    "http": {
      "endpoints": {
        "chatCompletions": {
          "enabled": true
        }
      }
    },
    "reload": {
      "mode": "hybrid"
    },
    "remote": {
      "token": "__GATEWAY_TOKEN__"
    }
  },
  "discovery": {
    "mdns": {
      "mode": "off"
    }
  },
  "channels": {
    "slack": {
      "enabled": false
    },
    "whatsapp": {
      "enabled": false
    }
  },
  "env": {},
  "logging": {
    "level": "info"
  },
  "session": {
    "dmScope": "per-channel-peer",
    "reset": {
      "mode": "daily",
      "atHour": 4,
      "idleMinutes": 10080
    },
    "maintenance": {
      "mode": "enforce",
      "pruneAfter": "30d",
      "maxEntries": 500
    },
    "agentToAgent": {
      "maxPingPongTurns": 5
    }
  },
  "agents": {
    "defaults": {
      "model": {
        "primary": "minimax/MiniMax-M3",
        "fallbacks": [
          "minimax/MiniMax-M2.7",
          "ollama/gemma4-gpu"
        ]
      },
      "models": {
        "minimax/MiniMax-M3": {
          "streaming": true
        },
        "minimax/MiniMax-M2.7": {
          "streaming": false
        }
      },
      "thinkingDefault": "off",
      "reasoningDefault": "off",
      "contextInjection": "continuation-skip",
      "bootstrapMaxChars": 25000,
      "bootstrapTotalMaxChars": 75000,
      "heartbeat": {
        "every": "55m"
      },
      "compaction": {
        "mode": "safeguard",
        "keepRecentTokens": 20000,
        "reserveTokens": 20000,
        "midTurnPrecheck": {
          "enabled": true
        }
      },
      "memorySearch": {
        "enabled": true,
        "provider": "none"
      },
      "subagents": {
        "maxSpawnDepth": 2,
        "maxChildrenPerAgent": 5,
        "maxConcurrent": 8,
        "runTimeoutSeconds": 1800,
        "archiveAfterMinutes": 60,
        "allowAgents": [
          "*"
        ],
        "delegationMode": "prefer"
      },
      "params": {
        "cacheRetention": "long"
      },
      "contextPruning": {
        "mode": "cache-ttl",
        "ttl": "1h"
      },
      "timeoutSeconds": 2700,
      "maxConcurrent": 6,
      "imageGenerationModel": {
        "primary": "minimax/image-01",
        "fallbacks": [
          "minimax-portal/image-01"
        ],
        "timeoutMs": 180000
      },
      "skipBootstrap": true
    },
    "list": []
  },
  "messages": {
    "tts": {
      "auto": "tagged",
      "modelOverrides": {
        "enabled": false
      },
      "provider": "minimax",
      "providers": {
        "elevenlabs": {
          "apiKey": {
            "source": "exec",
            "provider": "bridge_tokens",
            "id": "service:elevenlabs"
          },
          "voiceId": "1eHrpOW5l98cxiSRjbzJ",
          "languageCode": "es"
        },
        "minimax": {
          "apiKey": "${MINIMAX_API_KEY}",
          "baseUrl": "https://api.minimax.io",
          "model": "speech-2.6-turbo",
          "voiceId": "Spanish_SereneWoman",
          "speed": 1,
          "vol": 1,
          "pitch": 0
        }
      }
    }
  },
  "tools": {
    "profile": "coding",
    "alsoAllow": [
      "message",
      "tts",
      "exec"
    ],
    "deny": [
      "code_execution",
      "cron",
      "gateway",
      "nodes",
      "update_plan"
    ],
    "web": {
      "search": {
        "enabled": true
      }
    },
    "loopDetection": {
      "enabled": true,
      "detectors": {
        "pingPong": true,
        "genericRepeat": false,
        "knownPollNoProgress": false
      }
    }
  },
  "plugins": {
    "allow": [
      "whatsapp",
      "browser",
      "canvas",
      "device-pair",
      "file-transfer",
      "memory-core",
      "minimax",
      "phone-control",
      "talk-voice",
      "ollama",
      "duckduckgo",
      "brave",
      "openai",
      "acpx",
      "litellm",
      "xiaomi",
      "n8n",
      "config-guard",
      "fs-approval-guard",
      "spawn-cwd-guard",
      "web-egress-guard",
      "exec-guard",
      "asset-downloader"
    ],
    "load": {
      "paths": [
        "__STACK_ROOT__/autonomous-agents/plugins/n8n",
        "__STACK_ROOT__/autonomous-agents/plugins/config-guard",
        "__STACK_ROOT__/autonomous-agents/plugins/fs-approval-guard",
        "__STACK_ROOT__/autonomous-agents/plugins/spawn-cwd-guard",
        "__STACK_ROOT__/autonomous-agents/plugins/web-egress-guard",
        "__STACK_ROOT__/autonomous-agents/plugins/exec-guard",
        "__STACK_ROOT__/autonomous-agents/plugins/asset-downloader"
      ]
    },
    "deny": [
      "openai",
      "anthropic",
      "google",
      "groq",
      "mistral",
      "openrouter",
      "xai",
      "together",
      "deepseek",
      "github-copilot",
      "huggingface",
      "perplexity",
      "moonshot"
    ],
    "entries": {
      "xiaomi": {
        "enabled": true
      },
      "ollama": {
        "enabled": true
      },
      "duckduckgo": {
        "config": {
          "webSearch": {
            "region": "es-es",
            "safeSearch": "moderate"
          }
        },
        "enabled": true
      },
      "brave": {
        "enabled": true,
        "config": {
          "webSearch": {
            "apiKey": {
              "source": "exec",
              "provider": "bridge_tokens",
              "id": "service:brave"
            }
          }
        }
      },
      "openai": {
        "enabled": true
      },
      "acpx": {
        "enabled": true,
        "config": {
          "pluginToolsMcpBridge": false,
          "openClawToolsMcpBridge": false,
          "mcpServers": {}
        }
      },
      "n8n": {
        "enabled": true,
        "config": {
          "baseUrl": "",
          "apiKey": {
            "source": "exec",
            "provider": "bridge_tokens",
            "id": "service:n8n"
          }
        }
      },
      "browser": {
        "enabled": true
      },
      "whatsapp": {
        "enabled": true
      },
      "litellm": {
        "enabled": true
      },
      "minimax": {
        "enabled": true
      },
      "memory-core": {
        "config": {
          "dreaming": {
            "enabled": true,
            "frequency": "0 3 * * *"
          }
        }
      }
    }
  },
  "skills": {
    "load": {
      "extraDirs": [
        "__STACK_ROOT__/autonomous-agents/skills",
        "__STACK_ROOT__/autonomous-agents/overlays/hello-world/skills",
        "__STACK_ROOT__/ai-office/skills"
      ]
    },
    "entries": {
      "n8n_workflows": {
        "enabled": true
      },
      "jira-nttdata": {
        "enabled": false
      },
      "coding-agent": {
        "enabled": true
      },
      "github": {
        "enabled": true
      },
      "gh-issues": {
        "enabled": true
      },
      "clawflow": {
        "enabled": true
      },
      "clawflow-inbox-triage": {
        "enabled": true
      },
      "healthcheck": {
        "enabled": true
      },
      "model-usage": {
        "enabled": true
      },
      "nano-pdf": {
        "enabled": true
      },
      "session-logs": {
        "enabled": true
      },
      "skill-creator": {
        "enabled": true
      },
      "slack": {
        "enabled": true
      },
      "summarize": {
        "enabled": true
      },
      "xurl": {
        "enabled": true
      },
      "notion": {
        "enabled": true
      },
      "trello": {
        "enabled": true
      },
      "1password": {
        "enabled": false
      },
      "apple-notes": {
        "enabled": false
      },
      "apple-reminders": {
        "enabled": false
      },
      "bear-notes": {
        "enabled": false
      },
      "blogwatcher": {
        "enabled": false
      },
      "blucli": {
        "enabled": false
      },
      "bluebubbles": {
        "enabled": false
      },
      "camsnap": {
        "enabled": false
      },
      "canvas": {
        "enabled": false
      },
      "clawhub": {
        "enabled": false
      },
      "discord": {
        "enabled": false
      },
      "eightctl": {
        "enabled": false
      },
      "gemini": {
        "enabled": false
      },
      "gifgrep": {
        "enabled": false
      },
      "gog": {
        "enabled": false
      },
      "goplaces": {
        "enabled": false
      },
      "himalaya": {
        "enabled": false
      },
      "imsg": {
        "enabled": false
      },
      "mcporter": {
        "enabled": false
      },
      "node-connect": {
        "enabled": false
      },
      "obsidian": {
        "enabled": false
      },
      "openai-whisper": {
        "enabled": false
      },
      "openai-whisper-api": {
        "enabled": false
      },
      "openhue": {
        "enabled": false
      },
      "oracle": {
        "enabled": false
      },
      "ordercli": {
        "enabled": false
      },
      "peekaboo": {
        "enabled": false
      },
      "sag": {
        "enabled": false
      },
      "sherpa-onnx-tts": {
        "enabled": false
      },
      "songsee": {
        "enabled": false
      },
      "sonoscli": {
        "enabled": false
      },
      "spotify-player": {
        "enabled": false
      },
      "things-mac": {
        "enabled": false
      },
      "tmux": {
        "enabled": false
      },
      "video-frames": {
        "enabled": false
      },
      "voice-call": {
        "enabled": false
      },
      "wacli": {
        "enabled": false
      },
      "weather": {
        "enabled": false
      },
      "linkedin-post-method": {
        "enabled": true
      },
      "excel-professional-formatting": {
        "enabled": true
      },
      "pptx-professional-formatting": {
        "enabled": true
      },
      "docx-professional-formatting": {
        "enabled": true
      },
      "pdf-professional-processing": {
        "enabled": true
      },
      "audio-spot-production": {
        "enabled": true
      }
    },
    "workshop": {
      "autonomous": {
        "enabled": true
      },
      "approvalPolicy": "pending",
      "maxPending": 50,
      "maxSkillBytes": 40000
    }
  },
  "models": {
    "mode": "replace",
    "providers": {
      "ollama": {
        "baseUrl": "http://127.0.0.1:11434/v1",
        "apiKey": "ollama-local",
        "api": "openai-completions",
        "models": [
          {
            "id": "gemma4-gpu",
            "name": "Gemma 4 GPU (Ollama local)",
            "reasoning": false,
            "input": [
              "text",
              "image"
            ],
            "cost": {
              "input": 0,
              "output": 0,
              "cacheRead": 0,
              "cacheWrite": 0
            },
            "contextWindow": 65536,
            "maxTokens": 8192
          },
          {
            "id": "gemma4-assistant",
            "name": "Gemma 4 (Ollama local)",
            "reasoning": false,
            "input": [
              "text",
              "image"
            ],
            "cost": {
              "input": 0,
              "output": 0,
              "cacheRead": 0,
              "cacheWrite": 0
            },
            "contextWindow": 65536,
            "maxTokens": 8192
          },
          {
            "id": "qwen2.5-coder:7b",
            "name": "Qwen 2.5 Coder 7B (Ollama local, tools-capable)",
            "reasoning": false,
            "input": [
              "text"
            ],
            "cost": {
              "input": 0,
              "output": 0,
              "cacheRead": 0,
              "cacheWrite": 0
            },
            "contextWindow": 32768,
            "maxTokens": 8192
          },
          {
            "id": "qwen2.5-coder:14b",
            "name": "Qwen 2.5 Coder 14B (Ollama local, tools-capable)",
            "reasoning": false,
            "input": [
              "text"
            ],
            "cost": {
              "input": 0,
              "output": 0,
              "cacheRead": 0,
              "cacheWrite": 0
            },
            "contextWindow": 32768,
            "maxTokens": 8192
          },
          {
            "id": "minimax-m2:cloud",
            "name": "MiniMax M2 (Ollama cloud, tool_calls native)",
            "reasoning": true,
            "input": [
              "text"
            ],
            "cost": {
              "input": 0,
              "output": 0,
              "cacheRead": 0,
              "cacheWrite": 0
            },
            "contextWindow": 200000,
            "maxTokens": 32000
          }
        ]
      },
      "minimax": {
        "baseUrl": "https://api.minimax.io/anthropic",
        "apiKey": "${MINIMAX_API_KEY}",
        "api": "anthropic-messages",
        "models": [
          {
            "id": "MiniMax-M3",
            "name": "MiniMax M3",
            "reasoning": true,
            "compat": {
              "supportsPromptCacheKey": true
            },
            "input": [
              "text",
              "image"
            ],
            "cost": {
              "input": 0,
              "output": 0,
              "cacheRead": 0,
              "cacheWrite": 0
            },
            "contextWindow": 1000000,
            "maxTokens": 131072
          },
          {
            "id": "MiniMax-M2.7",
            "name": "MiniMax M2.7",
            "reasoning": true,
            "compat": {
              "supportsPromptCacheKey": true
            },
            "input": [
              "text",
              "image"
            ],
            "cost": {
              "input": 0,
              "output": 0,
              "cacheRead": 0,
              "cacheWrite": 0
            },
            "contextWindow": 1000000,
            "maxTokens": 131072
          }
        ],
        "timeoutSeconds": 300
      }
    }
  },
  "meta": {
    "lastTouchedVersion": "2026.6.1"
  },
  "mcp": {
    "sessionIdleTtlMs": 0,
    "servers": {}
  },
  "commands": {
    "ownerAllowFrom": []
  },
  "browser": {
    "ssrfPolicy": {
      "dangerouslyAllowPrivateNetwork": false,
      "allowedHostnames": ["localhost", "127.0.0.1"]
    },
    "enabled": true
  },
  "secrets": {
    "providers": {
      "bridge_tokens": {
        "source": "exec",
        "command": "__NODE_BIN__",
        "allowInsecurePath": true,
        "args": [
          "__STACK_ROOT__/autonomous-agents/work-console/bridge/scripts/secrets-exec-resolver.js"
        ],
        "passEnv": [
          "BRIDGE_DATA_DIR",
          "BRIDGE_ENCRYPTION_KEY",
          "HOME",
          "USERPROFILE",
          "APPDATA"
        ],
        "trustedDirs": [
          "__NODE_DIR__",
          "__STACK_ROOT__/autonomous-agents/work-console/bridge/scripts"
        ]
      }
    }
  },
  "wizard": {
    "lastRunMode": "local"
  },
  "cron": {
    "sessionRetention": "24h"
  }
}


```