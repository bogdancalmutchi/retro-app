import * as React from 'react';
import { Box, Button, Transition } from '@mantine/core';

import customStyles from './GradientBorderButtonComponent.module.scss';

interface IGradientBorderButtonComponentProps {
  unpublishedNotes: any[];
  onPublishNotes: () => void;
}

const GradientBorderButtonComponent = (props: IGradientBorderButtonComponentProps) => {
  const {
    unpublishedNotes,
    onPublishNotes
  } = props;

  return (
    <Transition
      mounted={!!unpublishedNotes.length}
      transition='slide-left'
      duration={400}
      timingFunction='ease'
    >
      {(styles) => (
        <Box className={`${customStyles.gradientBorderWrapper} ${customStyles.transitionBox}`} style={styles}>
          <Button
            variant='default'
            radius={6}
            className={customStyles.gradientButton}
            onClick={onPublishNotes}
          >
            Publish All Notes
          </Button>
        </Box>
      )}
    </Transition>
  );
};

export default GradientBorderButtonComponent;
