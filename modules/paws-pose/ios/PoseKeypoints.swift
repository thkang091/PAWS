/**
 * PoseKeypoints.swift
 *
 * Data structures shared between CoreMLPoseExtractor and PawsPoseModule.
 * These mirror the TypeScript types in src/types/onDevicePose.ts and the
 * Python server-side schema so that payloads are schema-compatible end-to-end.
 *
 * Keypoint name mapping: Apple Vision framework joint identifiers are mapped
 * to the server-side KEYPOINT_NAMES from preprocessing.py.
 */

import Foundation
import Vision

// MARK: - Keypoint

struct PoseKeypointData: Codable {
    let x: Float
    let y: Float
    let confidence: Float
}

// MARK: - Frame

struct PoseFrameData: Codable {
    let frame_index: Int
    let timestamp_ms: Int
    let keypoints: [String: PoseKeypointData]
    let confidence: Float
}

// MARK: - Benchmark

struct PoseBenchmarkData: Codable {
    var avg_inference_ms: Double
    var p50_inference_ms: Double
    var p95_inference_ms: Double
    var dropped_frame_count: Int
    var dropped_frame_rate: Double
    var avg_keypoint_confidence: Double
    var payload_size_bytes: Int?
    var total_upload_latency_ms: Int?
    var device_model: String
}

// MARK: - Full payload

struct PoseSequencePayloadData: Codable {
    let verification_id: String
    let activity_id: String
    let requested_trick: String
    let device_model: String
    let ios_version: String
    let app_version: String
    let pose_model_version: String
    let fps: Double
    let recording_duration_ms: Int
    let frame_count: Int
    let frames: [PoseFrameData]
    var benchmark: PoseBenchmarkData
}

// MARK: - Extraction config

struct PoseExtractionConfig {
    var targetFps: Double = 8.0
    var minFrameConfidence: Float = 0.20
    var ringBufferCapacity: Int = 600
}

// MARK: - Vision joint name -> server keypoint name mapping

/// Maps VNAnimalBodyPoseObservation.JointName raw values to server-side
/// KEYPOINT_NAMES from preprocessing.py.
///
/// Apple Vision animal body pose joint names (iOS 17+):
///   leftFrontElbow, rightFrontElbow, leftFrontKnee, rightFrontKnee
///   leftFrontPaw,   rightFrontPaw
///   leftBackElbow,  rightBackElbow
///   leftBackKnee,   rightBackKnee
///   leftBackPaw,    rightBackPaw
///   neck, tailBase
///
/// We map to the 10 keypoint names used by the server.
enum JointMapping {
    static let visionToServer: [String: String] = [
        // Apple Vision name : server keypoint name
        "neck":              "nose",           // closest proxy for head/nose region
        "leftFrontPaw":      "left_front_paw",
        "rightFrontPaw":     "right_front_paw",
        "leftBackPaw":       "left_hind_paw",
        "rightBackPaw":      "right_hind_paw",
        "leftFrontElbow":    "left_shoulder",
        "rightFrontElbow":   "right_shoulder",
        "leftBackElbow":     "left_hip",
        "rightBackElbow":    "right_hip",
        "tailBase":          "tail_base",
    ]
}

// MARK: - Device info

struct DeviceInfo {
    static var model: String {
        var systemInfo = utsname()
        uname(&systemInfo)
        return withUnsafePointer(to: &systemInfo.machine) {
            $0.withMemoryRebound(to: CChar.self, capacity: 1) {
                String(validatingUTF8: $0) ?? "unknown"
            }
        }
    }

    static var iosVersion: String {
        UIDevice.current.systemVersion
    }

    static var appVersion: String {
        (Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String) ?? "unknown"
    }
}
