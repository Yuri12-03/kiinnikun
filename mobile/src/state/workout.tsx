import { createContext, useContext, useState, type PropsWithChildren } from 'react';
import type { BodyPart, Conditions, Menu } from '../../../supabase/functions/_shared/menu';

type Proposal = { conditions: Conditions; menu: Menu };
type WorkoutState = {
  bodyParts: BodyPart[];
  gymAvailable: boolean | null;
  proposal: Proposal | null;
  setBodyParts: (parts: BodyPart[]) => void;
  setGymAvailable: (available: boolean) => void;
  setProposal: (proposal: Proposal | null) => void;
};
const Context = createContext<WorkoutState | null>(null);

export function WorkoutProvider({ children }: PropsWithChildren) {
  const [bodyParts, setBodyParts] = useState<BodyPart[]>([]);
  const [gymAvailable, setGymAvailable] = useState<boolean | null>(null);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  return <Context.Provider value={{ bodyParts, setBodyParts, gymAvailable, setGymAvailable, proposal, setProposal }}>{children}</Context.Provider>;
}

export function useWorkout() {
  const value = useContext(Context);
  if (!value) throw new Error('WorkoutProvider is missing');
  return value;
}
