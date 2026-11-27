import { createContext, useContext, useRef, useState, type PropsWithChildren } from 'react';
import { WORKOUT_DURATION, type BodyPart, type MenuItem } from '../../../supabase/functions/_shared/menu';
import type { ReplacementRequest } from '../../../supabase/functions/_shared/replacements';
import { replaceInProposal, type Proposal } from './proposal';

type WorkoutState = {
  bodyParts: BodyPart[];
  gymAvailable: boolean | null;
  durationMinutes: number;
  proposal: Proposal | null;
  setBodyParts: (parts: BodyPart[]) => void;
  setGymAvailable: (available: boolean) => void;
  setDurationMinutes: (minutes: number) => void;
  setProposal: (proposal: Proposal | null) => void;
  replaceExercise: (snapshot: Proposal, request: ReplacementRequest, candidate: MenuItem) => void;
};
const Context = createContext<WorkoutState | null>(null);

export function WorkoutProvider({ children }: PropsWithChildren) {
  const [bodyParts, setBodyParts] = useState<BodyPart[]>([]);
  const [gymAvailable, setGymAvailable] = useState<boolean | null>(null);
  const [durationMinutes, setDurationMinutes] = useState<number>(WORKOUT_DURATION.default);
  const [proposal, updateProposal] = useState<Proposal | null>(null);
  const current = useRef<Proposal | null>(null);
  function setProposal(value: Proposal | null) { current.current = value; updateProposal(value); }
  function replaceExercise(snapshot: Proposal, request: ReplacementRequest, candidate: MenuItem) {
    setProposal(replaceInProposal(current.current, snapshot, request, candidate));
  }
  return <Context.Provider value={{ bodyParts, setBodyParts, gymAvailable, setGymAvailable, durationMinutes, setDurationMinutes, proposal, setProposal, replaceExercise }}>{children}</Context.Provider>;
}

export function useWorkout() {
  const value = useContext(Context);
  if (!value) throw new Error('WorkoutProvider is missing');
  return value;
}
