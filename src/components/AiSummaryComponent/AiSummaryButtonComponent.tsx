import React, { useState } from "react";
import { Button } from '@mantine/core';
import { collection, doc, getDocs, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { INote, NoteCategory } from '../ThreeColumnsGridComponent/ThreeColumnsGridComponent';
import { getAuth } from 'firebase/auth';
import { IconSparkles } from '@tabler/icons-react';

interface IAiSummaryComponentProps {
  sprintId: string;
}

const AiSummaryButtonComponent = ({ sprintId }: IAiSummaryComponentProps) => {
  const [loading, setLoading] = useState(false);

  const getSprintItems = async () => {
    const sprintDocRef = doc(db, 'sprints', sprintId);
    const itemsRef = collection(sprintDocRef, 'items');

    try {
      const snapshot = await getDocs(itemsRef);
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      return {
        goodItems: items
          .filter((item: INote) => item.category === NoteCategory.Good)
          .map((item: INote) => item.text),

        badItems: items
          .filter((item: INote) => item.category === NoteCategory.Bad)
          .map((item: INote) => item.text),

        actionItems: items
          .filter((item: INote) => item.category === NoteCategory.ActionItem)
          .map((item: INote) => item.text),
      };
    } catch (error) {
      console.error('Error fetching sprint items:', error);
      return [];
    }
  };

  const handleGenerateSummary = async () => {
    setLoading(true);
    const itemsText: any = await getSprintItems();
    const sprintDocRef = doc(db, 'sprints', sprintId);

    const { goodItems, badItems, actionItems } = itemsText;

    const prompt = `
      You are a helpful assistant summarizing a sprint retrospective. The notes are categorized into three columns: Good, Bad, and Action Items.

      Here are the notes:

      Good: ${goodItems.length ? goodItems.map((item: string) => `- ${item}`).join('\n') : '- none'}

      Bad: ${badItems.length ? badItems.map((item: string) => `- ${item}`).join('\n') : '- none'}

      Action Items: ${actionItems.length ? actionItems.map((item: string) => `- ${item}`).join('\n') : '- none'}

      Please write a concise and professional summary in english of this sprint retrospective, highlighting key takeaways, issues, and next steps.
    `;

    try {
    // Get current user ID token
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) {
      throw new Error("User not authenticated");
    }
    const idToken = await user.getIdToken();

      const response = await fetch("https://generatesummary-jkkmrgixhq-uc.a.run.app", {
        method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ prompt }),
      });

      if (!response.ok) throw new Error("Failed to fetch summary");

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content ?? "No summary generated.";
      await updateDoc(sprintDocRef, { summary: content });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Button
        variant='light'
        radius={6}
        onClick={handleGenerateSummary}
        loading={loading}
        rightSection={<IconSparkles />}
      >
        Generate Summary
      </Button>
    </div>
  );
};

export default AiSummaryButtonComponent;
