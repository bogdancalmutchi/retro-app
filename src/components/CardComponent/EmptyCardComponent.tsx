import * as React from 'react';
import { Paper, Image } from '@mantine/core';

import styles from './CardComponent.module.scss';

interface IEmptyCardComponentProps {
  onCardClick?: () => void;
}

const EmptyCardComponent = (props: IEmptyCardComponentProps) => {
  const {
    onCardClick
  } = props;

  return (
    <Paper onClick={onCardClick} withBorder shadow='md' radius='md' p='xl' className={styles.emptyCardContainer}>
      <Image src='/retro-app/plus.svg' />
    </Paper>
  );
};

export default EmptyCardComponent;
