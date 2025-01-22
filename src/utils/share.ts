interface ShareOptions {
  title?: string;
  text?: string;
  url: string;
}

export const shareOnX = async ({ title, text, url }: ShareOptions) => {
  const tweetText = title ? `${title}\n\n${text || ''}` : text;
  const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
    tweetText || ''
  )}&url=${encodeURIComponent(url)}`;
  window.open(tweetUrl, '_blank');
};

export const formatDocumentForSharing = (doc: any, includeQA: boolean = false) => {
  let text = '';
  
  // Add title
  if (doc.name) {
    text += `📄 ${doc.name}\n\n`;
  }

  // Add content
  if (doc.content) {
    text += `${doc.content}\n\n`;
  }

  // Add Q&A if requested
  if (includeQA && doc.question && doc.answer) {
    text += `❓ Question:\n${doc.question}\n\n`;
    text += `💡 Answer:\n${doc.answer}\n\n`;
  }

  // Add source if available
  if (doc.metadata?.source_url) {
    text += `🔗 Source: ${doc.metadata.source_url}\n`;
  }

  return text;
};
