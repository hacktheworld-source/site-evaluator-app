// This is a mock AI service for demonstration purposes
export async function analyzeContent(content: string): Promise<string> {
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 1500));

  // Simple keyword-based analysis
  const keywords = ['responsive', 'accessible', 'fast', 'secure', 'user-friendly'];
  const presentKeywords = keywords.filter(keyword => content.toLowerCase().includes(keyword));

  if (presentKeywords.length === 0) {
    return "The content doesn't seem to highlight any key web design principles. Consider incorporating terms related to responsiveness, accessibility, performance, security, and user experience.";
  } else {
    return `The content emphasizes ${presentKeywords.join(', ')}. This is good, but you might also want to consider addressing ${keywords.filter(k => !presentKeywords.includes(k)).join(', ')}.`;
  }
}