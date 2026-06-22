/**
 * CoreMLPoseExtractor.swift
 *
 * On-device pose extraction from a recorded video file.
 *
 * Prototype approach: post-capture video processing
 * -------------------------------------------------
 * After `recordAsync()` completes and returns a local video URI, this module
 * processes the video through AVAsset + Vision framework BEFORE the video is
 * uploaded to Supabase. The pose sequence payload is sent to the server instead
 * of (or alongside) the raw video, depending on quality gates.
 *
 * Why post-capture rather than real-time?
 *   - Avoids conflicts with expo-camera's AVCaptureSession
 *   - Deterministic: same input always yields same output
 *   - Simpler to benchmark and validate
 *   - Real-time path is documented as Phase 2
 *
 * Model used in prototype
 * -----------------------
 * VNDetectAnimalBodyPoseRequest (Apple Vision, iOS 17+)
 * No .mlmodel file required. Returns up to 25 animal body joints.
 *
 * Production path
 * ---------------
 * Replace VNDetectAnimalBodyPoseRequest with a VNCoreMLRequest backed by
 * PawsQuadrupedPose.mlmodel (SuperAnimal quadruped converted to Core ML).
 * The joint name mapping in PoseKeypoints.swift handles the schema difference.
 *
 * iOS 16 fallback
 * ---------------
 * VNDetectAnimalBodyPoseRequest is iOS 17+. On iOS 16 this class returns
 * ExtractionUnavailableReason.iosVersionTooLow and the JS layer falls back to
 * server-side video upload.
 */

import AVFoundation
import Foundation
import UIKit
import Vision

// MARK: - Extraction unavailability reason

enum ExtractionUnavailableReason: String {
    case iosVersionTooLow = "ios_version_too_low"
    case videoUnreadable   = "video_unreadable"
    case noFramesExtracted = "no_frames_extracted"
    case internalError     = "internal_error"
}

// MARK: - CoreMLPoseExtractor

@available(iOS 13.0, *)
final class CoreMLPoseExtractor {

    // MARK: - Public interface

    /**
     * Check whether on-device pose extraction is supported on this device.
     * VNDetectAnimalBodyPoseRequest requires iOS 17.
     */
    static func isSupported() -> Bool {
        if #available(iOS 17.0, *) {
            return true
        }
        return false
    }

    /**
     * Extract a pose sequence from a video file at the given local URI.
     *
     * - Parameters:
     *   - videoURI:         Local file URI from expo-camera's recordAsync().
     *   - verificationId:   Verification row ID.
     *   - activityId:       Trick slug, e.g. "sit".
     *   - config:           Extraction configuration.
     *   - completion:       Called on the main thread with the result.
     */
    static func extractFromVideo(
        videoURI: String,
        verificationId: String,
        activityId: String,
        config: PoseExtractionConfig,
        completion: @escaping (Result<PoseSequencePayloadData, ExtractionUnavailableReason>) -> Void
    ) {
        guard #available(iOS 17.0, *) else {
            completion(.failure(.iosVersionTooLow))
            return
        }

        // Validate and resolve the video URL.
        let urlString = videoURI.hasPrefix("file://") ? videoURI : "file://\(videoURI)"
        guard let url = URL(string: urlString) else {
            completion(.failure(.videoUnreadable))
            return
        }

        // Run extraction on a background queue to avoid blocking the main thread.
        DispatchQueue.global(qos: .userInitiated).async {
            do {
                let result = try Self.processVideo(
                    url: url,
                    verificationId: verificationId,
                    activityId: activityId,
                    config: config
                )
                DispatchQueue.main.async { completion(.success(result)) }
            } catch let reason as ExtractionUnavailableReason {
                DispatchQueue.main.async { completion(.failure(reason)) }
            } catch {
                DispatchQueue.main.async { completion(.failure(.internalError)) }
            }
        }
    }

    // MARK: - Private implementation

    @available(iOS 17.0, *)
    private static func processVideo(
        url: URL,
        verificationId: String,
        activityId: String,
        config: PoseExtractionConfig
    ) throws -> PoseSequencePayloadData {

        let asset = AVURLAsset(url: url)

        // Load duration synchronously (fine on background queue).
        let durationCMTime = asset.duration
        let durationSeconds = CMTimeGetSeconds(durationCMTime)
        guard durationSeconds > 0 else {
            throw ExtractionUnavailableReason.videoUnreadable
        }
        let durationMs = Int(durationSeconds * 1000)

        // Create an AVAssetImageGenerator to sample frames at target FPS.
        let generator = AVAssetImageGenerator(asset: asset)
        generator.appliesPreferredTrackTransform = true
        generator.requestedTimeToleranceBefore = CMTime(value: 1, timescale: 30)
        generator.requestedTimeToleranceAfter  = CMTime(value: 1, timescale: 30)
        generator.maximumSize = CGSize(width: 640, height: 640)

        // Build the list of sample times at the target FPS.
        let interval = 1.0 / config.targetFps
        var sampleTimes: [CMTime] = []
        var t = 0.0
        while t < durationSeconds {
            sampleTimes.append(CMTimeMakeWithSeconds(t, preferredTimescale: 600))
            t += interval
        }
        let candidateCount = sampleTimes.count

        // Vision request.
        let poseRequest = VNDetectAnimalBodyPoseRequest()

        // Collect results.
        var frames: [PoseFrameData] = []
        var inferenceTimes: [Double] = []
        var droppedCount = 0
        var frameIndex = 0

        for sampleTime in sampleTimes {
            let timestampMs = Int(CMTimeGetSeconds(sampleTime) * 1000)

            // Extract frame image.
            guard let cgImage = try? generator.copyCGImage(at: sampleTime, actualTime: nil) else {
                droppedCount += 1
                continue
            }

            // Run Vision request and measure latency.
            let inferenceStart = Date()
            let handler = VNImageRequestHandler(
                cgImage: cgImage,
                orientation: .up,
                options: [:]
            )

            do {
                try handler.perform([poseRequest])
            } catch {
                droppedCount += 1
                continue
            }

            let inferenceMs = Date().timeIntervalSince(inferenceStart) * 1000
            inferenceTimes.append(inferenceMs)

            // Parse the first (highest-confidence) observation.
            guard
                let observations = poseRequest.results,
                let observation = observations.first
            else {
                // No dog detected in this frame — push a zero-confidence frame.
                let emptyFrame = PoseFrameData(
                    frame_index: frameIndex,
                    timestamp_ms: timestampMs,
                    keypoints: [:],
                    confidence: 0.0
                )
                if emptyFrame.confidence >= config.minFrameConfidence {
                    frames.append(emptyFrame)
                }
                frameIndex += 1
                continue
            }

            let keypointData = Self.extractKeypoints(from: observation)
            let meanConf = keypointData.values.map { Double($0.confidence) }.reduce(0, +) /
                           Double(max(keypointData.count, 1))

            let frameData = PoseFrameData(
                frame_index: frameIndex,
                timestamp_ms: timestampMs,
                keypoints: keypointData,
                confidence: Float(meanConf)
            )

            if frameData.confidence >= config.minFrameConfidence {
                frames.append(frameData)
            } else {
                droppedCount += 1
            }

            frameIndex += 1
        }

        guard !frames.isEmpty else {
            throw ExtractionUnavailableReason.noFramesExtracted
        }

        // Build benchmark.
        let avgInference = inferenceTimes.isEmpty ? 0.0 :
            inferenceTimes.reduce(0, +) / Double(inferenceTimes.count)
        let sorted = inferenceTimes.sorted()
        let p50 = Self.percentile(sorted, p: 50)
        let p95 = Self.percentile(sorted, p: 95)

        let avgConf = frames.map { Double($0.confidence) }.reduce(0, +) /
                      Double(frames.count)

        let droppedRate = candidateCount > 0
            ? Double(droppedCount) / Double(candidateCount)
            : 0.0

        let benchmark = PoseBenchmarkData(
            avg_inference_ms: avgInference,
            p50_inference_ms: p50,
            p95_inference_ms: p95,
            dropped_frame_count: droppedCount,
            dropped_frame_rate: droppedRate,
            avg_keypoint_confidence: avgConf,
            payload_size_bytes: nil,      // filled after JSON serialisation
            total_upload_latency_ms: nil, // filled after upload completes
            device_model: DeviceInfo.model
        )

        return PoseSequencePayloadData(
            verification_id: verificationId,
            activity_id: activityId,
            requested_trick: activityId,
            device_model: DeviceInfo.model,
            ios_version: DeviceInfo.iosVersion,
            app_version: DeviceInfo.appVersion,
            pose_model_version: "vision_animal_body_pose_v1",
            fps: config.targetFps,
            recording_duration_ms: durationMs,
            frame_count: frames.count,
            frames: frames,
            benchmark: benchmark
        )
    }

    // MARK: - Keypoint parsing

    @available(iOS 17.0, *)
    private static func extractKeypoints(
        from observation: VNAnimalBodyPoseObservation
    ) -> [String: PoseKeypointData] {

        var result: [String: PoseKeypointData] = [:]

        // Iterate all recognised joints.
        let allJoints = observation.availableJointNames

        for jointName in allJoints {
            guard
                let point = try? observation.recognizedPoint(jointName),
                point.confidence > 0.01
            else { continue }

            let visionKey = jointName.rawValue
            guard let serverKey = JointMapping.visionToServer[visionKey] else { continue }

            // Vision normalises to [0,1] with origin at bottom-left.
            // Flip y so origin is top-left to match server convention.
            result[serverKey] = PoseKeypointData(
                x: Float(point.x),
                y: Float(1.0 - point.y),
                confidence: point.confidence
            )
        }

        return result
    }

    // MARK: - Statistics helpers

    private static func percentile(_ sorted: [Double], p: Double) -> Double {
        guard !sorted.isEmpty else { return 0.0 }
        let idx = max(0, Int(ceil(p / 100.0 * Double(sorted.count))) - 1)
        return sorted[min(idx, sorted.count - 1)]
    }
}
