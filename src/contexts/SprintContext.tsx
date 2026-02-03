import React, { createContext, useContext, useState } from 'react';

type SprintContextType = {
  sprintId: string | null;
  setSprintId: (id: string) => void;
  isOpen: boolean;
  setIsOpen: (value: boolean) => void;
  presenterId: string | null;
  setPresenterId: (id: string | null) => void;
  highlightedCardId: string | null;
  setHighlightedCardId: (id: string | null) => void;
};

const SprintContext = createContext<SprintContextType>({
  sprintId: null,
  setSprintId: () => {},
  isOpen: true,
  setIsOpen: () => {},
  presenterId: null,
  setPresenterId: () => {},
  highlightedCardId: null,
  setHighlightedCardId: () => {}
});

export const SprintProvider = ({ children }: { children: React.ReactNode }) => {
  const [sprintId, setSprintId] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState<boolean>(true);
  const [presenterId, setPresenterId] = useState<string | null>(null);
  const [highlightedCardId, setHighlightedCardId] = useState<string | null>(null);

  return (
    <SprintContext.Provider value={{
      sprintId, setSprintId,
      isOpen, setIsOpen,
      presenterId, setPresenterId,
      highlightedCardId, setHighlightedCardId
    }}>
      {children}
    </SprintContext.Provider>
  );
};

export const useSprint = () => useContext(SprintContext);
