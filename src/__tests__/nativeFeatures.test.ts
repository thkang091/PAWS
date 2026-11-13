const mockPlatform = { OS: "ios" };
const mockNativeModule = jest.fn();
const mockPrintImport = jest.fn();
const mockSharingImport = jest.fn();
const mockBrowserImport = jest.fn();
const mockPrint = { printToFileAsync: jest.fn() };
const mockSharing = { shareAsync: jest.fn() };
const mockBrowser = { openAuthSessionAsync: jest.fn(), openBrowserAsync: jest.fn() };

jest.mock("react-native", () => ({ Platform: mockPlatform }));
jest.mock("expo-modules-core", () => ({ requireOptionalNativeModule: mockNativeModule }));
jest.mock("expo-print", () => { mockPrintImport(); return mockPrint; });
jest.mock("expo-sharing", () => { mockSharingImport(); return mockSharing; });
jest.mock("expo-web-browser", () => { mockBrowserImport(); return mockBrowser; });
jest.mock("expo-file-system", () => ({ File: class {}, Paths: {} }));

describe("features added after an installed development build", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockPlatform.OS = "ios";
    mockNativeModule.mockReset().mockReturnValue(null);
  });

  test("route dependencies can import without evaluating enforcing packages", () => {
    const pdf = require("../services/medicalPdf");
    const features = require("../lib/nativeFeatures");
    expect(pdf.medicalRecordHtml).toBeInstanceOf(Function);
    expect(features.loadWebBrowser).toBeInstanceOf(Function);
    expect(mockPrintImport).not.toHaveBeenCalled();
    expect(mockSharingImport).not.toHaveBeenCalled();
    expect(mockBrowserImport).not.toHaveBeenCalled();
    expect(mockNativeModule).not.toHaveBeenCalled();
  });

  test("missing PDF modules fail before creating or sharing any file", async () => {
    const { shareMedicalPdf } = require("../services/medicalPdf");
    await expect(shareMedicalPdf({})).rejects.toThrow("Sharing a medical PDF needs a newer PAWS development build");
    expect(mockPrintImport).not.toHaveBeenCalled();
    expect(mockSharingImport).not.toHaveBeenCalled();
    expect(mockPrint.printToFileAsync).not.toHaveBeenCalled();
    expect(mockSharing.shareAsync).not.toHaveBeenCalled();
  });

  test("a missing share module is detected before the available print package is loaded", () => {
    mockNativeModule.mockImplementation((name: string) => name === "ExpoPrint" ? {} : null);
    const { loadMedicalPdfModules } = require("../lib/nativeFeatures");
    expect(loadMedicalPdfModules).toThrow("newer PAWS development build");
    expect(mockNativeModule).toHaveBeenCalledWith("ExpoSharing");
    expect(mockPrintImport).not.toHaveBeenCalled();
    expect(mockSharingImport).not.toHaveBeenCalled();
  });

  test("missing browser support reports the feature without evaluating or opening a browser", () => {
    const { loadWebBrowser, MissingNativeFeatureError } = require("../lib/nativeFeatures");
    expect(() => loadWebBrowser("Apple sign-in")).toThrow(MissingNativeFeatureError);
    expect(() => loadWebBrowser("Apple sign-in")).toThrow("Apple sign-in needs a newer PAWS development build");
    expect(mockBrowserImport).not.toHaveBeenCalled();
    expect(mockBrowser.openAuthSessionAsync).not.toHaveBeenCalled();
    expect(mockBrowser.openBrowserAsync).not.toHaveBeenCalled();
  });

  test("updated binaries load the original packages and reuse their module instances", () => {
    mockNativeModule.mockReturnValue({});
    const { loadMedicalPdfModules, loadWebBrowser } = require("../lib/nativeFeatures");
    expect(loadMedicalPdfModules()).toEqual({ Print: mockPrint, Sharing: mockSharing });
    expect(loadWebBrowser("Apple sign-in")).toBe(mockBrowser);
    loadMedicalPdfModules();
    loadWebBrowser("Opening store websites");
    expect(mockPrintImport).toHaveBeenCalledTimes(1);
    expect(mockSharingImport).toHaveBeenCalledTimes(1);
    expect(mockBrowserImport).toHaveBeenCalledTimes(1);
  });

  test("web keeps the packages' web implementations without requiring native modules", () => {
    mockPlatform.OS = "web";
    const { loadMedicalPdfModules, loadWebBrowser } = require("../lib/nativeFeatures");
    expect(loadMedicalPdfModules()).toEqual({ Print: mockPrint, Sharing: mockSharing });
    expect(loadWebBrowser("Opening store websites")).toBe(mockBrowser);
    expect(mockNativeModule).not.toHaveBeenCalled();
  });
});
