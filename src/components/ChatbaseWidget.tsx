import { useEffect } from 'react';
import { initializeChatbase, cleanupChatbase } from '@/lib/chatbase';

interface ChatbaseWidgetProps {
  chatbotId: string;
  domain?: string;
}

const ChatbaseWidget = ({ chatbotId, domain = 'www.chatbase.co' }: ChatbaseWidgetProps) => {
  useEffect(() => {
    initializeChatbase({ chatbotId, domain });

    return () => {
      cleanupChatbase();
    };
  }, [chatbotId, domain]);

  // This component doesn't render anything visible
  // The chatbase script handles the widget UI
  return null;
};

export default ChatbaseWidget;
