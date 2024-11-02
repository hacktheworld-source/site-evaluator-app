import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import TypewriterText from './TypewriterText';
import DOMPurify from 'dompurify';

const MAX_HISTORY_LENGTH = 50;
const MAX_USER_MESSAGES = 5; // Increased from 3 to 5

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  metrics?: { [key: string]: any };
  screenshot?: string;
  phase?: string;
  isLoading?: boolean;
  competitorScreenshots?: {
    [url: string]: {
      status: 'loading' | 'loaded' | 'error';
      data?: string;
    };
  };
}

interface ChatInterfaceProps {
  websiteUrl: string;
  onStartEvaluation: (url: string) => void;
  evaluationResults: any;
  isLoading: boolean;
}

const ScreenshotPlaceholder: React.FC = () => (
  <div className="screenshot-placeholder pulse"></div>
);

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
  const [phaseScores, setPhaseScores] = useState<{ [key: string]: number }>({});
  const [overallScore, setOverallScore] = useState<number | null>(null);
  const [isThinking, setIsThinking] = useState(false);
  const [isMessageLoading, setIsMessageLoading] = useState(false);

  const phases = ['Vision', 'UI', 'Functionality', 'Performance', 'SEO', 'Overall', 'Recommendations'];

  useEffect(() => {
    if (evaluationResults && !messages.length) {
      startVisionAnalysis();
    }
  }, [evaluationResults]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Add this useEffect to reset the state when the component receives a new key
  useEffect(() => {
    setMessages([]);
    setUserInput('');
    setCurrentPhase(null);
    setPhaseScores({});
    setOverallScore(null);
  }, [websiteUrl]);

  const updateOverallScore = (newPhaseScores: { [key: string]: number }) => {
    const scores = Object.values(newPhaseScores);
    if (scores.length > 0) {
      const average = scores.reduce((a, b) => a + b, 0) / scores.length;
      setOverallScore(Math.round(average));
    }
  };

  const getPhaseScore = async (phase: string, metrics: any): Promise<number> => {
    try {
      const response = await axios.post(`${process.env.REACT_APP_API_URL}/api/score`, {
        url: websiteUrl,
        phase: phase,
        metrics: metrics,
        screenshot: phase === 'Vision' ? evaluationResults.screenshot : undefined
      });
      return response.data.score || 0;
    } catch (error) {
      console.error(`error getting ${phase} score:`, error);
      return 0;
    }
  };

  const startVisionAnalysis = async () => {
    if (messages.length === 0) {
      try {
        const response = await axios.post(`${process.env.REACT_APP_API_URL}/api/analyze`, {
          url: websiteUrl,
          phase: 'Vision',
          metrics: {}, // Send empty metrics for Vision phase
          history: JSON.stringify([]),
          screenshot: evaluationResults.screenshot
        });

        const { score, analysis } = response.data;

        const initialMessage: Message = {
          role: 'assistant',
          content: analysis,
          screenshot: evaluationResults.screenshot,
          phase: 'Vision',
          metrics: {}
        };
        addMessage(initialMessage);
        setCurrentPhase('Vision');

        const newPhaseScores = { ...phaseScores, Vision: score };
        setPhaseScores(newPhaseScores);
        updateOverallScore(newPhaseScores);
      } catch (error) {
        console.error('error starting vision analysis:', error);
        addMessage({
          role: 'assistant',
          content: 'an error occurred while starting the vision analysis. please try again.'
        });
      }
    }
  };

  const getPhaseMetrics = (phase: string, allMetrics: any) => {
    let phaseMetrics;
    switch (phase) {
      case 'Vision':
        phaseMetrics = {}; // No metrics for Vision phase, just the screenshot
        break;
      case 'UI':
        // Remove screenshot from UI metrics
        phaseMetrics = {
          colorContrast: allMetrics.colorContrast,
          fontSizes: allMetrics.fontSizes,
          responsiveness: allMetrics.responsiveness,
          accessibility: allMetrics.accessibility
        };
        break;
      case 'Functionality':
        phaseMetrics = {
          brokenLinks: allMetrics.brokenLinks,
          formFunctionality: allMetrics.formFunctionality,
          bestPractices: allMetrics.bestPractices
        };
        break;
      case 'Performance':
        phaseMetrics = {
          loadTime: allMetrics.loadTime,
          domContentLoaded: allMetrics.domContentLoaded,
          firstPaint: allMetrics.firstPaint,
          firstContentfulPaint: allMetrics.firstContentfulPaint,
          timeToInteractive: allMetrics.timeToInteractive,
          largestContentfulPaint: allMetrics.largestContentfulPaint,
          cumulativeLayoutShift: allMetrics.cumulativeLayoutShift,
          ttfb: allMetrics.ttfb,
          tbt: allMetrics.tbt,
          estimatedFid: allMetrics.estimatedFid, // Changed from fid to estimatedFid
          domElements: allMetrics.domElements,
          pageSize: allMetrics.pageSize,
          requests: allMetrics.requests,
          security: allMetrics.security
        };
        break;
      case 'SEO':
        phaseMetrics = {
          seo: allMetrics.seo
        };
        break;
      case 'Recommendations':
      case 'Overall':
        phaseMetrics = {};
        break;
      default:
        phaseMetrics = {};
    }
    return optimizeMetrics(phaseMetrics);
  };

  const optimizeMetrics = (metrics: any): any => {
    const optimized: any = {};
    for (const [key, value] of Object.entries(metrics)) {
      const shortKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      if (typeof value === 'number') {
        optimized[shortKey] = Number(value.toFixed(2));
      } else if (typeof value === 'object' && value !== null) {
        optimized[shortKey] = optimizeMetrics(value);
      } else {
        optimized[shortKey] = value;
      }
    }
    return optimized;
  };

  const getSelectiveHistory = (currentPhase: string | null): Message[] => {
    const relevantMessages = messages.filter(msg => 
      msg.role === 'system' || 
      (msg.phase === currentPhase) || 
      (msg.role === 'user' && messages.indexOf(msg) >= messages.length - MAX_USER_MESSAGES)
    );
    return relevantMessages.slice(-MAX_HISTORY_LENGTH);
  };

  const handleSendMessage = async () => {
    if (userInput.trim()) {
      const newUserMessage: Message = { 
        role: 'user', 
        content: userInput.trim()
      };
      addMessage(newUserMessage);
      setUserInput('');
      setIsMessageLoading(true);

      try {
        const selectiveHistory = getSelectiveHistory(currentPhase);
        const historyString = JSON.stringify(selectiveHistory); // Use history directly without compression
        const response = await axios.post(`${process.env.REACT_APP_API_URL}/api/chat`, {
          url: websiteUrl,
          phase: currentPhase || 'Overall',
          message: newUserMessage.content,
          history: historyString // Send the history as a JSON string
        });

        const newAssistantMessage: Message = {
          role: 'assistant',
          content: response.data.reply
        };

        addMessage(newAssistantMessage);
        setIsMessageLoading(false);
      } catch (error) {
        console.error('error fetching ai response:', error);
        addMessage({
          role: 'assistant',
          content: `error: ${error instanceof Error ? error.message : 'an error occurred while processing your message. please try again.'}`
        });
        setIsMessageLoading(false);
      }
    }
  };

  const handleContinue = async () => {
    const currentIndex = phases.indexOf(currentPhase!);
    if (currentIndex < phases.length - 1) {
      const nextPhase = phases[currentIndex + 1];
      setCurrentPhase(nextPhase);
      setIsThinking(true);
      setIsMessageLoading(true);

      try {
        const phaseMetrics = nextPhase === 'Overall' || nextPhase === 'Recommendations' ? {} : getPhaseMetrics(nextPhase, evaluationResults);
        const response = await axios.post(`${process.env.REACT_APP_API_URL}/api/analyze`, {
          url: websiteUrl,
          phase: nextPhase,
          metrics: phaseMetrics,
          history: JSON.stringify(messages.slice(-MAX_HISTORY_LENGTH).map(({ role, content }) => ({ role, content }))),
          screenshot: nextPhase === 'Vision' ? evaluationResults.screenshot : undefined
        });

        console.log('Received response:', response.data);

        const { score, analysis } = response.data;

        const newMessage: Message = {
          role: 'assistant',
          content: analysis,
          metrics: nextPhase === 'Recommendations' ? undefined : phaseMetrics,
          screenshot: nextPhase === 'Recommendations' ? undefined : evaluationResults.screenshot,
          phase: nextPhase,
          isLoading: false,
          competitorScreenshots: {}
        };

        console.log('New message:', newMessage);

        setIsThinking(false);
        setIsMessageLoading(false);
        addMessage(newMessage);

        if (nextPhase === 'Recommendations') {
          fetchScreenshots(newMessage);
        }

        if (nextPhase !== 'Overall' && nextPhase !== 'Recommendations' && score !== null) {
          const newPhaseScores = { ...phaseScores, [nextPhase]: score };
          setPhaseScores(newPhaseScores);
          updateOverallScore(newPhaseScores);
        }
      } catch (error) {
        setIsThinking(false);
        setIsMessageLoading(false);
        console.error(`error starting ${nextPhase} analysis:`, error);
        addMessage({
          role: 'assistant',
          content: `an error occurred while starting the ${nextPhase} analysis. please try again.`,
          isLoading: false
        });
      }
    } else {
      setCurrentPhase(null); // evaluation complete
    }
  };

  const fetchScreenshots = async (message: Message) => {
    try {
      if (!message.content || typeof message.content !== 'string') {
        console.error('Invalid message content:', message.content);
        return;
      }

      const urlRegex = /(?:\d\.|-)?\s*(https?:\/\/[^\s,)"']+)/gi;
      const urls: string[] = [];
      let match;
      
      while ((match = urlRegex.exec(message.content)) !== null) {
        const url = match[1].trim();
        try {
          new URL(url);
          urls.push(url);
        } catch (error) {
          console.log(`Skipping invalid URL: ${url}`);
        }
      }

      // Set initial loading state for all screenshots at once
      const initialScreenshots: Message['competitorScreenshots'] = {};
      urls.forEach(url => {
        initialScreenshots[url] = { status: 'loading' };
      });

      setMessages(prevMessages => 
        prevMessages.map(msg => 
          msg.phase === 'Recommendations' && msg.content === message.content
            ? { ...msg, competitorScreenshots: initialScreenshots }
            : msg
        )
      );

      // Fetch screenshots
      const response = await axios.post(`${process.env.REACT_APP_API_URL}/api/capture-screenshots`, {
        content: message.content
      });

      // Update all screenshots in a single state update
      const { competitorScreenshots } = response.data;

      setMessages(prevMessages => {
        const updatedMessages = prevMessages.map(msg => {
          if (msg.phase === 'Recommendations' && msg.content === message.content) {
            const updatedScreenshots: Message['competitorScreenshots'] = {};
            
            Object.entries(competitorScreenshots).forEach(([url, screenshot]) => {
              updatedScreenshots[url] = {
                status: screenshot ? 'loaded' as const : 'error' as const,
                data: screenshot as string
              };
            });

            return {
              ...msg,
              competitorScreenshots: updatedScreenshots
            } as Message;
          }
          return msg;
        });
        
        return updatedMessages;
      });
    } catch (error) {
      // Silent error handling - just log to console
      console.error('Error fetching screenshots:', error);
      // Don't update UI or show error state
    }
  };

  const renderMetrics = useCallback((metrics: { [key: string]: any }) => (
    <div className="metrics-wrapper fade-in">
      {Object.entries(metrics || {}).map(([key, value]) => {
        if (key !== 'screenshot' && key !== 'htmlContent') {
          return (
            <div key={key} className="metric-tile">
              <div className="metric-title">{key}</div>
              {renderMetricValue(value, 0)}
            </div>
          );
        }
        return null;
      })}
    </div>
  ), []);
  
  const renderMetricValue = (value: any, depth: number = 0): React.ReactNode => {
    if (value === null || value === undefined) {
      return 'N/A';
    } else if (typeof value === 'number') {
      if (Number.isInteger(value)) {
        return value.toString();
      } else if (value < 1 && value > 0) {
        return `${(value * 100).toFixed(2)}%`;
      } else {
        return value.toFixed(2);
      }
    } else if (typeof value === 'string') {
      return value || 'N/A';
    } else if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    } else if (Array.isArray(value)) {
      return (
        <div className={`metric-array depth-${depth}`}>
          {value.map((item, index) => (
            <div key={index} className={`metric-array-item depth-${depth}`}>
              {renderMetricValue(item, depth + 1)}
            </div>
          ))}
        </div>
      );
    } else if (typeof value === 'object') {
      return (
        <div className={`metric-object depth-${depth}`}>
          {Object.entries(value).map(([subKey, subValue]) => (
            <div key={subKey} className={`metric-subitem depth-${depth}`}>
              <span className={`metric-subtitle depth-${depth}`}>{subKey}: </span>
              <span className={`metric-subvalue depth-${depth}`}>{renderMetricValue(subValue, depth + 1)}</span>
            </div>
          ))}
        </div>
      );
    }
    return 'N/A';
  };

  const renderScreenshot = useCallback((screenshot: string) => (
    <img 
      src={`data:image/png;base64,${screenshot}`} 
      alt="website screenshot" 
      className="website-screenshot fade-in" 
    />
  ), []);

  const renderMessage = useCallback((message: Message) => {
    return (
      <div className={`message ${message.role}`}>
        {message.role === 'assistant' && message.metrics && message.phase && 
         message.phase !== 'Overall' && message.phase !== 'Recommendations' && (
          <div className="message-score">
            {message.phase}: {phaseScores[message.phase] || 'n/a'}
          </div>
        )}
        <div className="message-content">
          {message.isLoading ? (
            <TypewriterText text="Thinking..." onComplete={() => {}} isLoading={true} />
          ) : (
            <ReactMarkdown components={{
              li: ({ node, ...props }) => {
                if (!node || !node.children) {
                  return <li {...props}>Invalid content</li>;
                }

                // Get the content by recursively processing all child nodes
                const getNodeContent = (node: any): string => {
                  if (node.type === 'text') {
                    return node.value || '';
                  }
                  if (node.children) {
                    return node.children.map(getNodeContent).join('');
                  }
                  return '';
                };

                const content = node.children.map(getNodeContent).join('');
                const urlMatch = content.match(/(https?:\/\/[^\s:,)"']+)/);
                
                if (urlMatch) {
                  // Clean the URL by removing trailing punctuation
                  const cleanUrl = urlMatch[1].replace(/[:,.]+$/, '');
                  
                  return (
                    <li {...props}>
                      {content}
                      {message.phase === 'Recommendations' && (
                        <div className="competitor-screenshot-wrapper">
                          {message.competitorScreenshots?.[cleanUrl] ? (
                            message.competitorScreenshots[cleanUrl].status === 'loading' ? (
                              <div className="screenshot-placeholder pulse"></div>
                            ) : message.competitorScreenshots[cleanUrl].status === 'loaded' ? (
                              <img 
                                src={`data:image/png;base64,${message.competitorScreenshots[cleanUrl].data}`} 
                                alt={`Screenshot of ${cleanUrl}`} 
                                className="competitor-screenshot"
                                onError={(e) => {
                                  console.error(`Error loading screenshot for ${cleanUrl}`);
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = 'none';
                                }}
                              />
                            ) : (
                              <div className="screenshot-error">Failed to load screenshot</div>
                            )
                          ) : (
                            <div className="screenshot-placeholder pulse"></div>
                          )}
                        </div>
                      )}
                    </li>
                  );
                }
                return (
                  <li {...props}>
                    {content}
                  </li>
                );
              },
            }}>
              {DOMPurify.sanitize(message.content)}
            </ReactMarkdown>
          )}
        </div>
        {message.phase === 'Overall' && renderMetrics(evaluationResults)}
        {(message.phase === 'Overall' || message.phase === 'Vision') && renderScreenshot(evaluationResults.screenshot)}
        {message.phase !== 'Overall' && message.phase !== 'Recommendations' && message.metrics && renderMetrics(message.metrics)}
      </div>
    );
  }, [renderMetrics, renderScreenshot, phaseScores, evaluationResults]);

  const renderThinkingPlaceholder = () => (
    <div className="message assistant thinking">
      <div className="message-content">
        <TypewriterText text="Thinking..." onComplete={() => {}} isLoading={true} />
      </div>
    </div>
  );

  const addMessage = useCallback((newMessage: Message) => {
    setMessages(prevMessages => {
      const updatedMessages = [...prevMessages, newMessage];
      if (updatedMessages.length > MAX_HISTORY_LENGTH) {
        return updatedMessages.slice(-MAX_HISTORY_LENGTH);
      }
      return updatedMessages;
    });
  }, []);

  const extractUrls = (content: string): string[] => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return content.match(urlRegex) || [];
  };

  useEffect(() => {
    const recommendationsMessage = messages.find(msg => msg.phase === 'Recommendations');
  }, [messages]);

  return (
    <div className="chat-interface">
      {overallScore !== null && (
        <div className="overall-score">
          overall score: {overallScore}
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
            <React.Fragment key={`${index}-${JSON.stringify(message.competitorScreenshots)}`}>
              {renderMessage(message)}
            </React.Fragment>
          ))}
          {isThinking && renderThinkingPlaceholder()}
        </div>
        <div ref={chatEndRef} />
      </div>
      <form onSubmit={(e) => {
        e.preventDefault();
        handleSendMessage();
      }} className="chat-input">
        <input
          type="text"
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          placeholder="Ask a question..."
          disabled={isLoading || isMessageLoading}
        />
        <button 
          type="submit" 
          disabled={isLoading || isMessageLoading || !userInput.trim()} 
          className="chat-submit-button"
        >
          <i className="fas fa-paper-plane"></i>
        </button>
        {currentPhase && currentPhase !== 'Recommendations' && (
          <button 
            type="button" 
            onClick={handleContinue} 
            disabled={isLoading || isMessageLoading} 
            className="continue-button"
          >
            Continue
          </button>
        )}
      </form>
    </div>
  );
};

export default React.memo(ChatInterface);