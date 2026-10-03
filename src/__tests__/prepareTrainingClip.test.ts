jest.mock("expo-asset", () => ({ Asset: { fromModule: jest.fn() } }));
import { Asset } from "expo-asset";
import { prepareTrainingClip } from "@/features/train/media/prepareTrainingClip";

describe("prepareTrainingClip", () => {
  beforeEach(() => jest.clearAllMocks());

  it("waits for the full download and supplies the local file instead of Metro", async () => {
    let finish!: () => void;
    const asset = { localUri: null as string | null, downloadAsync: jest.fn(() => new Promise<void>((resolve) => {
      finish = () => { asset.localUri = "file:///cache/clip.mp4"; resolve(); };
    })) };
    (Asset.fromModule as jest.Mock).mockReturnValue(asset);
    let settled = false;
    const result = prepareTrainingClip(12).then((value) => { settled = true; return value; });
    await Promise.resolve();
    expect(settled).toBe(false);
    finish();
    expect(await result).toEqual({ uri: "file:///cache/clip.mp4" });
  });

  it("surfaces download errors so the UI can retry instead of streaming the failed asset", async () => {
    (Asset.fromModule as jest.Mock).mockReturnValue({ downloadAsync: jest.fn().mockRejectedValue(new Error("offline")) });
    await expect(prepareTrainingClip(12)).rejects.toThrow("offline");
  });

  it("keeps empty and already resolved sources intact", async () => {
    expect(await prepareTrainingClip(null)).toBeNull();
    const source = { uri: "file:///clip.mp4" };
    expect(await prepareTrainingClip(source)).toBe(source);
    expect(Asset.fromModule).not.toHaveBeenCalled();
  });
});
