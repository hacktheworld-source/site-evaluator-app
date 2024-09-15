import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import { deflate, inflate } from 'pako';

const MAX_HISTORY_LENGTH = 50;
const MAX_USER_MESSAGES = 5; // Increased from 3 to 5

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  metrics?: { [key: string]: any };
  screenshot?: string;
  phase?: string;
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
  const [phaseScores, setPhaseScores] = useState<{ [key: string]: number }>({});
  const [overallScore, setOverallScore] = useState<number | null>(null);

  const phases = ['Vision', 'UI', 'Functionality', 'Performance', 'SEO', 'Overall'];

  useEffect(() => {
    if (evaluationResults) {
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
      console.log(`Sending metrics for ${phase} phase scoring:`, metrics);
      const response = await axios.post(`${process.env.REACT_APP_API_URL}/api/score`, {
        url: websiteUrl,
        phase: phase,
        metrics: metrics,
        screenshot: phase === 'Vision' ? evaluationResults.screenshot : undefined
      });
      console.log(`Received score for ${phase} phase:`, response.data.score);
      return response.data.score || 0;
    } catch (error) {
      console.error(`error getting ${phase} score:`, error);
      return 0;
    }
  };

  const startVisionAnalysis = async () => {
    try {
      console.log('sending vision analysis request');
      const analysisResponse = await axios.post(`${process.env.REACT_APP_API_URL}/api/analyze`, {
        url: websiteUrl,
        phase: 'Vision',
        metrics: {},
        history: JSON.stringify(messages.slice(-MAX_HISTORY_LENGTH).map(({ role, content }) => ({ role, content }))),
        screenshot: evaluationResults.screenshot
      });

      const score = await getPhaseScore('Vision', { screenshot: evaluationResults.screenshot });

      const initialMessage: Message = {
        role: 'assistant',
        content: analysisResponse.data.analysis,
        screenshot: evaluationResults.screenshot,
        phase: 'Vision',
        metrics: {}
      };
      addMessage(initialMessage);
      setCurrentPhase('Vision');

      // Update phase scores and overall score
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
      case 'Overall':
        // For Overall phase, return all metrics
        const { htmlContent, screenshot, ...overallMetrics } = allMetrics;
        phaseMetrics = overallMetrics;
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

  const compressHistory = (history: Message[]): string => {
    const jsonString = JSON.stringify(history);
    const compressed = deflate(jsonString);
    return btoa(String.fromCharCode.apply(null, Array.from(compressed)));
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

      try {
        const selectiveHistory = getSelectiveHistory(currentPhase);
        const compressedHistory = compressHistory(selectiveHistory);
        const response = await axios.post(`${process.env.REACT_APP_API_URL}/api/chat`, {
          url: websiteUrl,
          phase: currentPhase || 'Overall',
          message: newUserMessage.content,
          history: compressedHistory
        });

        const newAssistantMessage: Message = {
          role: 'assistant',
          content: response.data.reply
        };

        addMessage(newAssistantMessage);
      } catch (error) {
        console.error('error fetching ai response:', error);
        addMessage({
          role: 'assistant',
          content: `error: ${error instanceof Error ? error.message : 'an error occurred while processing your message. please try again.'}`
        });
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
        console.log('metrics being sent:', { url: websiteUrl, phase: nextPhase, metrics: phaseMetrics });
        const analysisResponse = await axios.post(`${process.env.REACT_APP_API_URL}/api/analyze`, {
          url: websiteUrl,
          phase: nextPhase,
          metrics: nextPhase === 'Overall' ? {} : phaseMetrics,
          history: JSON.stringify(messages.slice(-MAX_HISTORY_LENGTH).map(({ role, content }) => ({ role, content }))),
          screenshot: nextPhase === 'Vision' ? evaluationResults.screenshot : undefined
        });

        let score = 0;
        if (nextPhase !== 'Overall') {
          score = await getPhaseScore(nextPhase, phaseMetrics);
        }

        const newAssistantMessage: Message = {
          role: 'assistant',
          content: analysisResponse.data.analysis,
          metrics: nextPhase === 'Overall' ? getPhaseMetrics('Overall', evaluationResults) : phaseMetrics,
          screenshot: nextPhase === 'Overall' ? evaluationResults.screenshot : undefined,
          phase: nextPhase
        };

        addMessage(newAssistantMessage);

        if (nextPhase !== 'Overall') {
          const newPhaseScores = { ...phaseScores, [nextPhase]: score };
          setPhaseScores(newPhaseScores);
          updateOverallScore(newPhaseScores);
        }
      } catch (error) {
        console.error(`error starting ${nextPhase} analysis:`, error);
        addMessage({
          role: 'assistant',
          content: `an error occurred while starting the ${nextPhase} analysis. please try again.`
        });
      }
    } else {
      setCurrentPhase(null); // evaluation complete
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

  const renderMessage = useCallback((message: Message) => (
    <div className={`message ${message.role}`}>
      {message.role === 'assistant' && message.metrics && message.phase && (message.phase === 'Vision' || message.phase !== 'Overall') && (
        <div className="message-score">
          {message.phase}: {phaseScores[message.phase] || 'n/a'}
        </div>
      )}
      <div className="message-content">
        <ReactMarkdown>{message.content}</ReactMarkdown>
      </div>
      {message.metrics && renderMetrics(message.metrics)}
      {message.screenshot && renderScreenshot(message.screenshot)}
    </div>
  ), [renderMetrics, renderScreenshot, phaseScores]);

  const addMessage = useCallback((newMessage: Message) => {
    setMessages(prevMessages => {
      const updatedMessages = [...prevMessages, newMessage];
      if (updatedMessages.length > MAX_HISTORY_LENGTH) {
        return updatedMessages.slice(-MAX_HISTORY_LENGTH);
      }
      return updatedMessages;
    });
  }, []);

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
            <React.Fragment key={index}>
              {renderMessage(message)}
            </React.Fragment>
          ))}
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
          disabled={isLoading}
        />
        <button type="submit" disabled={isLoading || !userInput.trim()} className="chat-submit-button">
          <i className="fas fa-paper-plane"></i>
        </button>
        {currentPhase && currentPhase !== 'Overall' && (
          <button type="button" onClick={handleContinue} disabled={isLoading} className="continue-button">
            Continue
          </button>
        )}
      </form>
    </div>
  );
};

export default React.memo(ChatInterface);