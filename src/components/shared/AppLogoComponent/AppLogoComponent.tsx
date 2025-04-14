import * as React from 'react';
import { Avatar, Text } from '@mantine/core';
import classNames from 'classnames';

import styles from './AppLogoComponent.module.scss';

interface IAppLogoComponentProps {
  onClick?: () => void;
  style?: React.CSSProperties;
  className?: string;
}

const AppLogoComponent = (props: IAppLogoComponentProps) => {
  const {
    onClick,
    style,
    className
  } = props;

  return (
    <div className={classNames(styles.logoContainer, className)}>
      <Avatar
        style={style}
        onClick={onClick}
        radius='md'
        src='/favicon.svg'
      />
      <div className={styles.logoTextContainer}>
        <Text
          className={styles.logoTextPartOne}
        >
          sprint
        </Text>
        <Text
          className={styles.logoTextPartTwo}
          variant='gradient'
          gradient={{ from: 'indigo', to: 'cyan', deg: 90 }}
        >
          ECHO
        </Text>
      </div>
    </div>
  );
};

export default AppLogoComponent;
