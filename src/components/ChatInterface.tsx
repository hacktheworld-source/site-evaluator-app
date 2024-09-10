import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';

const MAX_HISTORY_LENGTH = 50; // Increased from 10 to 50

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

  const phases = ['UI', 'Functionality', 'Performance', 'SEO', 'Overall'];

  useEffect(() => {
    if (evaluationResults) {
      startUIAnalysis();
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
        metrics: metrics
      });
      return response.data.score || 0; // return 0 if score is null or undefined
    } catch (error) {
      console.error(`error getting ${phase} score:`, error);
      return 0;
    }
  };

  const startUIAnalysis = async () => {
    const uiMetrics = getPhaseMetrics('UI', evaluationResults);
    
    try {
      console.log('sending ui analysis request with metrics:', { url: websiteUrl, phase: 'UI', metrics: uiMetrics });
      const analysisResponse = await axios.post(`${process.env.REACT_APP_API_URL}/api/analyze`, {
        url: websiteUrl,
        phase: 'UI',
        metrics: uiMetrics,
        history: JSON.stringify(messages.slice(-MAX_HISTORY_LENGTH).map(({ role, content }) => ({ role, content })))
      });

      const score = await getPhaseScore('UI', uiMetrics);

      console.log('received ui analysis response:', analysisResponse.data);

      const initialMessage: Message = {
        role: 'assistant',
        content: analysisResponse.data.analysis,
        metrics: uiMetrics,
        screenshot: evaluationResults.screenshot,
        phase: 'UI'
      };
      addMessage(initialMessage);
      setCurrentPhase('UI');

      // update phase scores and overall score
      const newPhaseScores = { ...phaseScores, UI: score };
      setPhaseScores(newPhaseScores);
      updateOverallScore(newPhaseScores);
    } catch (error) {
      console.error('error starting ui analysis:', error);
      if (axios.isAxiosError(error) && error.response) {
        console.error('server response:', error.response.data);
      }
      addMessage({
        role: 'assistant',
        content: 'an error occurred while starting the ui analysis. please try again.'
      });
    }
  };

  const getPhaseMetrics = (phase: string, allMetrics: any) => {
    switch (phase) {
      case 'UI':
        return {
          colorContrast: allMetrics.colorContrast,
          fontSizes: allMetrics.fontSizes,
          responsiveness: allMetrics.responsiveness,
          accessibility: allMetrics.accessibility
        };
      case 'Functionality':
        return {
          brokenLinks: allMetrics.brokenLinks,
          formFunctionality: allMetrics.formFunctionality,
          bestPractices: allMetrics.bestPractices
        };
      case 'Performance':
        return {
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
      case 'SEO':
        return {
          seo: allMetrics.seo
        };
      case 'Overall':
        // For Overall phase, return all metrics
        const { htmlContent, screenshot, ...overallMetrics } = allMetrics;
        return overallMetrics;
      default:
        return {};
    }
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
        const response = await axios.post(`${process.env.REACT_APP_API_URL}/api/chat`, {
          url: websiteUrl,
          phase: currentPhase || 'Overall', // Use 'Overall' if currentPhase is null
          message: newUserMessage.content,
          history: JSON.stringify(messages.slice(-MAX_HISTORY_LENGTH).map(({ role, content }) => ({ role, content })))
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
        console.log('metrics being sent:', { url: websiteUrl, phase: nextPhase, metrics: nextPhase === 'Overall' ? {} : phaseMetrics });
        const analysisResponse = await axios.post(`${process.env.REACT_APP_API_URL}/api/analyze`, {
          url: websiteUrl,
          phase: nextPhase,
          metrics: nextPhase === 'Overall' ? {} : phaseMetrics,
          history: JSON.stringify(messages.slice(-MAX_HISTORY_LENGTH).map(({ role, content }) => ({ role, content })))
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
          if (typeof value === 'object' && value !== null) {
            return (
              <div key={key} className="metric-tile">
                <div className="metric-title">{key}</div>
                {Object.entries(value).map(([subKey, subValue]) => (
                  <div key={subKey} className="metric-value">
                    <strong>{subKey}:</strong> {renderMetricValue(subValue)}
                  </div>
                ))}
              </div>
            );
          } else {
            return (
              <div key={key} className="metric-tile">
                <div className="metric-title">{key}</div>
                <div className="metric-value">{renderMetricValue(value)}</div>
              </div>
            );
          }
        }
        return null;
      })}
    </div>
  ), []);

  const renderMetricValue = (value: any): React.ReactNode => {
    if (value === null || value === undefined) {
      return 'N/A';
    } else if (typeof value === 'number') {
      return value.toFixed(2);
    } else if (typeof value === 'string') {
      return value || 'N/A';
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
    } else if (typeof value === 'object') {
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

  const renderScreenshot = useCallback((screenshot: string) => (
    <img 
      src={`data:image/png;base64,${screenshot}`} 
      alt="website screenshot" 
      className="website-screenshot fade-in" 
    />
  ), []);

  const renderMessage = useCallback((message: Message) => (
    <div className={`message ${message.role}`}>
      {message.role === 'assistant' && message.metrics && message.phase && message.phase !== 'Overall' && (
        <div className="message-score">
          score: {phaseScores[message.phase] || 'n/a'}
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
      <div className="chat-input">
        <input
          type="text"
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          placeholder="ask a question..."
          disabled={isLoading}
        />
        <button onClick={handleSendMessage} disabled={isLoading || !userInput.trim()}>
          send
        </button>
        {currentPhase && currentPhase !== 'Overall' && (
          <button onClick={handleContinue} disabled={isLoading}>
            continue
          </button>
        )}
      </div>
    </div>
  );
};

export default React.memo(ChatInterface);