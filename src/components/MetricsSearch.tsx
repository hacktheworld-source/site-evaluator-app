import React, { useEffect, useRef } from 'react';

interface MetricsSearchProps {
  onSearch: (term: string) => void;
  onResultSelect: (element: HTMLElement) => void;
}

const MetricsSearch: React.FC<MetricsSearchProps> = ({ onSearch, onResultSelect }) => {
  const searchRef = useRef<HTMLInputElement>(null);
  const currentMatchIndex = useRef<number>(0);
  const matches = useRef<HTMLElement[]>([]);

  const cycleToNextMatch = () => {
    if (matches.current.length === 0) return;

    // Remove active class from current match
    matches.current[currentMatchIndex.current].classList.remove('active');

    // Move to next match (or wrap around to first)
    currentMatchIndex.current = (currentMatchIndex.current + 1) % matches.current.length;

    // Add active class to new current match and scroll to it
    const nextMatch = matches.current[currentMatchIndex.current];
    nextMatch.classList.add('active');
    onResultSelect(nextMatch);
  };

  const handleKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      cycleToNextMatch();
    }
  };

  const highlightMatches = (node: Text, searchTerm: string) => {
    const text = node.textContent || '';
    const lowerText = text.toLowerCase();
    const lowerSearchTerm = searchTerm.toLowerCase();
    
    let currentIndex = 0;
    let result: (Text | HTMLElement)[] = [];
    
    while (true) {
      const matchIndex = lowerText.indexOf(lowerSearchTerm, currentIndex);
      if (matchIndex === -1) break;
      
      // Add text before match
      if (matchIndex > currentIndex) {
        result.push(document.createTextNode(text.slice(currentIndex, matchIndex)));
      }
      
      // Add highlighted match - use original text casing
      const span = document.createElement('span');
      span.className = 'search-match';
      span.textContent = text.slice(matchIndex, matchIndex + searchTerm.length);
      result.push(span);
      matches.current.push(span);
      
      currentIndex = matchIndex + searchTerm.length;
    }
    
    // Add remaining text after last match
    if (currentIndex < text.length) {
      result.push(document.createTextNode(text.slice(currentIndex)));
    }
    
    return result;
  };

  const processNode = (node: Node, searchTerm: string) => {
    if (node.nodeType === Node.TEXT_NODE && node.textContent) {
      const text = node.textContent.toLowerCase();
      const searchLower = searchTerm.toLowerCase();
      if (text.includes(searchLower)) {
        const highlightedParts = highlightMatches(node as Text, searchTerm);
        // Always replace the node if we have any parts (not just when length > 1)
        const fragment = document.createDocumentFragment();
        highlightedParts.forEach(part => fragment.appendChild(part));
        node.parentNode?.replaceChild(fragment, node);
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      // Skip if this element or its parent is already a search match
      if (!node.parentElement?.classList.contains('search-match') && 
          !(node as Element).classList.contains('search-match')) {
        // Recursively process child nodes
        Array.from(node.childNodes).forEach(child => processNode(child, searchTerm));
      }
    }
  };

  const handleSearch = (event: React.ChangeEvent<HTMLInputElement>) => {
    const searchTerm = event.target.value;
    onSearch(searchTerm);
    
    // Clear previous highlights
    document.querySelectorAll('.search-match').forEach(el => {
      const parent = el.parentNode;
      if (parent) {
        parent.replaceChild(document.createTextNode(el.textContent || ''), el);
        parent.normalize();
      }
    });

    if (searchTerm) {
      // Find and highlight matches
      const metricsPanel = document.querySelector('.metrics-scrollable');
      if (!metricsPanel) return;

      matches.current = [];
      
      // Process all nodes recursively
      processNode(metricsPanel, searchTerm);

      // Highlight and scroll to first match
      if (matches.current.length > 0) {
        currentMatchIndex.current = 0;
        const firstMatch = matches.current[0];
        firstMatch.classList.add('active');
        onResultSelect(firstMatch);
      }
    }
  };

  useEffect(() => {
    // Cleanup highlights when component unmounts
    return () => {
      document.querySelectorAll('.search-match').forEach(el => {
        const parent = el.parentNode;
        if (parent) {
          parent.replaceChild(document.createTextNode(el.textContent || ''), el);
          parent.normalize();
        }
      });
    };
  }, []);

  return (
    <div className="metrics-search">
      <input
        ref={searchRef}
        type="text"
        placeholder="Search metrics..."
        onChange={handleSearch}
        onKeyPress={handleKeyPress}
        className="metrics-search-input"
      />
    </div>
  );
};

export default MetricsSearch;
