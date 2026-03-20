import { useState, useRef, useEffect } from 'react';

interface PrdChatProps {
  chatHistory: { role: string; content: string }[];
  onSend: (message: string) => void;
}

export function PrdChat({ chatHistory, onSend }: PrdChatProps) {
  const [message, setMessage] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatHistory]);

  const handleSend = () => {
    if (!message.trim()) return;
    onSend(message.trim());
    setMessage('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="prd-chat">
      <label className="prd-label">Chat / Q&A</label>
      <div className="prd-chat__messages" ref={scrollRef}>
        {chatHistory.length === 0 && (
          <div className="prd-chat__empty">
            Soru-cevap ile PRD'yi sekillendir
          </div>
        )}
        {chatHistory.map((msg, i) => (
          <div key={i} className={`prd-chat__msg prd-chat__msg--${msg.role}`}>
            <span className="prd-chat__role">
              {msg.role === 'assistant' ? '🤖' : '👤'}
            </span>
            <span className="prd-chat__text">{msg.content}</span>
          </div>
        ))}
      </div>
      <div className="prd-chat__input">
        <input
          type="text"
          className="prd-input"
          placeholder="Mesaj yaz..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button className="btn btn--small btn--primary" onClick={handleSend}>
          Gonder
        </button>
      </div>
    </div>
  );
}
