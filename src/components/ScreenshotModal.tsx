import React, { useEffect, useCallback } from 'react';

interface ScreenshotModalProps {
  screenshot: string;
  metadata?: {
    width: number;
    height: number;
    isFullPage: boolean;
  };
  onClose: () => void;
}

const ScreenshotModal: React.FC<ScreenshotModalProps> = ({ screenshot, metadata, onClose }) => {
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden'; // Prevent background scrolling

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'auto'; // Restore scrolling
    };
  }, [handleKeyDown]);

  return (
    <div className="screenshot-modal-overlay" onClick={onClose}>
      <div className="screenshot-modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="screenshot-modal-close" onClick={onClose}>×</button>
        <div className="screenshot-modal-image-container">
          <img
            src={`data:image/png;base64,${screenshot}`}
            alt="Full page screenshot"
            className="screenshot-modal-image"
          />
        </div>
        {metadata && (
          <div className="screenshot-modal-info">
            {metadata.width}×{metadata.height}px
          </div>
        )}
      </div>
    </div>
  );
};

export default ScreenshotModal; 