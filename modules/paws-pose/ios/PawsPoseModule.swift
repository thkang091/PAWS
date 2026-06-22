/**
 * PawsPoseModule.swift
 *
 * Expo native module that exposes CoreMLPoseExtractor to JavaScript.
 *
 * Registered under the name "PawsPose".
 *
 * JavaScript usage (via modules/paws-pose/index.ts):
 *
 *   import { PawsPoseModule } from "paws-pose";
 *
 *   const supported = await PawsPoseModule.isSupported();
 *   const result = await PawsPoseModule.extractFromVideo({
 *     videoUri:        capture.uri,
 *     verificationId: verification.id,
 *     activityId:     "sit",
 *     targetFps:      8,
 *     minFrameConfidence: 0.20,
 *   });
 *   // result.frames, result.benchmark, ...
 *
 * Build requirement
 * -----------------
 * This module requires a development build (expo-modules-core).
 * It is NOT available in Expo Go. The JS layer detects absence of the native
 * module and falls back to server-side video upload automatically.
 */

import ExpoModulesCore
import Foundation

public class PawsPoseModule: Module {

    public func definition() -> ModuleDefinition {
        Name("PawsPose")

        // Check if on-device extraction is supported.
        AsyncFunction("isSupported") { () -> Bool in
            return CoreMLPoseExtractor.isSupported()
        }

        // Main extraction entry point.
        AsyncFunction("extractFromVideo") {
            (
                options: [String: Any],
                promise: Promise
            ) in

            guard let videoUri = options["videoUri"] as? String,
                  let verificationId = options["verificationId"] as? String,
                  let activityId = options["activityId"] as? String
            else {
                promise.reject(
                    "INVALID_ARGS",
                    "extractFromVideo requires videoUri, verificationId, and activityId."
                )
                return
            }

            let targetFps = (options["targetFps"] as? Double) ?? 8.0
            let minFrameConfidence = (options["minFrameConfidence"] as? Double).map { Float($0) } ?? 0.20

            let config = PoseExtractionConfig(
                targetFps: targetFps,
                minFrameConfidence: minFrameConfidence,
                ringBufferCapacity: 600
            )

            CoreMLPoseExtractor.extractFromVideo(
                videoURI: videoUri,
                verificationId: verificationId,
                activityId: activityId,
                config: config
            ) { result in
                switch result {
                case .success(let payload):
                    // Encode the payload to a JSON-compatible dictionary.
                    do {
                        let encoder = JSONEncoder()
                        let data = try encoder.encode(payload)
                        let dict = try JSONSerialization.jsonObject(with: data, options: [])
                        promise.resolve(dict)
                    } catch {
                        promise.reject("ENCODE_ERROR", "Failed to encode pose payload: \(error)")
                    }

                case .failure(let reason):
                    promise.reject("EXTRACTION_FAILED", reason.rawValue)
                }
            }
        }
    }
}
