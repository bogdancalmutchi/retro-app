import * as React from 'react';
import { Box, Button, Tooltip, Transition } from '@mantine/core';

import customStyles from './GradientBorderButtonComponent.module.scss';

interface IGradientBorderButtonComponentProps {
  unpublishedNotes: any[];
  onPublishNotes: () => void;
  disabled: boolean;
}

const GradientBorderButtonComponent = (props: IGradientBorderButtonComponentProps) => {
  const {
    unpublishedNotes,
    onPublishNotes,
    disabled
  } = props;

  return (
    <Transition
      mounted={!!unpublishedNotes.length}
      transition='slide-left'
      duration={400}
      timingFunction='ease'
    >
      {(styles) => (
        <Tooltip disabled={!disabled} color='blue' label="Can't publish while editing">
          <Box className={`${customStyles.gradientBorderWrapper} ${customStyles.transitionBox}`} style={styles}>
            <Button
              variant='default'
              radius={6}
              className={customStyles.gradientButton}
              onClick={onPublishNotes}
              disabled={disabled}
            >
              Publish All Notes
            </Button>
          </Box>
        </Tooltip>
      )}
    </Transition>
  );
};

export default GradientBorderButtonComponent;
