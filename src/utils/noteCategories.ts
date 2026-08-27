import { INote } from '../components/ThreeColumnsGridComponent/ThreeColumnsGridComponent';

export const CATEGORY_DISPLAY: Record<string, string> = {
  good: 'Good',
  bad: 'Bad',
  action: 'Action Items'
};

export const CATEGORY_ORDER = ['good', 'bad', 'action'];

export const getCategoryCounts = (items: INote[]): Record<string, number> => {
  const publishedItems = items.filter((item) => item.published);
  return publishedItems.reduce((acc, note) => {
    acc[note.category] = (acc[note.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
};
