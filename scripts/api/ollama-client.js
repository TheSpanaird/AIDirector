// modules/ai-director/scripts/api/ollama-client.js

import {
  MODULE_ID,
  getActiveModel,
  getOllamaHost
}
from "../settings.js";

export const OllamaClient = {
  // Configuration Settings (Centralized points to alter model or host)
  get BASE_URL() {
    return getOllamaHost();
  },

  get DEFAULT_MODEL() {
    return getActiveModel();
  },

  /**
   * Dispatches a structured multi-turn message payload to the Ollama Chat API endpoint.
   * Used by: gm-modes.js, npc-chat.js, recap-manager.js
   */
  async chat(messages, options = {}) {
    const targetUrl = `${this.BASE_URL}/api/chat`;
    const temperature = options.temperature ?? 0.5;
    const num_predict = options.num_predict ?? 300;

    const payload = {
      model: options.model || this.DEFAULT_MODEL,
      messages: messages,
      stream: false,
      ...(options.format ? { format: options.format } : {}),
      options: {
        temperature: temperature,
        num_predict: num_predict
      }
    };

    try {
      const response = await fetch(targetUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`OllamaClient Chat Request Failed: ${response.statusText} (${response.status})`);
      }

      const data = await response.json();
      return data.message?.content || "";
    } catch (err) {
      console.error("AI Director | Network failure in OllamaClient.chat:", err);
      throw err;
    }
  },

  /**
   * Dispatches a text block to the raw prompt generation endpoint.
   * Supports native `format: "json"` constraint parameter.
   * Used by: director-pulse.js, scene-manager.js
   */
  async generate(prompt, systemDirective = "", options = {}) {
    const targetUrl = `${this.BASE_URL}/api/generate`;
    
    const payload = {
      model: options.model || this.DEFAULT_MODEL,
      prompt: prompt,
      system: systemDirective,
      stream: false,
      ...(options.format ? { format: options.format } : {})
    };

    if (options.temperature || options.num_predict) {
      payload.options = {
        ...(options.temperature ? { temperature: options.temperature } : {}),
        ...(options.num_predict ? { num_predict: options.num_predict } : {})
      };
    }

    try {
      const response = await fetch(targetUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`OllamaClient Generate Request Failed: ${response.statusText} (${response.status})`);
      }

      const data = await response.json();
      return data.response || "";
    } catch (err) {
      console.error("AI Director | Network failure in OllamaClient.generate:", err);
      throw err;
    }
  },

  /**
   * Utility to pull available offline local models.
   */
  async listModels() {
    try {
      const response = await fetch(`${this.BASE_URL}/api/tags`);
      if (!response.ok) return [this.DEFAULT_MODEL];
      const data = await response.json();
      return data.models?.map(m => m.name) || [this.DEFAULT_MODEL];
    } catch (e) {
      console.warn("AI Director | Could not fetch local model tags, defaulting to baseline.");
      return [this.DEFAULT_MODEL];
    }
  }
};