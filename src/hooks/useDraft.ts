import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface DraftStore<T> {
  draft: T | null;
  setDraft: (data: T) => void;
  clearDraft: () => void;
}

export const createDraftStore = <T>(key: string) => 
  create<DraftStore<T>>()(
    persist(
      (set) => ({
        draft: null,
        setDraft: (data: T) => set({ draft: data }),
        clearDraft: () => set({ draft: null }),
      }),
      {
        name: `draft-${key}`,
      }
    )
  );

export function useDraft<T>(key: string) {
  const store = createDraftStore<T>(key);
  
  return {
    draft: store.getState().draft,
    setDraft: store.getState().setDraft,
    clearDraft: store.getState().clearDraft,
    subscribe: store.subscribe,
  };
}

// Example usage:
// 
// // Create a draft for a form
// const { draft, setDraft, clearDraft, subscribe } = useDraft<UserFormData>('user-form');
// 
// // Save draft when form changes
// const handleChange = (formData: UserFormData) => {
//   setDraft(formData);
// };
// 
// // Subscribe to draft changes
// useEffect(() => {
//   const unsubscribe = subscribe((state) => {
//     if (state.draft) {
//       console.log('Draft updated:', state.draft);
//     }
//   });
//   
//   return () => unsubscribe();
// }, [subscribe]);
// 
// // Clear draft when form is submitted
// const handleSubmit = async () => {
//   await submitForm(formData);
//   clearDraft();
// };

