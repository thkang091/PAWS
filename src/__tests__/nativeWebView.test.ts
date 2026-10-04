const mockGet = jest.fn();
const mockImport = jest.fn();
jest.mock("react-native", () => ({ TurboModuleRegistry: { get: mockGet } }));
jest.mock("react-native-webview", () => { mockImport(); return { WebView: "native-webview" }; });

describe("WebView compatibility with existing development binaries", () => {
  beforeEach(() => { jest.resetModules(); mockGet.mockReset(); mockImport.mockClear(); });

  test("route import and missing-module fallback never evaluate the enforcing WebView package", () => {
    const { loadNativeWebView } = require("../features/train/media/nativeWebView");
    expect(mockImport).not.toHaveBeenCalled();
    mockGet.mockReturnValue(null);
    expect(loadNativeWebView()).toBeNull();
    expect(mockGet).toHaveBeenCalledWith("RNCWebViewModule");
    expect(mockImport).not.toHaveBeenCalled();
  });

  test("a rebuilt binary loads the real player, with module evaluation cached", () => {
    const { loadNativeWebView } = require("../features/train/media/nativeWebView");
    mockGet.mockReturnValue({});
    expect(loadNativeWebView()).toBe("native-webview");
    expect(loadNativeWebView()).toBe("native-webview");
    expect(mockImport).toHaveBeenCalledTimes(1);
  });
});
