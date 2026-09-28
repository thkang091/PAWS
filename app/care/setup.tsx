import { CareSetupFlow } from "@/features/care/components/CareSetupFlow";
import { goBack } from "@/features/care/components/DetailShell";

export default function CareSetupScreen() {
  return <CareSetupFlow onDone={() => goBack("/(tabs)/care")} />;
}
