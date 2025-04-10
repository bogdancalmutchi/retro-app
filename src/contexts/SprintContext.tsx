import React, { createContext, useContext, useState } from 'react';

type SprintContextType = {
  sprintId: string | null;
  setSprintId: (id: string) => void;
  isOpen: boolean
  setIsOpen: (value: boolean) => void;
};

const SprintContext = createContext<SprintContextType>({
  sprintId: null,
  setSprintId: () => {},
  isOpen: true,
  setIsOpen: () => {},
});

export const SprintProvider = ({ children }: { children: React.ReactNode }) => {
  const [sprintId, setSprintId] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState<boolean>(true);

  return (
    <SprintContext.Provider value={{ sprintId, setSprintId, isOpen, setIsOpen }}>
      {children}
    </SprintContext.Provider>
  );
};

export const useSprint = () => useContext(SprintContext);
