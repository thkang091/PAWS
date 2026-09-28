import { AppTextInput } from "@/components/ui/AppTextInput";

export const SessionNotesInput = ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
  <AppTextInput label="Optional session note" multiline value={value} onChangeText={onChange} placeholder="What did you notice?" />
);
