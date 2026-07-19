import Foundation
import ScreenCaptureKit
import AVFoundation

class AudioRecorder: NSObject, SCStreamOutput {
    var stream: SCStream?
    let targetSampleRate: Double = 16000.0
    let targetChannels: UInt32 = 1
    private var carrySamples: [Float] = []
    private var resamplePosition: Double = 0
    private var activeInputSampleRate: Double = 0
    private var loggedFormat = false
    
    func start() {
        Task {
            do {
                let content = try await SCShareableContent.excludingDesktopWindows(true, onScreenWindowsOnly: true)
                guard let display = content.displays.first else {
                    fputs("Error: No display found\n", stderr)
                    exit(1)
                }
                
                let filter = SCContentFilter(display: display, excludingWindows: [])
                let config = SCStreamConfiguration()
                config.capturesAudio = true
                config.excludesCurrentProcessAudio = true
                
                // Re-sample configuration to 16kHz mono!
                config.sampleRate = Int(self.targetSampleRate)
                config.channelCount = Int(self.targetChannels)
                
                // To save resources, capture minimal video dimensions
                config.width = 16
                config.height = 16
                
                self.stream = SCStream(filter: filter, configuration: config, delegate: nil)
                
                try self.stream?.addStreamOutput(self, type: .audio, sampleHandlerQueue: DispatchQueue(label: "com.mianshizhu.audio-capture"))
                try await self.stream?.startCapture()
                fputs("SUCCESS: Capture started successfully\n", stderr)
            } catch {
                fputs("Error starting capture: \(error.localizedDescription)\n", stderr)
                exit(1)
            }
        }
    }
    
    func stream(_ stream: SCStream, didOutputSampleBuffer sampleBuffer: CMSampleBuffer, of outputType: SCStreamOutputType) {
        guard outputType == .audio else { return }
        
        guard let formatDescription = sampleBuffer.formatDescription,
              let audioDescription = formatDescription.audioStreamBasicDescription else {
            return
        }
        
        // ScreenCaptureKit may ignore the requested 16 kHz / mono format and
        // deliver 48 kHz stereo (often as non-interleaved float buffers).
        // The ASR Gateway always expects 16 kHz, mono, signed PCM; forwarding
        // the raw first buffer changes playback speed and loses part of a
        // sentence. Downmix and resample every buffer explicitly instead.
        try? sampleBuffer.withAudioBufferList { audioBufferList, blockBuffer in
            guard audioBufferList.count > 0 else { return }
            let inputSampleRate = audioDescription.mSampleRate
            guard inputSampleRate > 0 else { return }
            let isFloat = (audioDescription.mFormatFlags & kLinearPCMFormatFlagIsFloat) != 0
            let bytesPerSample = max(1, Int(audioDescription.mBitsPerChannel) / 8)
            guard bytesPerSample == 2 || bytesPerSample == 4 else { return }

            if !loggedFormat {
                loggedFormat = true
                let channels = max(1, Int(audioDescription.mChannelsPerFrame))
                fputs("FORMAT: rate=\(inputSampleRate), channels=\(channels), buffers=\(audioBufferList.count), float=\(isFloat)\n", stderr)
            }

            var frameCount = Int.max
            for index in 0..<audioBufferList.count {
                let buffer = audioBufferList[index]
                let channelsInBuffer = max(1, Int(buffer.mNumberChannels))
                let sampleCount = Int(buffer.mDataByteSize) / bytesPerSample
                frameCount = min(frameCount, sampleCount / channelsInBuffer)
            }
            guard frameCount > 0 && frameCount != Int.max else { return }

            var mono = [Float](repeating: 0, count: frameCount)
            for frame in 0..<frameCount {
                var sum: Float = 0
                var channelCount = 0
                for index in 0..<audioBufferList.count {
                    let buffer = audioBufferList[index]
                    guard let mData = buffer.mData else { continue }
                    let channelsInBuffer = max(1, Int(buffer.mNumberChannels))
                    for channel in 0..<channelsInBuffer {
                        let sampleIndex = frame * channelsInBuffer + channel
                        sum += decodeSample(
                            mData,
                            index: sampleIndex,
                            isFloat: isFloat,
                            bytesPerSample: bytesPerSample
                        )
                        channelCount += 1
                    }
                }
                mono[frame] = channelCount > 0 ? sum / Float(channelCount) : 0
            }

            writePcm(resampleToTarget(mono, inputSampleRate: inputSampleRate))
        }
    }

    private func decodeSample(
        _ data: UnsafeMutableRawPointer,
        index: Int,
        isFloat: Bool,
        bytesPerSample: Int
    ) -> Float {
        if isFloat {
            return data.assumingMemoryBound(to: Float32.self)[index]
        }
        if bytesPerSample == 2 {
            return Float(data.assumingMemoryBound(to: Int16.self)[index]) / 32768.0
        }
        return Float(data.assumingMemoryBound(to: Int32.self)[index]) / Float(Int32.max)
    }

    private func resampleToTarget(_ samples: [Float], inputSampleRate: Double) -> [Int16] {
        if activeInputSampleRate != inputSampleRate {
            activeInputSampleRate = inputSampleRate
            carrySamples.removeAll(keepingCapacity: true)
            resamplePosition = 0
        }

        if inputSampleRate == targetSampleRate {
            return samples.map(floatToInt16)
        }

        let ratio = inputSampleRate / targetSampleRate
        let combined = carrySamples + samples
        var position = resamplePosition
        var output: [Int16] = []
        output.reserveCapacity(Int(Double(samples.count) / ratio) + 2)

        while position + 1 < Double(combined.count) {
            let left = Int(position)
            let fraction = Float(position - Double(left))
            let value = combined[left] + (combined[left + 1] - combined[left]) * fraction
            output.append(floatToInt16(value))
            position += ratio
        }

        let consumed = Int(position)
        carrySamples = consumed < combined.count ? Array(combined[consumed...]) : []
        resamplePosition = position - Double(consumed)
        return output
    }

    private func floatToInt16(_ value: Float) -> Int16 {
        let clamped = max(-1.0, min(1.0, value))
        return Int16(clamped < 0 ? clamped * 32768.0 : clamped * 32767.0)
    }

    private func writePcm(_ samples: [Int16]) {
        guard !samples.isEmpty else { return }
        samples.withUnsafeBytes { rawBytes in
            guard let baseAddress = rawBytes.baseAddress else { return }
            FileHandle.standardOutput.write(Data(bytes: baseAddress, count: rawBytes.count))
        }
    }
}

let recorder = AudioRecorder()
recorder.start()

// Keep binary alive
RunLoop.main.run()
