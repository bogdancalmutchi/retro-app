import * as React from 'react';
import { useEffect } from 'react';
import { Avatar, Text, Transition } from '@mantine/core';
import classNames from 'classnames';

import styles from './AnimatedAppLogoComponent.module.scss';

interface IAppLogoComponentProps {
  onClick?: () => void;
  style?: React.CSSProperties;
  className?: string;
}

const AnimatedAppLogoComponent = ({ onClick, style, className }: IAppLogoComponentProps) => {
  const [showLogo, setShowLogo] = React.useState(false);
  const [showText, setShowText] = React.useState(false);

  useEffect(() => {
    setShowLogo(true);
  }, []);

  const renderLogo = () => (
    <Avatar
      style={style}
      onClick={onClick}
      radius='md'
      src='/favicon.svg'
    />
  );

  const renderLogoText = () => (
    <div className={styles.logoTextContainer}>
      <Text className={styles.logoTextPartOne}>sprint</Text>
      <Text
        className={styles.logoTextPartTwo}
        variant='gradient'
        gradient={{ from: 'indigo', to: 'cyan', deg: 90 }}
      >
        ECHO
      </Text>
    </div>
  );

  return (
    <div className={classNames(styles.logoContainer, className)}>
      <Transition
        mounted={showLogo}
        transition='fade-up'
        duration={800}
        timingFunction='ease'
        keepMounted
        enterDelay={400}
        onEntered={() => setShowText(true)}
      >
        {(transitionStyles) => (
          <div style={transitionStyles}>{renderLogo()}</div>
        )}
      </Transition>

      <Transition
        mounted={showText}
        transition='fade-right'
        duration={800}
        timingFunction='ease'
        keepMounted
      >
        {(transitionStyles) => (
          <div style={transitionStyles}>{renderLogoText()}</div>
        )}
      </Transition>
    </div>
  );
};

export default AnimatedAppLogoComponent;
