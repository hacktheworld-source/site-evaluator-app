import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import TypewriterText from './TypewriterText';
import DOMPurify from 'dompurify';
import { reportGenerator, ReportData } from '../services/reportGenerator';
import { saveAs } from 'file-saver';
import { toast } from 'react-toastify';
import { reportStorage } from '../services/reportStorage';
import { auth } from '../services/firebase';
import { SERVICE_COSTS, checkCreditsAndShowError, decrementUserBalance, getUserBalance } from '../services/points';

const MAX_HISTORY_LENGTH = 50;
const MAX_USER_MESSAGES = 5; // Increased from 3 to 5

const URL_REGEX = /(https?:\/\/[^\s<]+[^<.,:;"')\]\s])|(\b(?:[a-z\d]+\.){1,2}[a-z]{2,}\b)/gi;

const API_DEBUG = true;

const debugLog = (message: string, data?: any) => {
  if (API_DEBUG) {
    console.log(`[ChatInterface] ${message}`, data || '');
  }
};

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  metrics?: { [key: string]: any };
  screenshot?: string;
  phase?: string;
  isLoading?: boolean;
  metricsCollapsed?: boolean;
  competitorScreenshots?: {
    [url: string]: {
      status: 'loading' | 'loaded' | 'error';
      data?: string;
      error?: string;
    };
  };
}

interface ChatInterfaceProps {
  websiteUrl: string;
  onStartEvaluation: (url: string) => void;
  evaluationResults: any;
  isLoading: boolean;
  onGenerateReport?: (data: ReportData) => void;
  statusMessage?: string;
  onPointsUpdated?: (newPoints: number) => void;
  chatState: {
    messages: Message[];
    currentPhase: string | null;
    phaseScores: { [key: string]: number };
    overallScore: number | null;
    userInput: string;
    isThinking: boolean;
  };
  setChatState: React.Dispatch<React.SetStateAction<{
    messages: Message[];
    currentPhase: string | null;
    phaseScores: { [key: string]: number };
    overallScore: number | null;
    userInput: string;
    isThinking: boolean;
  }>>;
}

const ScreenshotPlaceholder: React.FC = () => (
  <div className="screenshot-placeholder pulse"></div>
);

const ChatInterface: React.FC<ChatInterfaceProps> = ({ 
  websiteUrl, 
  onStartEvaluation, 
  evaluationResults, 
  isLoading,
  onGenerateReport,
  statusMessage,
  onPointsUpdated,
  chatState,
  setChatState
}) => {
  const { messages, currentPhase, phaseScores, overallScore, userInput, isThinking } = chatState;
  const chatEndRef = useRef<HTMLDivElement>(null);

  const updateChatState = (updates: Partial<typeof chatState>) => {
    setChatState(prev => ({ ...prev, ...updates }));
  };

  const setMessages = (newMessages: Message[] | ((prev: Message[]) => Message[])) => {
    if (typeof newMessages === 'function') {
      setChatState(prev => ({ ...prev, messages: newMessages(prev.messages) }));
    } else {
      setChatState(prev => ({ ...prev, messages: newMessages }));
    }
  };

  const setCurrentPhase = (phase: string | null) => {
    updateChatState({ currentPhase: phase });
  };

  const setPhaseScores = (scores: typeof chatState.phaseScores) => {
    updateChatState({ phaseScores: scores });
  };

  const setOverallScore = (score: number | null) => {
    updateChatState({ overallScore: score });
  };

  const setUserInput = (input: string) => {
    updateChatState({ userInput: input });
  };

  const setIsThinking = (thinking: boolean) => {
    updateChatState({ isThinking: thinking });
  };

  const [isMessageLoading, setIsMessageLoading] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const SCREENSHOT_TIMEOUT = 45000; // 45 seconds

  const phases = ['Vision', 'UI', 'Functionality', 'Performance', 'SEO', 'Overall', 'Recommendations'];

  const roundMetrics = (metrics: any) => {
    if (!metrics) return {};
    const rounded: any = {};
    for (const [key, value] of Object.entries(metrics)) {
      if (typeof value === 'number') {
        rounded[key] = Number(value.toFixed(2));
      } else if (typeof value === 'object' && value !== null) {
        rounded[key] = roundMetrics(value);
      } else {
        rounded[key] = value;
      }
    }
    return rounded;
  };

  useEffect(() => {
    if (evaluationResults && !messages.length) {
      setIsThinking(true);
      startVisionAnalysis();
    }
  }, [evaluationResults]);

  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || lastMessage.phase === 'Recommendations') return;
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
          role: 'assistant' as const,
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

        // Turn off the thinking indicator now that the vision analysis is complete
        setIsThinking(false);
      } catch (error) {
        console.error('error starting vision analysis:', error);
        addMessage({
          role: 'assistant' as const,
          content: 'an error occurred while starting the vision analysis. please try again.'
        });
        setIsThinking(false);
      }
    }
  };

  const getPhaseMetrics = (phase: string, allMetrics: any) => {
    let phaseMetrics;
    switch (phase) {
      case 'Vision':
        phaseMetrics = {}; // Remove all metrics for Vision phase, we only want to analyze the screenshot
        break;
      case 'UI':
        phaseMetrics = {
          fontSizes: allMetrics.fontSizes,
          responsiveness: allMetrics.responsiveness,
          accessibility: allMetrics.accessibility,
          lighthouse: allMetrics.lighthouse
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
          estimatedFid: allMetrics.estimatedFid,
          domElements: allMetrics.domElements,
          pageSize: allMetrics.pageSize,
          requests: allMetrics.requests,
          security: allMetrics.security,
          lighthouse: allMetrics.lighthouse
        };
        break;
      case 'SEO':
        phaseMetrics = {
          seo: allMetrics.seo,
          lighthouse: allMetrics.lighthouse
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
      (messages.indexOf(msg) >= messages.length - (MAX_USER_MESSAGES * 2))
    );
    return relevantMessages.slice(-MAX_HISTORY_LENGTH);
  };

  const handleSendMessage = async () => {
    if (!userInput.trim() || !auth.currentUser?.uid) return;

    const userId = auth.currentUser.uid;
    await checkCreditsAndShowError(
      userId,
      SERVICE_COSTS.CHAT_MESSAGE,
      () => {
        toast.error(`This action requires ${SERVICE_COSTS.CHAT_MESSAGE} credits. Please purchase more credits to continue.`, {
          onClick: () => window.location.href = '/points'
        });
      },
      async () => {
        const newUserMessage: Message = { 
          role: 'user' as const, 
          content: userInput.trim()
        };
        setIsMessageLoading(true);

        debugLog('Attempting to send message', {
          userId: auth.currentUser?.uid,
          message: userInput.trim()
        });

        try {
          // First deduct credits
          await decrementUserBalance(userId, SERVICE_COSTS.CHAT_MESSAGE);
          // Update points in parent component
          if (onPointsUpdated) {
            const currentPoints = await getUserBalance(userId);
            onPointsUpdated(currentPoints);
          }
          
          // Then add the message and clear input
          addMessage(newUserMessage);
          setUserInput('');

          // Get selective history but strip out unnecessary data
          const selectiveHistory = getSelectiveHistory(currentPhase).map(msg => ({
            role: msg.role,
            content: msg.content,
            phase: msg.phase,
            metrics: msg.metrics // Include metrics but exclude screenshots and UI state
          }));

          // Then make the API call
          const response = await axios.post(`${process.env.REACT_APP_API_URL}/api/chat`, {
            url: websiteUrl,
            phase: currentPhase || 'Overall',
            message: newUserMessage.content,
            history: JSON.stringify(selectiveHistory)
          });

          const newAssistantMessage: Message = {
            role: 'assistant' as const,
            content: response.data.reply
          };

          addMessage(newAssistantMessage);
        } catch (error) {
          console.error('error fetching ai response:', error);
          if (error instanceof Error && error.message.includes('Insufficient points')) {
            toast.error(`Insufficient balance. You need $${SERVICE_COSTS.CHAT_MESSAGE.toFixed(2)} to send a message.`);
            toast.info('Click here to enroll in pay-as-you-go', {
              onClick: () => window.location.href = '/points'
            });
          } else {
            addMessage({
              role: 'assistant' as const,
              content: `error: ${error instanceof Error ? error.message : 'an error occurred while processing your message. please try again.'}`
            });
          }
        } finally {
          setIsMessageLoading(false);
        }
      }
    );
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

        if (nextPhase === 'Recommendations') {
          // Send the POST request to initialize the analysis
          const response = await axios.post(`${process.env.REACT_APP_API_URL}/api/analyze`, {
            url: websiteUrl,
            phase: nextPhase,
            metrics: phaseMetrics,
            history: JSON.stringify(messages.slice(-MAX_HISTORY_LENGTH).map(({ role, content }) => ({ role, content }))),
            screenshot: undefined
          });

          // Create EventSource for SSE using the job ID from the response
          const eventSource = new EventSource(`${process.env.REACT_APP_API_URL}/api/analyze/stream/${response.data.jobId}`);

          eventSource.onmessage = async (event) => {
            debugLog('Received EventSource message:', event.data);
            try {
              const data = JSON.parse(event.data);
              
              if (data.type === 'analysis') {
                const newMessage: Message = {
                  role: 'assistant' as const,
                  content: data.analysis,
                  phase: 'Recommendations',
                  competitorScreenshots: data.competitorScreenshots
                };
                setIsThinking(false);
                setIsMessageLoading(false);
                addMessage(newMessage);
              } else if (data.type === 'screenshot') {
                setMessages(prevMessages => 
                  prevMessages.map(msg => {
                    if (msg.phase === 'Recommendations') {
                      const updatedScreenshots = {
                        ...msg.competitorScreenshots,
                        [data.url]: {
                          status: 'loaded',
                          data: data.screenshot
                        }
                      };
                      return { ...msg, competitorScreenshots: updatedScreenshots };
                    }
                    return msg;
                  })
                );
              } else if (data.type === 'screenshot_error') {
                setMessages(prevMessages => 
                  prevMessages.map(msg => {
                    if (msg.phase === 'Recommendations') {
                      const updatedScreenshots = {
                        ...msg.competitorScreenshots,
                        [data.url]: {
                          status: 'error',
                          error: data.error
                        }
                      };
                      return { ...msg, competitorScreenshots: updatedScreenshots };
                    }
                    return msg;
                  })
                );
              } else if (data.type === 'complete') {
                eventSource.close();
              } else if (data.type === 'error') {
                console.error('Error in recommendations phase:', data.error);
                eventSource.close();
                setIsThinking(false);
                setIsMessageLoading(false);
                addMessage({
                  role: 'assistant' as const,
                  content: `An error occurred during the recommendations phase: ${data.error}`,
                  phase: 'Recommendations'
                });
              }
            } catch (error) {
              debugLog('Error processing message:', {
                error,
                rawData: event.data
              });
              eventSource.close();
              setIsThinking(false);
              setIsMessageLoading(false);
              addMessage({
                role: 'assistant' as const,
                content: `An error occurred during the recommendations phase. Please try again.`,
                phase: 'Recommendations'
              });
            }
          };

          eventSource.onerror = async (error) => {
            debugLog('EventSource error:', {
              error,
              readyState: eventSource.readyState,
              CONNECTING: EventSource.CONNECTING,
              OPEN: EventSource.OPEN,
              CLOSED: EventSource.CLOSED
            });

            console.error('EventSource error:', error);
            eventSource.close();
            setIsThinking(false);
            setIsMessageLoading(false);
            addMessage({
              role: 'assistant' as const,
              content: 'An error occurred during the recommendations phase. Please try again.',
              phase: 'Recommendations'
            });
          };
        } else {
          // Handle non-recommendations phases as before
          const response = await axios.post(`${process.env.REACT_APP_API_URL}/api/analyze`, {
            url: websiteUrl,
            phase: nextPhase,
            metrics: phaseMetrics,
            history: JSON.stringify(messages.slice(-MAX_HISTORY_LENGTH).map(({ role, content }) => ({ role, content }))),
            screenshot: nextPhase === 'Vision' ? evaluationResults.screenshot : undefined
          });

          const { score, analysis } = response.data;

          const newMessage: Message = {
            role: 'assistant' as const,
            content: analysis,
            metrics: nextPhase === 'Recommendations' ? undefined : phaseMetrics,
            screenshot: nextPhase === 'Recommendations' ? undefined : evaluationResults.screenshot,
            phase: nextPhase,
            isLoading: false
          };

          setIsThinking(false);
          setIsMessageLoading(false);
          addMessage(newMessage);

          if (nextPhase !== 'Overall' && nextPhase !== 'Recommendations' && score !== null) {
            const newPhaseScores = { ...phaseScores, [nextPhase]: score };
            setPhaseScores(newPhaseScores);
            updateOverallScore(newPhaseScores);
          }
        }
      } catch (error) {
        setIsThinking(false);
        setIsMessageLoading(false);
        console.error(`Error starting ${nextPhase} analysis:`, error);
        addMessage({
          role: 'assistant' as const,
          content: `An error occurred while starting the ${nextPhase} analysis. Please try again.`,
          isLoading: false
        });
      }
    } else {
      setCurrentPhase(null); // evaluation complete
    }
  };

  const toggleMetricsCollapse = useCallback((messageIndex: number) => {
    // Capture current scroll position before state update
    const chatMessages = document.querySelector('.chat-messages');
    const scrollPosition = chatMessages?.scrollTop;

    setMessages(prevMessages => {
      const newMessages = prevMessages.map((msg, idx) => 
        idx === messageIndex
          ? { ...msg, metricsCollapsed: !msg.metricsCollapsed }
          : msg
      );
      
      // Restore scroll position after state update
      if (scrollPosition !== undefined) {
        requestAnimationFrame(() => {
          if (chatMessages) {
            chatMessages.scrollTop = scrollPosition;
          }
        });
      }
      
      return newMessages;
    });
  }, []);

  const renderMetrics = useCallback((metrics: { [key: string]: any }, messageIndex: number, isCollapsed: boolean) => (
    <div 
      className={`metrics-wrapper fade-in ${isCollapsed ? 'collapsed' : ''}`} 
      onClick={() => toggleMetricsCollapse(messageIndex)}
    >
      <button 
        className="toggle-collapse" 
        onClick={(e) => {
          e.stopPropagation();
          toggleMetricsCollapse(messageIndex);
        }}
      >
        <i className={`fas fa-chevron-${isCollapsed ? 'down' : 'up'}`}></i>
      </button>
      {Object.entries(metrics || {}).map(([key, value]) => {
        if (key !== 'screenshot' && key !== 'htmlContent') {
          return (
            <div 
              key={key} 
              className="metric-tile"
            >
              <div className="metric-title">{key}</div>
              {renderMetricValue(value, 0)}
            </div>
          );
        }
        return null;
      })}
    </div>
  ), [toggleMetricsCollapse]);

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

  const makeUrlsClickable = (text: string): React.ReactNode[] => {
    const urlRegex = /(https?:\/\/[^\s:,)"'\]]+)/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = urlRegex.exec(text)) !== null) {
      // Add text before the URL
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index));
      }

      const url = match[0].replace(/[:,.]+$/, '');
      
      // Add the URL as a clickable link
      parts.push(
        <a
          key={`link-${match.index}`}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
        >
          {url}
        </a>
      );

      lastIndex = urlRegex.lastIndex;
    }

    // Add remaining text after the last URL
    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }

    return parts;
  };

  const renderMessage = useCallback((message: Message, index: number) => {
    return (
      <div 
        className={`message ${message.role} fade-in`}
        data-just-added={index === messages.length - 1 ? 'true' : 'false'}
        data-phase={message.phase || ''}
      >
        {message.role === 'assistant' && message.metrics && message.phase && 
         message.phase !== 'Overall' && message.phase !== 'Recommendations' && (
          <div className="message-score">
            {message.phase}: {phaseScores[message.phase] || 'n/a'}
          </div>
        )}
        <div className="message-content">
          {message.isLoading ? (
            <TypewriterText text="Thinking" onComplete={() => {}} isLoading={true} />
          ) : (
            <ReactMarkdown components={{
              text: ({ children }) => {
                if (typeof children === 'string') {
                  return <>{makeUrlsClickable(children)}</>;
                }
                return <>{children}</>;
              },
              p: ({ children }) => (
                <p className="message-paragraph">{children}</p>
              ),
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
                
                if (urlMatch && message.phase === 'Recommendations') {
                  // Clean the URL by removing trailing punctuation
                  const cleanUrl = urlMatch[1].replace(/[:,.]+$/, '');
                  
                  // Split content into parts and make URLs clickable
                  const parts = makeUrlsClickable(content);
                  
                  return (
                    <li {...props}>
                      {parts}
                      {message.competitorScreenshots?.[cleanUrl] && (
                        <div className="competitor-screenshot-wrapper">
                          {message.competitorScreenshots[cleanUrl].status === 'loading' ? (
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
                          )}
                        </div>
                      )}
                    </li>
                  );
                }
                return <li {...props}>{makeUrlsClickable(content)}</li>;
              },
            }}>
              {message.content}
            </ReactMarkdown>
          )}
        </div>
        {message.phase === 'Overall' && evaluationResults && renderMetrics(evaluationResults, index, message.metricsCollapsed ?? true)}
        {(message.phase === 'Overall' || message.phase === 'Vision') && evaluationResults?.screenshot && renderScreenshot(evaluationResults.screenshot)}
        {message.phase !== 'Overall' && message.phase !== 'Recommendations' && message.metrics && 
          renderMetrics(message.metrics, index, message.metricsCollapsed ?? true)}
      </div>
    );
  }, [renderMetrics, renderScreenshot, phaseScores, evaluationResults, messages.length]);

  const renderThinkingPlaceholder = () => (
    <div className="message assistant thinking">
      <div className="message-content">
        <TypewriterText text="Thinking" onComplete={() => {}} isLoading={true} />
      </div>
    </div>
  );

  const addMessage = useCallback((newMessage: Message) => {
    setMessages(prevMessages => {
      const processedMessage = {
        ...newMessage,
        metricsCollapsed: true
      };
      const updatedMessages = [...prevMessages, processedMessage];
      if (updatedMessages.length > MAX_HISTORY_LENGTH) {
        return updatedMessages.slice(-MAX_HISTORY_LENGTH);
      }
      return updatedMessages;
    });
  }, []);

  const handleGenerateReport = async () => {
    if (!messages.length || !evaluationResults || !auth.currentUser?.uid) {
      toast.error('Please sign in to generate a report');
      return;
    }

    const userId = auth.currentUser.uid;
    await checkCreditsAndShowError(
      userId,
      SERVICE_COSTS.REPORT_GENERATION,
      () => {
        toast.error(`Generating a report requires ${SERVICE_COSTS.REPORT_GENERATION} credits. Please purchase more credits to continue.`, {
          onClick: () => window.location.href = '/points'
        });
      },
      async () => {
        setIsGeneratingReport(true);
        let creditsDeducted = false;

        try {
          // First deduct credits
          await decrementUserBalance(userId, SERVICE_COSTS.REPORT_GENERATION);
          creditsDeducted = true;
          
          // Update points in parent component
          if (onPointsUpdated) {
            const currentPoints = await getUserBalance(userId);
            onPointsUpdated(currentPoints);
          }
          
          // Create a clean version of metrics without HTML content
          const cleanMetrics = {
            performance: {
              loadTime: evaluationResults.loadTime || 0,
              firstContentfulPaint: evaluationResults.firstContentfulPaint || 0,
              timeToInteractive: evaluationResults.timeToInteractive || 0,
              largestContentfulPaint: evaluationResults.largestContentfulPaint || 0,
              cumulativeLayoutShift: evaluationResults.cumulativeLayoutShift || 0,
              ttfb: evaluationResults.ttfb || 0,
              tbt: evaluationResults.tbt || 0,
              estimatedFid: evaluationResults.estimatedFid || 0,
              speedIndex: evaluationResults.speedIndex,
              totalBlockingTime: evaluationResults.totalBlockingTime
            },
            seo: {
              score: evaluationResults.lighthouse?.seo || 0,
              title: evaluationResults.seo?.title || '',
              metaDescription: evaluationResults.seo?.metaDescription || '',
              headings: evaluationResults.seo?.headings,
              robotsTxt: evaluationResults.seo?.robotsTxt,
              sitemapXml: evaluationResults.seo?.sitemapXml,
              canonicalUrl: evaluationResults.seo?.canonicalUrl,
              mobileResponsive: evaluationResults.seo?.mobileResponsive
            },
            accessibility: {
              score: evaluationResults.lighthouse?.accessibility || 0,
              imagesWithAltText: evaluationResults.accessibility?.imagesWithAltText || 0,
              totalImages: evaluationResults.accessibility?.totalImages || 0,
              ariaAttributesCount: evaluationResults.accessibility?.ariaAttributesCount || 0,
              keyboardNavigable: evaluationResults.accessibility?.keyboardNavigable || false,
              contrastRatio: evaluationResults.accessibility?.contrastRatio,
              formLabels: evaluationResults.accessibility?.formLabels
            },
            lighthouse: {
              performance: evaluationResults.lighthouse?.performance || 0,
              accessibility: evaluationResults.lighthouse?.accessibility || 0,
              seo: evaluationResults.lighthouse?.seo || 0,
              bestPractices: evaluationResults.lighthouse?.bestPractices || 0,
              pwa: evaluationResults.lighthouse?.pwa
            },
            security: {
              isHttps: evaluationResults.security?.isHttps || false,
              protocol: evaluationResults.security?.protocol || '',
              securityHeaders: {
                'Strict-Transport-Security': evaluationResults.security?.securityHeaders?.['Strict-Transport-Security'] || false,
                'Content-Security-Policy': evaluationResults.security?.securityHeaders?.['Content-Security-Policy'] || false,
                'X-Frame-Options': evaluationResults.security?.securityHeaders?.['X-Frame-Options'] || false,
                'X-Content-Type-Options': evaluationResults.security?.securityHeaders?.['X-Content-Type-Options'] || false,
                'X-XSS-Protection': evaluationResults.security?.securityHeaders?.['X-XSS-Protection'] || false,
                'Referrer-Policy': evaluationResults.security?.securityHeaders?.['Referrer-Policy'] || false
              },
              tlsVersion: evaluationResults.security?.tlsVersion || '',
              certificateExpiry: evaluationResults.security?.certificateExpiry,
              mixedContent: evaluationResults.security?.mixedContent,
              vulnerabilities: evaluationResults.security?.vulnerabilities
            },
            formFunctionality: {
              totalForms: evaluationResults.formFunctionality?.totalForms || 0,
              formsWithSubmitButton: evaluationResults.formFunctionality?.formsWithSubmitButton || 0,
              interactiveElementsCount: evaluationResults.formFunctionality?.interactiveElementsCount || 0,
              inputFieldsCount: evaluationResults.formFunctionality?.inputFieldsCount || 0,
              javascriptEnabled: evaluationResults.formFunctionality?.javascriptEnabled || false
            },
            brokenLinks: {
              totalLinks: evaluationResults.brokenLinks?.totalLinks || 0,
              brokenLinks: evaluationResults.brokenLinks?.brokenLinks || 0
            },
            responsiveness: {
              isResponsive: evaluationResults.responsiveness?.isResponsive || false,
              viewportWidth: evaluationResults.responsiveness?.viewportWidth || 0,
              pageWidth: evaluationResults.responsiveness?.pageWidth || 0
            },
            bestPractices: {
              semanticUsage: evaluationResults.bestPractices?.semanticUsage || {},
              optimizedImages: evaluationResults.bestPractices?.optimizedImages || 0,
              totalImages: evaluationResults.bestPractices?.totalImages || 0
            }
          };

          const reportData: ReportData = {
            websiteUrl,
            timestamp: new Date(),
            overallScore: overallScore || 0,
            phaseScores,
            metrics: cleanMetrics
          };

          // Generate PDF
          const pdfBuffer = await reportGenerator.generatePDF(reportData);
          
          // Save metadata to Firestore
          await reportStorage.saveReport(userId, reportData);
          
          // Download locally
          const blob = new Blob([pdfBuffer], { type: 'application/pdf' });
          saveAs(blob, `${websiteUrl.replace(/[^a-z0-9]/gi, '_')}_report.pdf`);

          toast.success('Report generated and saved successfully!');
        } catch (error) {
          console.error('Error generating report:', error);
          
          // If credits were deducted but report failed, refund them
          if (creditsDeducted) {
            try {
              await decrementUserBalance(userId, -SERVICE_COSTS.REPORT_GENERATION); // Negative amount for refund
              if (onPointsUpdated) {
                const currentPoints = await getUserBalance(userId);
                onPointsUpdated(currentPoints);
              }
              toast.info('Credits have been refunded due to the error');
            } catch (refundError) {
              console.error('Error refunding credits:', refundError);
            }
          }

          // Show error message
          if (error instanceof Error) {
            if (error.message.includes('Roboto')) {
              toast.error('Failed to generate PDF with custom fonts. Please try again.');
            } else {
              toast.error(error.message);
            }
          } else {
            toast.error('Failed to generate report. Please try again.');
          }
        } finally {
          setIsGeneratingReport(false);
        }
      }
    );
  };

  useEffect(() => {
    if (messages.length > 0) {
      const lastMessage = document.querySelector('.messages-container > div:last-child');
      const isNewMessage = lastMessage?.getAttribute('data-just-added') === 'true';
      const isRecommendations = messages[messages.length - 1]?.phase === 'Recommendations';

      if (lastMessage && isNewMessage && !isRecommendations) {
        lastMessage.scrollIntoView({ behavior: 'smooth', block: 'start' });
        lastMessage.removeAttribute('data-just-added');
      }
    }
  }, [messages]);

  useEffect(() => {
    if (isThinking) {
      const thinkingMessage = document.querySelector('.message.thinking');
      if (thinkingMessage) {
        thinkingMessage.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }, [isThinking]);

  useEffect(() => {
    if (messages.length > 0) {
      const lastMessageIndex = messages.length - 1;
      const lastMessage = messages[lastMessageIndex];
      
      // If this is a recommendations message with competitor screenshots
      if (lastMessage.competitorScreenshots) {
        // Set up timeouts for each loading screenshot
        const timeouts = Object.entries(lastMessage.competitorScreenshots)
          .filter(([_, data]) => data.status === 'loading')
          .map(([url]) =>
            setTimeout(() => {
              setMessages((prevMessages) => {
                // In case the messages array has changed, ensure we have the expected index
                if (prevMessages.length <= lastMessageIndex) return prevMessages;
                return prevMessages.map((msg, idx) => {
                  if (idx === lastMessageIndex && msg.competitorScreenshots) {
                    const updatedScreenshots = {
                      ...msg.competitorScreenshots,
                      [url]: { status: 'error' as const, error: 'Screenshot load timeout' }
                    };
                    return { ...msg, competitorScreenshots: updatedScreenshots };
                  }
                  return msg;
                });
              });
            }, SCREENSHOT_TIMEOUT)
          );
        
        // Cleanup timeouts
        return () => {
          timeouts.forEach((timeout) => clearTimeout(timeout));
        };
      }
    }
  }, [messages]);

  return (
    <div className="chat-interface">
      <div className="chat-phase-indicator-wrapper">
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
      </div>
      {overallScore !== null && (
        <div className="overall-score">
          overall score: {overallScore}
        </div>
      )}
      {currentPhase && (
        <div className="floating-action-container">
          {currentPhase !== 'Recommendations' ? (
            <button 
              type="button" 
              onClick={handleContinue} 
              disabled={isLoading || isMessageLoading} 
              className="floating-action-button"
            >
              Next
            </button>
          ) : (
            <button
              type="button"
              onClick={handleGenerateReport}
              disabled={isLoading || isMessageLoading || isGeneratingReport}
              className={`floating-action-button ${isGeneratingReport ? 'generating' : ''}`}
            >
              {isGeneratingReport ? 'Generating...' : 'Download Report'}
            </button>
          )}
        </div>
      )}
      <div className="chat-messages">
        <div className="messages-container">
          {messages.map((message, index) => (
            <React.Fragment key={`${index}-${JSON.stringify(message.competitorScreenshots)}`}>
              {renderMessage(message, index)}
            </React.Fragment>
          ))}
          {isThinking && renderThinkingPlaceholder()}
        </div>
        {messages.length === 0 && statusMessage && (
          <div className="status-message">{statusMessage}</div>
        )}
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
      </form>
    </div>
  );
};

export default React.memo(ChatInterface);