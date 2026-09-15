import { useContext } from 'react';
import { CommandCenterContext, type CommandCenterValue } from '../context/CommandCenterContext.tsx';

export function useCommandCenter(): CommandCenterValue {
  const value = useContext(CommandCenterContext);
  if (!value) throw new Error('useCommandCenter must be used inside CommandCenterProvider');
  return value;
}
