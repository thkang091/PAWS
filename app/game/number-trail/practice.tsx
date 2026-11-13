import { Redirect } from "expo-router";

/** Practice now starts from where you are: which numbers your streets can draw (Numbers Near You). */
export default function PracticeRedirect() {
  return <Redirect href="/game/number-trail/near" />;
}
