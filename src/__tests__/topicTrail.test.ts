import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { JsxEmit, ModuleKind, ScriptTarget, transpileModule } from "typescript";

jest.mock("react-native", () => ({
  View: "View", Text: "Text", Pressable: "Pressable",
  StyleSheet: { create: (styles: unknown) => styles },
}));
jest.mock("react-native-reanimated", () => ({ __esModule: true, default: { View: "AnimatedView" } }));
jest.mock("react-native-svg", () => ({ __esModule: true, default: "Svg", Circle: "Circle" }));
jest.mock("expo-haptics", () => ({}));
jest.mock("phosphor-react-native", () => ({
  BarbellIcon: "BarbellIcon", BookOpenIcon: "BookOpenIcon", CheckIcon: "CheckIcon",
  PawPrintIcon: "PawPrintIcon", StarIcon: "StarIcon",
}));
jest.mock("@/features/onboarding/components/Reveal", () => ({ Reveal: "Reveal" }));
jest.mock("@/features/train/components/TrainCompanion", () => ({ TrainCompanion: "TrainCompanion" }));
jest.mock("@/features/train/components/TrailChest", () => ({
  CHEST_WIDTH: 88, CHEST_HEIGHT: 81, TrailChest: "TrailChest",
}));
jest.mock("@/constants/design", () => ({
  accent: {}, bg: {}, border: {}, text: {}, type: { caption: {} },
  motion: { duration: { enter: 300 } }, space: { lg: 24, md: 16, xxl: 48 },
}));

import type { TopicTrail as RenderTopicTrail, TrailStep } from "../features/train/components/TopicTrail";

// Evaluate the actual component with native mocks. Production TypeScript checking
// remains separate: Jest's non-strict config mis-infers RN animated transforms.
const { readFileSync } = require("node:fs") as { readFileSync(path: string, encoding: "utf8"): string };
const componentPath = (require as unknown as { resolve(path: string): string }).resolve("../features/train/components/TopicTrail");
const componentSource = readFileSync(componentPath, "utf8");
const componentModule = { exports: {} as { TopicTrail: typeof RenderTopicTrail } };
const compiled = transpileModule(componentSource, {
  compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2020, jsx: JsxEmit.ReactJSX },
}).outputText;
new Function("require", "module", "exports", compiled)(require, componentModule, componentModule.exports);
const { TopicTrail } = componentModule.exports;

type Element = ReactElement<Record<string, any>>;
const nodesIn = (node: ReactNode): Element[] =>
  Children.toArray(node).flatMap((child) => {
    if (!isValidElement(child)) return [];
    const element = child as Element;
    return [element, ...nodesIn(element.props.children)];
  });
const flattenStyle = (style: unknown): Record<string, any> =>
  Array.isArray(style) ? Object.assign({}, ...style.map(flattenStyle)) : style && typeof style === "object" ? style : {};
const renderTrail = (count: number, withCompanion = true) => {
  const steps: TrailStep[] = Array.from({ length: count }, (_, index) => ({
    id: `lesson-${index}`, title: `Lesson ${index + 1}`, state: "available",
  }));
  return TopicTrail({
    topicKey: "rules", steps, doneCount: 0, width: 340,
    pose: withCompanion ? "settling" : undefined, onStepPress: jest.fn(),
  });
};
const summarize = (tree: ReactNode) => {
  const nodes = nodesIn(tree);
  return {
    nodes,
    lessons: nodes.filter((node) => node.props.step !== undefined),
    chests: nodes.filter((node) => typeof node.props.earned === "boolean"),
    companions: nodes.filter((node) => (node.type as unknown) === "TrainCompanion"),
  };
};

describe("TopicTrail while curriculum data loads", () => {
  test.each([true, false])("an empty trail renders safely (companion configured: %s)", (withCompanion) => {
    const tree = renderTrail(0, withCompanion);
    const rendered = summarize(tree);
    expect(rendered.lessons).toHaveLength(0);
    expect(rendered.chests).toHaveLength(0);
    expect(rendered.companions).toHaveLength(0);
    expect(Number.isFinite(flattenStyle(tree.props.style).height)).toBe(true);
  });

  test.each([1, 2])("%i lessons keep their final chest without placing a companion", (count) => {
    const rendered = summarize(renderTrail(count));
    expect(rendered.lessons).toHaveLength(count);
    expect(rendered.chests).toHaveLength(1);
    expect(rendered.chests[0].props.remaining).toBe(count);
    expect(rendered.companions).toHaveLength(0);
  });

  test.each([3, 10])("%i lessons retain both chests and finite companion geometry", (count) => {
    const rendered = summarize(renderTrail(count));
    expect(rendered.lessons.map((node) => node.props.step.id)).toEqual(
      Array.from({ length: count }, (_, index) => `lesson-${index}`),
    );
    expect(rendered.chests).toHaveLength(2);
    expect(rendered.companions).toHaveLength(1);
    const companionParent = rendered.nodes.find((node) => node.props.pointerEvents === "none")!;
    const companionStyle = flattenStyle(companionParent.props.style);
    expect(Number.isFinite(companionStyle.top)).toBe(true);
    expect(companionStyle.right).toBe(0);
    for (const node of rendered.nodes) {
      const style = flattenStyle(node.props.style);
      for (const key of ["top", "left", "right", "width", "height"]) {
        if (style[key] !== undefined) expect(Number.isFinite(style[key])).toBe(true);
      }
    }
  });

  test("a loaded trail without a companion still renders every lesson and chest", () => {
    const rendered = summarize(renderTrail(5, false));
    expect(rendered.lessons).toHaveLength(5);
    expect(rendered.chests).toHaveLength(2);
    expect(rendered.companions).toHaveLength(0);
  });
});
