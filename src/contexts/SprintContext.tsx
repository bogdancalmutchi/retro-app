import React, { createContext, useContext, useState } from 'react';

const SprintContext = createContext<{ sprintId: string | null; setSprintId: (id: string) => void }>({
  sprintId: null,
  setSprintId: () => {},
});

export const SprintProvider = ({ children }: { children: React.ReactNode }) => {
  const [sprintId, setSprintId] = useState<string | null>(null);

  return (
    <SprintContext.Provider value={{ sprintId, setSprintId }}>
      {children}
    </SprintContext.Provider>
  );
};

export const useSprint = () => useContext(SprintContext);
