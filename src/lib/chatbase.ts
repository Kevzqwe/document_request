// Chatbase widget initialization logic

export interface ChatbaseConfig {
  chatbotId: string;
  domain?: string;
}

// Extend Window interface for TypeScript
declare global {
  interface Window {
    embeddedChatbotConfig?: {
      chatbotId: string;
      domain: string;
    };
  }
}

let isInitialized = false;

export const initializeChatbase = (config: ChatbaseConfig): void => {
  const { chatbotId, domain = 'www.chatbase.co' } = config;

  // Prevent multiple initializations
  if (isInitialized) {
    return;
  }

  // Check if script already exists
  const existingScript = document.getElementById('chatbase-script');
  if (existingScript) {
    return;
  }

  // Set the global config that Chatbase expects
  window.embeddedChatbotConfig = {
    chatbotId: chatbotId,
    domain: domain,
  };

  // Load the script with proper attributes
  const script = document.createElement('script');
  script.src = `https://${domain}/embed.min.js`;
  script.id = 'chatbase-script';
  script.setAttribute('chatbotId', chatbotId);
  script.setAttribute('domain', domain);
  script.defer = true;
  document.body.appendChild(script);

  isInitialized = true;
};

export const cleanupChatbase = (): void => {
  // Only cleanup on full unmount, not on re-renders
  // The Chatbase widget handles its own open/close state
  // We don't remove anything here to prevent the close button issue
};
