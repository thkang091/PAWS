import { Redirect } from "expo-router";

/** Number Trail starts from where you are (Numbers Near You). Nearby races are picked inside a room. */
export default function NumberTrailRedirect() {
  return <Redirect href="/game/number-trail/near" />;
}
