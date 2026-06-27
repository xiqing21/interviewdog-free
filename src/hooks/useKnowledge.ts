import { useContext } from 'react';
import { KnowledgeContext } from '../context/KnowledgeContext';

export function useKnowledge() {
  const context = useContext(KnowledgeContext);
  if (!context) {
    throw new Error('useKnowledge must be used within KnowledgeProvider');
  }
  return context;
}
