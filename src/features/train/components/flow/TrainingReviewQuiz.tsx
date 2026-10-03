import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { CheckIcon, ArrowCounterClockwiseIcon, PlayIcon } from "phosphor-react-native";
import { PressScale } from "@/components/ui/PressScale";
import { TrainingFlowButton, TrainingFlowScreen } from "./TrainingFlowScreen";
import { accent, bg, border, layout, radius, space, text, type } from "@/constants/design";

export type TrainingReviewQuestion = {
  id: string;
  lessonTitle: string;
  level: number;
  concept: string;
  prompt: string;
  options: readonly { id: string; label: string }[];
  correctOptionId: string;
  explanation: string;
  cueAt: number;
};
export type TrainingReviewAnswer = { questionId: string; optionId: string };

/** The preview uses local state; live rounds pass their persisted cursor and answers. */
export function TrainingReviewQuiz({ questions, onComplete, onClose, onWatch, saved, onAnswer, onAdvance, busy = false, error }: {
  questions: readonly TrainingReviewQuestion[];
  onComplete: (answers: TrainingReviewAnswer[]) => void;
  onClose: () => void;
  onWatch: (question: TrainingReviewQuestion) => void;
  saved?: { index: number; answers: TrainingReviewAnswer[] };
  onAnswer?: (answer: TrainingReviewAnswer) => void;
  onAdvance?: () => void;
  busy?: boolean;
  error?: string | null;
}) {
  const [localIndex, setIndex] = useState(0);
  const [draft, setDraft] = useState<{ questionId: string; optionId: string } | null>(null);
  const [localAnswers, setAnswers] = useState<TrainingReviewAnswer[]>([]);
  const index = saved?.index ?? localIndex;
  const answers = saved?.answers ?? localAnswers;
  const question = questions[index];
  const selected = answers[index]?.optionId ?? (draft?.questionId === question?.id ? draft?.optionId : null);
  const checked = answers.length > index;
  const correct = selected === question?.correctOptionId;
  const last = index === questions.length - 1;

  if (!question) return <TrainingFlowScreen label="Review quiz" onClose={onClose} footer={<TrainingFlowButton label="Start training" onPress={() => onComplete([])} />}>
    <Text style={styles.title}>Ready to keep going?</Text>
    <Text style={styles.copy}>Your next practice is ready.</Text>
  </TrainingFlowScreen>;

  const advance = () => {
    if (!selected || busy) return;
    if (!checked) {
      if (onAnswer) { onAnswer({ questionId: question.id, optionId: selected }); return; }
      setAnswers(previous => [...previous, { questionId: question.id, optionId: selected }]);
    } else if (onAdvance) {
      onAdvance();
    } else if (last) {
      onComplete(answers);
    } else {
      setIndex(previous => previous + 1);
      setDraft(null);
    }
  };

  return <TrainingFlowScreen contentKey={question.id} revealEnd={checked} label={`Review quiz · ${index + 1} of ${questions.length}`} onClose={onClose} progress={{ current: index + (checked ? 1 : 0), total: questions.length }} footer={
    <TrainingFlowButton label={busy ? "Saving…" : checked ? last ? "Start training" : "Continue" : "Check answer"} disabled={!selected || busy} onPress={advance} />
  }>
    <View style={styles.context}>
      <ArrowCounterClockwiseIcon size={20} color={text.secondary} />
      <View style={styles.flex}><Text style={styles.eyebrow}>FROM YOUR TRAINING</Text><Text style={styles.contextTitle}>{question.lessonTitle}</Text></View>
    </View>
    <Text accessibilityRole="header" style={styles.title}>{question.prompt}</Text>
    <View style={styles.options} accessibilityRole="radiogroup" accessibilityLabel="Choose an answer">
      {question.options.map((option) => {
        const isSelected = selected === option.id;
        const isCorrect = checked && option.id === question.correctOptionId;
        return <PressScale key={option.id} accessibilityRole="radio" accessibilityLabel={option.label} accessibilityState={{ checked: isSelected, disabled: checked || busy }} aria-checked={isSelected} disabled={checked || busy} onPress={() => setDraft({ questionId: question.id, optionId: option.id })} style={[styles.option, isSelected && styles.selected, isCorrect && styles.correct]}>
          <View style={[styles.radio, isSelected && styles.radioSelected]}>{isCorrect ? <CheckIcon size={16} color={text.primary} weight="bold" /> : isSelected ? <View style={styles.dot} /> : null}</View>
          <Text style={[styles.optionText, (isSelected || isCorrect) && styles.emphasis]}>{option.label}</Text>
        </PressScale>;
      })}
    </View>
    {checked ? <View style={styles.feedback} accessibilityLiveRegion="polite">
      <Text style={styles.feedbackTitle}>{correct ? "That's right" : "For your next try"}</Text>
      <Text style={styles.copy}>{question.explanation}</Text>
      <PressScale accessibilityRole="button" accessibilityLabel="Watch this moment" onPress={() => onWatch(question)} style={styles.watch}>
        <PlayIcon size={18} color={text.primary} weight="fill" /><Text style={styles.watchText}>Watch this moment</Text>
      </PressScale>
    </View> : null}
    {error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}
  </TrainingFlowScreen>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  error: { ...type.supporting, color: "#B3261E" },
  context: { flexDirection: "row", gap: space.md, alignItems: "center" },
  eyebrow: { ...type.eyebrow, color: text.tertiary, marginBottom: space.xs },
  contextTitle: { ...type.supporting, color: text.secondary },
  title: { ...type.pageTitle, color: text.primary },
  copy: { ...type.body, color: text.secondary },
  options: { gap: space.md },
  option: { minHeight: 72, flexDirection: "row", alignItems: "center", gap: space.md, borderRadius: radius.card, borderWidth: 1.5, borderColor: border.soft, padding: space.lg, backgroundColor: bg.canvas },
  selected: { backgroundColor: accent.soft, borderColor: accent.band },
  correct: { backgroundColor: accent.primary, borderColor: accent.pressed },
  radio: { width: 24, height: 24, borderRadius: radius.pill, borderWidth: 1.5, borderColor: border.strong, alignItems: "center", justifyContent: "center" },
  radioSelected: { borderColor: text.primary },
  dot: { width: 10, height: 10, borderRadius: radius.pill, backgroundColor: text.primary },
  optionText: { ...type.body, color: text.primary, flex: 1 },
  emphasis: { fontWeight: "600" },
  feedback: { backgroundColor: accent.soft, borderRadius: radius.card, padding: space.lg, gap: space.sm },
  feedbackTitle: { ...type.sectionTitle, color: text.primary },
  watch: { minHeight: layout.iconButton, flexDirection: "row", gap: space.sm, alignItems: "center" },
  watchText: { ...type.supporting, color: text.primary, fontWeight: "600" },
});
