import * as React from 'react';
import { Tooltip } from '@mantine/core';

interface IDisabledTooltipWrapperProps {
  children: React.ReactNode;
  disabled?: boolean;
}

const DisabledTooltipWrapper = (props: IDisabledTooltipWrapperProps) => {
  const {
    children,
    disabled
  } = props;

  return (
    <Tooltip.Floating disabled={disabled} color='blue' label='Cannot make changes to a closed sprint.'>
      {children}
    </Tooltip.Floating>
  );
};

export default DisabledTooltipWrapper;
