import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import TypewriterText from './TypewriterText';

const MAX_HISTORY_LENGTH = 10; // Adjust this value as needed

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  metrics?: { [key: string]: any };
  screenshot?: string;
}

interface ChatInterfaceProps {
  websiteUrl: string;
  onStartEvaluation: (url: string) => void;
  evaluationResults: any;
  isLoading: boolean;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ 
  websiteUrl, 
  onStartEvaluation, 
  evaluationResults, 
  isLoading 
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [userInput, setUserInput] = useState('');
  const [currentPhase, setCurrentPhase] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [overallScore, setOverallScore] = useState<number | null>(null);

  const phases = ['UI', 'Functionality', 'Performance', 'Overall'];

  useEffect(() => {
    if (evaluationResults) {
      startUIAnalysis();
    }
  }, [evaluationResults]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const startUIAnalysis = async () => {
    const uiMetrics = getPhaseMetrics('UI', evaluationResults);
    
    try {
      console.log('Sending UI analysis request with metrics:', uiMetrics);
      const response = await axios.post(`${process.env.REACT_APP_API_URL}/api/analyze`, {
        url: websiteUrl,
        phase: 'UI',
        metrics: uiMetrics,
        history: JSON.stringify(messages)
      });

      console.log('Received UI analysis response:', response.data);

      const initialMessage: Message = {
        role: 'assistant',
        content: response.data.analysis,
        metrics: uiMetrics,
        screenshot: evaluationResults.screenshot
      };
      setMessages(prevMessages => [...prevMessages, initialMessage]);
      setCurrentPhase('UI');
    } catch (error) {
      console.error('Error starting UI analysis:', error);
      if (axios.isAxiosError(error) && error.response) {
        console.error('Server response:', error.response.data);
      }
      setMessages([{
        role: 'assistant',
        content: 'An error occurred while starting the UI analysis. Please try again.'
      }]);
    }
  };

  const getPhaseMetrics = (phase: string, allMetrics: any) => {
    switch (phase) {
      case 'UI':
        return {
          colorContrast: allMetrics.colorContrast,
          fontSizes: allMetrics.fontSizes,
          responsiveness: allMetrics.responsiveness
        };
      case 'Functionality':
        return {
          brokenLinks: allMetrics.brokenLinks,
          formFunctionality: allMetrics.formFunctionality
        };
      case 'Performance':
        return {
          loadTime: allMetrics.loadTime,
          firstContentfulPaint: allMetrics.firstContentfulPaint,
          largestContentfulPaint: allMetrics.largestContentfulPaint,
          cumulativeLayoutShift: allMetrics.cumulativeLayoutShift
        };
      case 'Overall':
        const { htmlContent, ...relevantMetrics } = allMetrics;
        return relevantMetrics; // This now includes the screenshot
      default:
        return {};
    }
  };

  const [isTyping, setIsTyping] = useState(false);
  const [isTypingComplete, setIsTypingComplete] = useState(false);

  const handleSendMessage = async () => {
    if (userInput.trim() && !isTyping) {
      const newUserMessage: Message = { 
        role: 'user', 
        content: userInput.trim()
      };
      setMessages(prevMessages => [...prevMessages, newUserMessage]);
      setUserInput('');
      setIsTyping(true);
      setIsTypingComplete(false);

      try {
        const response = await axios.post(`${process.env.REACT_APP_API_URL}/api/chat`, {
          url: websiteUrl,
          phase: currentPhase,
          message: newUserMessage.content,
          history: JSON.stringify(messages)
        });

        const newAssistantMessage: Message = {
          role: 'assistant',
          content: response.data.reply
        };

        setMessages(prevMessages => [...prevMessages, newAssistantMessage]);
      } catch (error) {
        console.error('Error fetching AI response:', error);
        setMessages(prevMessages => [...prevMessages, {
          role: 'assistant',
          content: `Error: ${error instanceof Error ? error.message : 'An error occurred while processing your message. Please try again.'}`
        }]);
        setIsTyping(false);
        setIsTypingComplete(true);
      }
    }
  };

  const handleContinue = async () => {
    const currentIndex = phases.indexOf(currentPhase!);
    if (currentIndex < phases.length - 1) {
      const nextPhase = phases[currentIndex + 1];
      setCurrentPhase(nextPhase);

      try {
        const phaseMetrics = getPhaseMetrics(nextPhase, evaluationResults);
        console.log('Metrics being sent:', phaseMetrics);
        const response = await axios.post(`${process.env.REACT_APP_API_URL}/api/analyze`, {
          url: websiteUrl,
          phase: nextPhase,
          metrics: phaseMetrics,
          history: JSON.stringify(messages)
        });

        const newAssistantMessage: Message = {
          role: 'assistant',
          content: response.data.analysis,
          metrics: phaseMetrics
        };

        setMessages(prevMessages => [...prevMessages, newAssistantMessage]);

        if (nextPhase === 'Overall' && response.data.overallScore !== null) {
          setOverallScore(response.data.overallScore);
        }
      } catch (error) {
        console.error(`Error starting ${nextPhase} analysis:`, error);
        setMessages(prevMessages => [...prevMessages, {
          role: 'assistant',
          content: `An error occurred while starting the ${nextPhase} analysis. Please try again.`
        }]);
      }
    } else {
      setCurrentPhase(null); // Evaluation complete
    }
  };

  const renderMetricValue = (value: any): React.ReactNode => {
    if (typeof value === 'number') {
      return value.toFixed(2);
    } else if (typeof value === 'string') {
      return value;
    } else if (typeof value === 'boolean') {
      return value.toString();
    } else if (Array.isArray(value)) {
      return (
        <ul>
          {value.map((item, index) => (
            <li key={index}>{renderMetricValue(item)}</li>
          ))}
        </ul>
      );
    } else if (typeof value === 'object' && value !== null) {
      return (
        <div>
          {Object.entries(value).map(([subKey, subValue]) => (
            <div key={subKey}>
              <strong>{subKey}:</strong> {renderMetricValue(subValue)}
            </div>
          ))}
        </div>
      );
    }
    return 'N/A';
  };

  const renderMetrics = (metrics: { [key: string]: any }) => (
    <div className={`metrics-wrapper ${isTypingComplete ? 'fade-in' : ''}`}>
      {Object.entries(metrics).map(([key, value]) => (
        key !== 'screenshot' && (
          <div key={key} className="metric-tile">
            <div className="metric-title">{key}</div>
            <div className="metric-value">{renderMetricValue(value)}</div>
          </div>
        )
      ))}
    </div>
  );

  const renderScreenshot = (screenshot: string) => (
    <img 
      src={`data:image/png;base64,${screenshot}`} 
      alt="Website Screenshot" 
      className={`website-screenshot ${isTypingComplete ? 'fade-in' : ''}`} 
    />
  );

  const renderMessage = (message: Message) => (
    <div className={`message ${message.role}`}>
      <div className="message-content">
        {message.role === 'assistant' ? (
          <TypewriterText 
            text={message.content} 
            onComplete={() => {
              setIsTyping(false);
              setIsTypingComplete(true);
            }}
          />
        ) : (
          <ReactMarkdown>{message.content}</ReactMarkdown>
        )}
      </div>
      {message.metrics && isTypingComplete && renderMetrics(message.metrics)}
      {message.screenshot && isTypingComplete && renderScreenshot(message.screenshot)}
    </div>
  );

  return (
    <div className="chat-interface">
      {overallScore !== null && (
        <div className="overall-score">
          Overall Score: {overallScore}
        </div>
      )}
      <div className="chat-phase-indicator">
        {phases.map((phase, index) => (
          <div 
            key={phase} 
            className={`phase-item ${currentPhase === phase ? 'active' : ''} ${index < phases.indexOf(currentPhase!) ? 'completed' : ''}`}
          >
            {phase}
          </div>
        ))}
      </div>
      <div className="chat-messages">
        <div className="messages-container">
          {messages.map((message, index) => (
            <React.Fragment key={index}>
              {renderMessage(message)}
            </React.Fragment>
          ))}
        </div>
        <div ref={chatEndRef} />
      </div>
      <div className="chat-input">
        <input
          type="text"
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          placeholder={currentPhase ? "Ask a question..." : "Evaluation complete"}
          disabled={isLoading || !currentPhase || isTyping}
        />
        <button onClick={handleSendMessage} disabled={isLoading || !currentPhase || !userInput.trim() || isTyping}>
          Send
        </button>
        <button onClick={handleContinue} disabled={isLoading || !currentPhase || isTyping}>
          {currentPhase === phases[phases.length - 1] ? 'Finish' : 'Continue'}
        </button>
      </div>
    </div>
  );
};

export default ChatInterface;