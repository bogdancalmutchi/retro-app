import React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Center, Pagination, Skeleton, Text } from '@mantine/core';
import { collection, query, orderBy, onSnapshot, where, limit } from 'firebase/firestore';

import { db } from '../../firebase';
import CreateSprintModalComponent from '../CreateSprintModalComponent/CreateSprintModalComponent';
import CardComponent, { ISprint } from '../CardComponent/CardComponent';
import LiveSprintPanelComponent from '../LiveSprintPanelComponent/LiveSprintPanelComponent';

import styles from './HomePageComponent.module.scss';

const PAGE_SIZE = 8;
const MAX_SPRINTS = 60;

const HomePageComponent = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedTeam = searchParams.get('team') || 'Protoss';
  const [sprints, setSprints] = useState<ISprint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateSprintModalOpen, setIsCreateSprintModalOpen] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    const q = query(
      collection(db, 'sprints'),
      where('team', '==', selectedTeam),
      orderBy('createdAt', 'desc'),
      limit(MAX_SPRINTS)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setSprints(
          snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as ISprint)
        );
        setIsLoading(false);
      },
      (error) => {
        console.error('Failed to load sprints:', error);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [selectedTeam]);

  const openSprint = useMemo(() => sprints.find((sprint) => sprint.isOpen), [sprints]);
  const closedSprints = useMemo(() => sprints.filter((sprint) => !sprint.isOpen), [sprints]);

  const totalPages = Math.max(1, Math.ceil(closedSprints.length / PAGE_SIZE));
  const page = Math.min(Math.max(1, Number(searchParams.get('page')) || 1), totalPages);

  const pageSprints = useMemo(
    () => closedSprints.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [closedSprints, page]
  );
  const handlePageChange = (nextPage: number) => {
    const params: Record<string, string> = { team: selectedTeam };
    if (nextPage > 1) params.page = String(nextPage);
    setSearchParams(params);
  };

  const renderToolbar = () => (
    <div className={styles.toolbar}>
      {isLoading ? (
        <Skeleton height={16} width={120} />
      ) : (
        <Text fz='sm' c='dimmed'>
          {`${sprints.length} ${sprints.length === 1 ? 'sprint' : 'sprints'} · ${selectedTeam}`}
        </Text>
      )}
    </div>
  );

  const renderArchiveDivider = () => (
    <div className={styles.dividerRow}>
      <span className={styles.dividerLabel}>Archive</span>
      {!isLoading && (
        <span className={styles.dividerCount}>
          {`${closedSprints.length} closed ${closedSprints.length === 1 ? 'sprint' : 'sprints'}`}
        </span>
      )}
      <span className={styles.dividerLine} />
    </div>
  );

  const renderGrid = () => (
    <div className={styles.grid}>
      {pageSprints.map((sprint) => (
        <CardComponent sprint={sprint} key={sprint.id} />
      ))}
    </div>
  );

  return (
    <div className={styles.page}>
      <CreateSprintModalComponent
        isModalOpen={isCreateSprintModalOpen}
        onClose={() => setIsCreateSprintModalOpen(false)}
        currentSelectedTeam={selectedTeam}
      />
      <div className={styles.block}>
        {renderToolbar()}
        {isLoading ? (
          <Skeleton height={152} radius='md' />
        ) : (
          <LiveSprintPanelComponent
            sprint={openSprint}
            team={selectedTeam}
            onCreateSprint={() => setIsCreateSprintModalOpen(true)}
          />
        )}
        {(isLoading || closedSprints.length > 0) && (
          <>
            {renderArchiveDivider()}
            {isLoading ? (
              <div className={styles.grid}>
                {Array.from({ length: PAGE_SIZE }, (_, index) => (
                  <Skeleton key={index} height={257} radius='md' />
                ))}
              </div>
            ) : (
              renderGrid()
            )}
            {(!isLoading && totalPages > 1) && (
              <Center mt='xl'>
                <Pagination total={totalPages} value={page} onChange={handlePageChange} />
              </Center>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default HomePageComponent;
